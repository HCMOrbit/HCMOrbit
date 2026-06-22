"""Meetup.com events scraper — secondary RUG source.

Strategy (tolerant + silent on failure):
1. **GraphQL first** (per spec): POST to `https://api.meetup.com/gql` with a
   keyword-search query. Meetup deprecated public anonymous access in 2024-25,
   so this typically 404/401s — falls through to step 2 without raising.
2. **Public HTML search fallback**: GET `https://www.meetup.com/find/?keywords=…`
   and parse JSON-LD `@type=Event` blocks. The page SSRs nearby events; we
   keyword-filter to only the ones that look Workday-related so we don't pollute
   the admin queue with unrelated meetups.

Scraped events land in `ecosystem_events` as drafts (`is_published=False`) with
`source='meetup'`, keyed on the event URL. Re-runs never duplicate.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from bs4 import BeautifulSoup

from jobs.recurrence import detect_recurrence

from core import db
from jobs.rug_scraper import (
    _format_location,
    _format_organizer,
    _infer_event_type,
    _iso_date,
    _time_from_iso,
)

log = logging.getLogger(__name__)

SOURCE = "meetup"
SEARCH_KEYWORDS = ["Workday", "HCM"]
GRAPHQL_URL = "https://api.meetup.com/gql"
SEARCH_URL_FMT = "https://www.meetup.com/find/?keywords={kw}&source=EVENTS"
REQUEST_TIMEOUT_S = 8.0
BROWSER_UA = "Mozilla/5.0 (compatible; HCMOrbit-MeetupScraper/1.0; +https://hcmorbit.com)"

# Lower-cased substrings that indicate an event is genuinely Workday-relevant.
# Used to filter Meetup's SSR'd events (which include unrelated nearby ones).
_RELEVANT_TOKENS = ("workday", "hcm", "human capital", "people analytics")

_GQL_QUERY = """
query KeywordSearch($filter: SearchConnectionFilter!, $first: Int!) {
  keywordSearch(filter: $filter, first: $first) {
    edges {
      node {
        result {
          ... on Event {
            id
            title
            dateTime
            eventUrl
            description
            venue { name city state }
            group { name urlname }
          }
        }
      }
    }
  }
}
"""


def _is_relevant(name: str, organizer: str | None, description: str | None) -> bool:
    blob = " ".join([name or "", organizer or "", description or ""]).lower()
    return any(tok in blob for tok in _RELEVANT_TOKENS)


async def _try_graphql(keyword: str) -> list[dict[str, Any]]:
    """POST the keyword-search query. Returns [] on any failure (404/401/etc.)."""
    body = {
        "query": _GQL_QUERY,
        "variables": {"filter": {"query": keyword, "lat": 0.0, "lon": 0.0, "source": "EVENTS"}, "first": 25},
    }
    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_S,
            follow_redirects=True,
            headers={"User-Agent": BROWSER_UA, "Content-Type": "application/json"},
        ) as client:
            r = await client.post(GRAPHQL_URL, json=body)
        if r.status_code != 200:
            log.info(f"Meetup GraphQL returned {r.status_code} — falling back to HTML search")
            return []
        payload = r.json()
    except Exception as e:  # noqa: BLE001
        log.info(f"Meetup GraphQL failed for {keyword!r}: {e}")
        return []

    edges = (((payload or {}).get("data") or {}).get("keywordSearch") or {}).get("edges") or []
    out: list[dict[str, Any]] = []
    for edge in edges:
        node = (edge or {}).get("node") or {}
        ev = (node.get("result") or {})
        if not ev.get("title") or not ev.get("eventUrl"):
            continue
        out.append(_normalize_graphql_event(ev))
    return out


def _normalize_graphql_event(ev: dict[str, Any]) -> dict[str, Any]:
    """GraphQL Event → our canonical scraper-output shape."""
    venue = ev.get("venue") or {}
    venue_str = ", ".join(filter(None, [venue.get("name"), venue.get("city"), venue.get("state")])) or None
    group = ev.get("group") or {}
    title = (ev.get("title") or "").strip()
    description = (ev.get("description") or "").strip()
    recurrence = detect_recurrence(ev, text=f"{title} {description}")
    return {
        "title":       title[:200],
        "date":        _iso_date(ev.get("dateTime")),
        "time":        _time_from_iso(ev.get("dateTime")),
        "timezone":    None,
        "sponsor":     (group.get("name") or "").strip() or None,
        "location":    venue_str,
        "register_url": ev.get("eventUrl"),
        "description": description[:1000] or None,
        **recurrence,
    }


def _parse_jsonld_events_from_html(html: str) -> list[dict[str, Any]]:
    """Extract `@type=Event` JSON-LD blocks from a Meetup search-results page."""
    soup = BeautifulSoup(html, "lxml")
    found: list[dict[str, Any]] = []
    for s in soup.find_all("script", type="application/ld+json"):
        if not s.string:
            continue
        try:
            data = json.loads(s.string.strip())
        except Exception:  # noqa: BLE001
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            n = stack.pop()
            if not isinstance(n, dict):
                continue
            if isinstance(n.get("@graph"), list):
                stack.extend(n["@graph"])
            t = n.get("@type")
            if (isinstance(t, str) and t.lower() == "event") or (isinstance(t, list) and any(str(x).lower() == "event" for x in t)):
                found.append(n)
    return found


async def _try_html_search(keyword: str) -> list[dict[str, Any]]:
    """Scrape the public Meetup search page for `keyword`; returns normalized events."""
    url = SEARCH_URL_FMT.format(kw=keyword.replace(" ", "+"))
    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_S,
            follow_redirects=True,
            headers={"User-Agent": BROWSER_UA, "Accept": "text/html"},
        ) as client:
            r = await client.get(url)
        if r.status_code != 200:
            log.info(f"Meetup HTML search for {keyword!r}: status={r.status_code}")
            return []
        html = r.text
    except Exception as e:  # noqa: BLE001
        log.info(f"Meetup HTML search failed for {keyword!r}: {e}")
        return []

    raw_events = _parse_jsonld_events_from_html(html)
    normalized: list[dict[str, Any]] = []
    for ev in raw_events:
        name = (ev.get("name") or "").strip()
        url = ev.get("url") or ev.get("@id")
        date = _iso_date(ev.get("startDate"))
        if not (name and url and date):
            continue
        organizer = _format_organizer(ev.get("organizer"))
        description = (ev.get("description") or "").strip()
        # Filter to Workday-relevant entries — search page SSRs unrelated nearby
        # events because Meetup's keyword filtering runs client-side.
        if not _is_relevant(name, organizer, description):
            continue
        normalized.append({
            "title":       name[:200],
            "date":        date,
            "time":        _time_from_iso(ev.get("startDate")),
            "timezone":    None,
            "sponsor":     organizer,
            "location":    _format_location(ev.get("location")),
            "register_url": url,
            "description": description[:1000] or None,
        })
    return normalized


def _finalize_doc(doc: dict[str, Any]) -> dict[str, Any] | None:
    """Coerce intermediate scraper output → DB-ready document. Returns None if invalid."""
    if not (doc.get("title") and doc.get("register_url") and doc.get("date")):
        return None
    return {
        "title":        doc["title"][:200],
        "event_type":   _infer_event_type(doc["title"], doc.get("description") or "", doc.get("location") or ""),
        "date":         doc["date"],
        "time":         doc.get("time"),
        "timezone":     doc.get("timezone"),
        "sponsor":      doc.get("sponsor"),
        "location":     doc.get("location"),
        "register_url": doc["register_url"],
        "description":  doc.get("description"),
    }


async def scrape_meetup_events() -> dict[str, int]:
    """Pull Workday-related events from Meetup.com, upsert as drafts."""
    summary = {"found": 0, "new": 0, "updated": 0}
    seen_urls: set[str] = set()
    candidates: list[dict[str, Any]] = []

    for keyword in SEARCH_KEYWORDS:
        # 1. GraphQL first (per spec).
        items = await _try_graphql(keyword)
        # 2. Fall back to HTML search if GraphQL gave us nothing.
        if not items:
            items = await _try_html_search(keyword)
        for it in items:
            url = it.get("register_url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            doc = _finalize_doc(it)
            if doc:
                candidates.append(doc)

    summary["found"] = len(candidates)
    if not candidates:
        log.info("Meetup scraper: no Workday-relevant events found.")
        return summary

    now = datetime.now(timezone.utc).isoformat()
    for doc in candidates:
        result = await db.ecosystem_events.update_one(
            {"register_url": doc["register_url"]},
            {
                "$setOnInsert": {
                    "id": f"evt_{uuid.uuid4().hex[:12]}",
                    "first_seen_at": now,
                    "is_published": False,
                    "source": SOURCE,
                },
                "$set": {
                    "title":        doc["title"],
                    "event_type":   doc["event_type"],
                    "date":         doc["date"],
                    "time":         doc.get("time"),
                    "timezone":     doc.get("timezone"),
                    "sponsor":      doc.get("sponsor"),
                    "location":     doc.get("location"),
                    "register_url": doc["register_url"],
                    "description":  doc.get("description"),
                },
                "$currentDate": {"updated_at": True},
            },
            upsert=True,
        )
        if result.upserted_id is not None:
            summary["new"] += 1
        elif result.modified_count > 0:
            summary["updated"] += 1

    log.info(f"Meetup scraper complete — {summary}")
    return summary

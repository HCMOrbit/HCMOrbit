"""Eventbrite Workday RUG scraper.

Scrapes events from a curated list of confirmed Workday RUG organizer pages on
Eventbrite, plus a handful of one-off standalone event landing pages (e.g.
the TOLA RUG page hosted on Kainos).

Eventbrite's organizer pages are fully client-rendered, but their internal
"show more" endpoint serves clean JSON without auth:

  https://www.eventbrite.com/org/{ORG_ID}/showmore/?type=future&page=1

We harvest every future event from this JSON, normalize it into our
ecosystem_events schema, and upsert as drafts (`is_published=False`) with
`source='eventbrite'` and `event_type='RUG'` (these are dedicated RUG
organizer pages — no keyword filtering needed).

Adding a new RUG chapter is a one-line addition to `ORGANIZER_URLS`.
Adding a one-off event page is a one-line addition to `STANDALONE_EVENT_URLS`.

Silent failure on every network/parse error — the scraper logs and returns
partial results so the admin always sees what we managed to harvest.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from core import db
from event_scraper import fetch_event_metadata
from jobs.rug_scraper import _iso_date, _time_from_iso

log = logging.getLogger(__name__)

SOURCE = "eventbrite"
EVENT_TYPE = "RUG"
REQUEST_TIMEOUT_S = 8.0
BROWSER_UA = "Mozilla/5.0 (compatible; HCMOrbit-EventbriteScraper/1.0; +https://hcmorbit.com)"

# ── Curated source URLs ────────────────────────────────────────────────────
# Adding a new RUG chapter? Just append the organizer URL. The ID is parsed
# automatically from the trailing digits.
ORGANIZER_URLS: list[str] = [
    "https://www.eventbrite.com/o/workday-regional-user-group-14235725376",
    "https://www.eventbrite.com/o/denver-regional-user-group-9456554733",
]

# Standalone event pages that aren't on Eventbrite (e.g. Kainos-hosted RUG
# landing pages). We scrape these via the generic `fetch_event_metadata`
# helper and store under the same `source='eventbrite'` bucket for the
# admin's review-queue convenience.
STANDALONE_EVENT_URLS: list[str] = [
    "https://get.kainos.com/FY26-Q2-WDY-RUG-TOLA_01---Reg-LP.html",
]

_ORG_ID_RE = re.compile(r"-(\d{8,})/?$")


def _organizer_id(url: str) -> str | None:
    m = _ORG_ID_RE.search(url.rstrip("/"))
    return m.group(1) if m else None


def _venue_to_location(venue: dict[str, Any] | None) -> str | None:
    """Render Eventbrite's nested `venue` object into a single human line."""
    if not isinstance(venue, dict):
        return None
    name = (venue.get("name") or "").strip()
    addr = venue.get("address") or {}
    parts = [name] if name else []
    if isinstance(addr, dict):
        city   = (addr.get("city") or "").strip()
        region = (addr.get("region") or "").strip()
        if city and city not in parts:
            parts.append(city)
        if region and region not in parts:
            parts.append(region)
    return ", ".join(parts) or None


def _normalize_eventbrite_event(ev: dict[str, Any]) -> dict[str, Any] | None:
    """Coerce one Eventbrite JSON event dict → our ecosystem_events shape.

    Returns None when the event is missing essentials (name/url/start).
    """
    name = ((ev.get("name") or {}).get("text") or "").strip()
    url = ev.get("url") or ""
    start = ev.get("start") or {}
    date = _iso_date(start.get("utc") or start.get("local"))
    if not (name and url and date):
        return None
    # Prefer the page's `formatted_time` ("10:00 AM") — it's already friendly.
    time_str = start.get("formatted_time") or _time_from_iso(start.get("local") or start.get("utc"))
    description = ((ev.get("description") or {}).get("text") or "").strip() or None
    location = "Online" if ev.get("is_online_event") else _venue_to_location(ev.get("venue"))
    return {
        "title":        name[:200],
        "event_type":   EVENT_TYPE,
        "date":         date,
        "time":         time_str,
        "timezone":     None,
        "sponsor":      ((ev.get("organizer") or {}).get("short_name") or "").strip() or None,
        "location":     location,
        "register_url": url,
        "description":  description[:1000] if description else None,
    }


async def _fetch_org_future_events(org_id: str) -> list[dict[str, Any]]:
    """Hit the internal showmore endpoint and return normalized events."""
    url = f"https://www.eventbrite.com/org/{org_id}/showmore/?type=future&page=1"
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S, follow_redirects=True,
                                     headers={"User-Agent": BROWSER_UA, "Accept": "application/json"}) as c:
            r = await c.get(url)
        if r.status_code != 200:
            log.info(f"Eventbrite org {org_id}: status {r.status_code}")
            return []
        payload = r.json()
    except Exception as e:  # noqa: BLE001
        log.info(f"Eventbrite org {org_id} fetch failed: {e}")
        return []

    raw = ((payload or {}).get("data") or {}).get("events") or []
    out: list[dict[str, Any]] = []
    for ev in raw:
        norm = _normalize_eventbrite_event(ev)
        if norm:
            out.append(norm)
    return out


async def _fetch_standalone_event(url: str) -> dict[str, Any] | None:
    """Reuse the existing OG/JSON-LD scraper for one-off landing pages."""
    data = await fetch_event_metadata(url)
    if data.get("source") == "unknown" or not data.get("title") or not data.get("date"):
        return None
    return {
        "title":        data["title"][:200],
        "event_type":   EVENT_TYPE,            # forced — these are RUG-confirmed URLs
        "date":         data["date"],
        "time":         data.get("time"),
        "timezone":     None,
        "sponsor":      data.get("sponsor"),
        "location":     data.get("location"),
        "register_url": data.get("register_url") or url,
        "description":  (data.get("description") or "")[:1000] or None,
    }


async def scrape_eventbrite_rugs() -> dict[str, int]:
    """Upsert RUG events from every URL in `ORGANIZER_URLS` + `STANDALONE_EVENT_URLS`.

    Always returns a `{found, new, updated}` summary, even on partial failures.
    """
    summary = {"found": 0, "new": 0, "updated": 0}
    candidates: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    # 1. Organizer pages (bulk JSON listings)
    for org_url in ORGANIZER_URLS:
        org_id = _organizer_id(org_url)
        if not org_id:
            log.info(f"Eventbrite scraper: could not parse org id from {org_url}")
            continue
        for doc in await _fetch_org_future_events(org_id):
            url = doc.get("register_url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            candidates.append(doc)

    # 2. Standalone landing pages
    for url in STANDALONE_EVENT_URLS:
        if url in seen_urls:
            continue
        doc = await _fetch_standalone_event(url)
        if doc:
            seen_urls.add(doc["register_url"])
            candidates.append(doc)

    summary["found"] = len(candidates)
    if not candidates:
        log.info("Eventbrite scraper: 0 RUG events harvested.")
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

    log.info(f"Eventbrite scraper complete — {summary}")
    return summary

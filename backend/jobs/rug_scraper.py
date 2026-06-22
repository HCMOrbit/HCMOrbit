"""RUG events scraper for WDBeacon.

Scheduled job: pulls https://wdbeacon.com/events, extracts event cards, and
upserts them into `ecosystem_events` as `is_published=False` so an admin can
review and publish them via the admin Ecosystem panel.

Tolerant by design — many event sites change markup; we try (in order):
1. JSON-LD `@type=Event` blocks  (best signal, fully structured)
2. Common semantic patterns (`.event-card`, `[itemtype*=Event]`, etc.)
3. Heuristic anchor-based extraction as a last resort.

Failures are silent — the scraper returns whatever it could parse and never
raises. WDBeacon's Cloudflare CAPTCHA gate is one such expected failure.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from jobs.recurrence import detect_recurrence

from core import db

log = logging.getLogger(__name__)

SOURCE = "wdbeacon"
WDBEACON_URL = "https://wdbeacon.com/events"
REQUEST_TIMEOUT_S = 5.0
USER_AGENT = "Mozilla/5.0 (compatible; HCMOrbit-RUGScraper/1.0; +https://hcmorbit.com)"

# Map keyword hits in title/description to our canonical event_type buckets.
_TYPE_KEYWORDS = [
    ("RUG",        ("rug", "regional user group", "user group", "meetup", "chapter")),
    ("Webinar",    ("webinar", "online session", "virtual session", "live online")),
    ("Conference", ("conference", "summit", "rising", "tech connect", "convergence")),
]

_MONTH_NUM = {
    **{m: f"{i:02d}" for i, m in enumerate(
        ["january","february","march","april","may","june","july","august","september","october","november","december"], 1)},
    **{m: f"{i:02d}" for i, m in enumerate(
        ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"], 1)},
    "sept": "09",
}


def _infer_event_type(*texts: str) -> str:
    blob = " ".join(t for t in texts if t).lower()
    for label, kws in _TYPE_KEYWORDS:
        if any(kw in blob for kw in kws):
            return label
    return "RUG"  # WDBeacon is primarily RUGs — sensible default for this source


def _iso_date(value: Any) -> str | None:
    """Extract YYYY-MM-DD from an ISO timestamp or a free-form text date."""
    if not value:
        return None
    s = str(value).strip()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # Textual fallback (e.g. "March 15, 2026" / "Mar 15 2026")
    m = re.search(
        r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b",
        s, re.IGNORECASE,
    )
    if m:
        return f"{m.group(3)}-{_MONTH_NUM[m.group(1).lower()]}-{int(m.group(2)):02d}"
    return None


def _time_from_iso(value: Any) -> str | None:
    if not value:
        return None
    m = re.search(r"T(\d{2}):(\d{2})", str(value))
    if not m:
        return None
    h = int(m.group(1))
    suffix = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return f"{h12}:{m.group(2)} {suffix}"


def _format_location(loc: Any) -> str | None:
    if not loc:
        return None
    if isinstance(loc, str):
        return loc.strip() or None
    if isinstance(loc, list):
        for x in loc:
            v = _format_location(x)
            if v:
                return v
        return None
    if isinstance(loc, dict):
        name = (loc.get("name") or "").strip()
        addr = loc.get("address")
        parts = [name] if name else []
        if isinstance(addr, dict):
            for k in ("addressLocality", "addressRegion"):
                v = (addr.get(k) or "").strip()
                if v and v not in parts:
                    parts.append(v)
        elif isinstance(addr, str) and addr.strip():
            parts.append(addr.strip())
        return ", ".join(parts) or None
    return None


def _format_organizer(org: Any) -> str | None:
    if not org:
        return None
    if isinstance(org, list):
        for x in org:
            v = _format_organizer(x)
            if v:
                return v
        return None
    if isinstance(org, dict):
        return (org.get("name") or "").strip() or None
    return str(org).strip() or None


def _parse_jsonld_events(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Return parsed dicts for every JSON-LD `@type=Event` (incl. @graph)."""
    out: list[dict[str, Any]] = []
    for s in soup.find_all("script", type="application/ld+json"):
        if not s.string:
            continue
        try:
            data = json.loads(s.string.strip())
        except Exception:  # noqa: BLE001
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if not isinstance(node, dict):
                continue
            if isinstance(node.get("@graph"), list):
                stack.extend(node["@graph"])
            t = node.get("@type")
            if (isinstance(t, str) and t.lower() == "event") or (isinstance(t, list) and any(str(x).lower() == "event" for x in t)):
                out.append(node)
    return out


def _normalize_url(href: str | None, base: str) -> str | None:
    if not href:
        return None
    href = href.strip()
    if not href:
        return None
    return urljoin(base, href)


def _build_event_doc(parsed: dict[str, Any], base_url: str) -> dict[str, Any] | None:
    """Coerce a JSON-LD-ish dict into our `ecosystem_events` document shape.

    Returns None if there is no usable date or registration URL.
    """
    title = (parsed.get("name") or parsed.get("title") or "").strip()
    register_url = _normalize_url(parsed.get("url") or parsed.get("register_url"), base_url)
    date = _iso_date(parsed.get("startDate") or parsed.get("date"))
    if not (title and register_url and date):
        return None
    description = (parsed.get("description") or "").strip()
    recurrence = detect_recurrence(parsed, text=f"{title} {description}")
    return {
        "title": title[:200],
        "event_type": _infer_event_type(title, description, parsed.get("location") if isinstance(parsed.get("location"), str) else ""),
        "date": date,
        "time": _time_from_iso(parsed.get("startDate")),
        "timezone": None,
        "sponsor": _format_organizer(parsed.get("organizer")),
        "location": _format_location(parsed.get("location")),
        "register_url": register_url,
        "description": description[:1000] if description else None,
        **recurrence,
    }


def _heuristic_extract(soup: BeautifulSoup, base_url: str) -> list[dict[str, Any]]:
    """Last-resort: walk anchors that point at `/events/<slug>` and harvest
    surrounding text. Best-effort — many fields will be missing.
    """
    found: dict[str, dict[str, Any]] = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not re.search(r"/events?/[A-Za-z0-9\-_]+", href):
            continue
        full_url = _normalize_url(href, base_url)
        if not full_url or full_url in found:
            continue
        # Prefer the surrounding heading over the anchor text (which is
        # typically generic — "Register", "Details", "Learn more"). Only fall
        # back to anchor text if no heading is found.
        title = ""
        parent = a.find_parent(["article", "li", "div", "section"])
        if parent:
            h = parent.find(["h1", "h2", "h3", "h4"])
            if h:
                title = h.get_text(" ", strip=True)
        if not title:
            title = (a.get_text(" ", strip=True) or "").strip()
        if not title or len(title) < 4:
            continue
        # Try to find a date string in the same container.
        container = a.find_parent(["article", "li", "div", "section"]) or a
        container_text = container.get_text(" ", strip=True)
        date = _iso_date(container_text[:400])
        if not date:
            continue
        found[full_url] = {
            "title": title[:200],
            "event_type": _infer_event_type(title, container_text[:300]),
            "date": date,
            "time": None,
            "timezone": None,
            "sponsor": None,
            "location": None,
            "register_url": full_url,
            "description": None,
        }
    return list(found.values())


async def _fetch_html(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT_S,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html"},
        ) as client:
            r = await client.get(url)
        if r.status_code != 200:
            log.info(f"RUG scraper: {url} returned status {r.status_code} — skipping")
            return None
        return r.text
    except Exception as e:  # noqa: BLE001
        log.info(f"RUG scraper: fetch failed for {url}: {e}")
        return None


async def scrape_rug_events() -> dict[str, int]:
    """Pull WDBeacon, upsert RUG events as drafts. Always returns a summary dict."""
    summary = {"found": 0, "new": 0, "updated": 0}
    html = await _fetch_html(WDBEACON_URL)
    if not html:
        log.info("RUG scraper: no HTML retrieved — finishing with 0 events.")
        return summary

    soup = BeautifulSoup(html, "lxml")

    # 1. Prefer JSON-LD structured data
    candidates: list[dict[str, Any]] = []
    for ev in _parse_jsonld_events(soup):
        doc = _build_event_doc(ev, WDBEACON_URL)
        if doc:
            candidates.append(doc)

    # 2. Fall back to heuristic anchor scraping if no JSON-LD events
    if not candidates:
        candidates = _heuristic_extract(soup, WDBEACON_URL)

    summary["found"] = len(candidates)
    if not candidates:
        log.info("RUG scraper: page parsed but no events extracted (markup unfamiliar or CAPTCHA gate).")
        return summary

    now = datetime.now(timezone.utc).isoformat()
    for doc in candidates:
        register_url = doc["register_url"]
        result = await db.ecosystem_events.update_one(
            {"register_url": register_url},
            {
                "$setOnInsert": {
                    "id": f"evt_{uuid.uuid4().hex[:12]}",
                    "first_seen_at": now,
                    "is_published": False,   # admin reviews before publishing
                    "source": SOURCE,
                },
                "$set": {
                    "title":       doc["title"],
                    "event_type":  doc["event_type"],
                    "date":        doc["date"],
                    "time":        doc.get("time"),
                    "timezone":    doc.get("timezone"),
                    "sponsor":     doc.get("sponsor"),
                    "location":    doc.get("location"),
                    "register_url": register_url,
                    "description": doc.get("description"),
                },
                "$currentDate": {"updated_at": True},
            },
            upsert=True,
        )
        if result.upserted_id is not None:
            summary["new"] += 1
        elif result.modified_count > 0:
            summary["updated"] += 1

    log.info(f"RUG scraper complete — {summary}")
    return summary

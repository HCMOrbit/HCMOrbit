"""Best-effort event metadata scraper for the admin "Paste URL → auto-fill" flow.

Strategy:
1. Fetch the URL once with a tight timeout.
2. Prefer Eventbrite's JSON-LD structured data (clean Event objects) — most accurate.
3. Fall back to OpenGraph / Twitter meta tags.
4. Fall back to plain-text regex date extraction.

All failures must be silent and return whatever partial data we managed to extract,
so the admin can fill in the rest manually.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx

log = logging.getLogger(__name__)

# Module keywords → our 3 canonical event_type buckets. Used as a last-resort
# inference when JSON-LD doesn't specify it.
_TYPE_KEYWORDS = {
    "RUG":        ["rug", "regional user group", "user group", "meetup", "chapter"],
    "Webinar":    ["webinar", "online session", "virtual session", "live online"],
    "Conference": ["conference", "summit", "rising", "tech connect", "convergence"],
}

# Month names → 2-digit number, for the textual-date regex fallback.
_MONTH_TO_NUM = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "jun": "06",
    "jul": "07", "aug": "08", "sept": "09", "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}


def _infer_event_type(*texts: str) -> str:
    """Pick RUG / Webinar / Conference based on keyword hits across `texts`."""
    blob = " ".join(t for t in texts if t).lower()
    for label, keywords in _TYPE_KEYWORDS.items():
        if any(kw in blob for kw in keywords):
            return label
    return "Conference"  # safe default


def _meta(html: str, attr: str, value: str) -> str | None:
    """Find a <meta {attr}="{value}" content="…"> tag (either attr ordering)."""
    patterns = [
        rf'<meta[^>]+{attr}=["\']{re.escape(value)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+{attr}=["\']{re.escape(value)}["\']',
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


def _parse_jsonld_events(html: str) -> list[dict[str, Any]]:
    """Return every JSON-LD object with @type=Event found in the page."""
    blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.IGNORECASE | re.DOTALL,
    )
    events: list[dict[str, Any]] = []
    for raw in blocks:
        try:
            data = json.loads(raw.strip())
        except Exception:  # noqa: BLE001
            continue
        # JSON-LD may be a single object, a list, or a @graph wrapper.
        candidates = data if isinstance(data, list) else [data]
        for c in candidates:
            if not isinstance(c, dict):
                continue
            graph = c.get("@graph")
            if isinstance(graph, list):
                candidates.extend(graph)
            t = c.get("@type")
            if (isinstance(t, str) and t.lower() == "event") or (isinstance(t, list) and any(str(x).lower() == "event" for x in t)):
                events.append(c)
    return events


def _iso_date(value: str | None) -> str | None:
    """Extract YYYY-MM-DD from a string. Accepts ISO timestamps or 'YYYY-MM-DD'."""
    if not value:
        return None
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", value)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def _time_from_iso(value: str | None) -> str | None:
    """Return a friendly 'h:MM AM' string from an ISO timestamp; None on failure."""
    if not value:
        return None
    m = re.search(r"T(\d{2}):(\d{2})", value)
    if not m:
        return None
    h = int(m.group(1))
    suffix = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return f"{h12}:{m.group(2)} {suffix}"


def _format_location(loc: Any) -> str | None:
    """Render schema.org Location/Place into a human-readable single line."""
    if not loc:
        return None
    if isinstance(loc, str):
        return loc.strip() or None
    if isinstance(loc, list):
        for item in loc:
            out = _format_location(item)
            if out:
                return out
        return None
    if isinstance(loc, dict):
        name = (loc.get("name") or "").strip()
        addr = loc.get("address")
        parts: list[str] = []
        if name:
            parts.append(name)
        if isinstance(addr, dict):
            for k in ("streetAddress", "addressLocality", "addressRegion"):
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
    if isinstance(org, str):
        return org.strip() or None
    if isinstance(org, list):
        for item in org:
            out = _format_organizer(item)
            if out:
                return out
        return None
    if isinstance(org, dict):
        return (org.get("name") or "").strip() or None
    return None


def _regex_date_from_text(text: str) -> str | None:
    """Find a date like 'January 15, 2026' / 'Jan 15 2026' / 'YYYY-MM-DD' in `text`."""
    # ISO first
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # Textual: "Month DD[,] YYYY"
    m = re.search(
        r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b",
        text, re.IGNORECASE,
    )
    if m:
        mn = _MONTH_TO_NUM[m.group(1).lower()]
        return f"{m.group(3)}-{mn}-{int(m.group(2)):02d}"
    return None


async def fetch_event_metadata(url: str, timeout_s: float = 3.0) -> dict[str, Any]:
    """Single best-effort scrape. Returns whatever fields we could extract.

    Always returns a dict with `register_url=url` and `source` ('jsonld' /
    'opengraph' / 'unknown') so the caller knows how rich the extraction was.
    Missing fields are simply omitted — no nulls. Never raises.
    """
    out: dict[str, Any] = {"register_url": url, "source": "unknown"}

    # Light validation — empty / non-http URLs short-circuit immediately.
    parsed_url = urlparse(url)
    if parsed_url.scheme not in ("http", "https") or not parsed_url.netloc:
        return out

    try:
        async with httpx.AsyncClient(
            timeout=timeout_s,
            follow_redirects=True,
            headers={"User-Agent": "HCMOrbit-EventScraper/1.0 (+https://hcmorbit.com)"},
        ) as client:
            r = await client.get(url)
        if r.status_code != 200:
            return out
        html = r.text
    except Exception as e:  # noqa: BLE001
        log.debug(f"event scrape — network failed for {url}: {e}")
        return out

    # ── 1. JSON-LD Event (Eventbrite, schema.org-compliant sites) ──────────
    for ev in _parse_jsonld_events(html):
        title = (ev.get("name") or "").strip()
        if title:
            out["title"] = title
        desc = (ev.get("description") or "").strip()
        if desc:
            # Trim description into something useful as "sponsor blurb".
            out["description"] = desc[:500]
        iso_start = ev.get("startDate")
        d = _iso_date(iso_start)
        if d:
            out["date"] = d
        t = _time_from_iso(iso_start)
        if t:
            out["time"] = t
        loc = _format_location(ev.get("location"))
        if loc:
            out["location"] = loc
        org = _format_organizer(ev.get("organizer"))
        if org:
            out["sponsor"] = org
        out["source"] = "jsonld"
        out["event_type"] = _infer_event_type(title, desc, url, loc or "")
        if out.get("title") and out.get("date"):
            return out  # Got a high-confidence Event — done.

    # ── 2. OpenGraph / Twitter meta tags ──────────────────────────────────
    title = _meta(html, "property", "og:title") or _meta(html, "name", "twitter:title")
    if title and not out.get("title"):
        out["title"] = title
    desc = _meta(html, "property", "og:description") or _meta(html, "name", "description") or _meta(html, "name", "twitter:description")
    if desc and not out.get("description"):
        out["description"] = desc[:500]
    site = _meta(html, "property", "og:site_name")
    if site and not out.get("sponsor"):
        out["sponsor"] = site

    if out.get("source") == "unknown" and out.get("title"):
        out["source"] = "opengraph"

    # ── 3. Plain-text date regex (only if we still don't have one) ────────
    if not out.get("date"):
        # Scan the title + description first (cheap, high-signal), then page text.
        searchable_text = " ".join([out.get("title") or "", out.get("description") or ""])
        d = _regex_date_from_text(searchable_text)
        if not d:
            # Strip HTML tags and keep first 4000 chars for the body scan.
            plain = re.sub(r"<[^>]+>", " ", html)[:4000]
            d = _regex_date_from_text(plain)
        if d:
            out["date"] = d

    # ── 4. event_type inference from accumulated fields ───────────────────
    if not out.get("event_type"):
        out["event_type"] = _infer_event_type(
            out.get("title") or "", out.get("description") or "", url, out.get("location") or ""
        )

    return out

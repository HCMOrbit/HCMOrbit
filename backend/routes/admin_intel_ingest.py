"""Phase 2A: manual URL ingestion for Industry Pulse.

Admin flow:
  1. POST /api/admin/intel/ingest/fetch { url }
     - Respects robots.txt (rejects if User-Agent is disallowed)
     - Fetches the URL (10s timeout, follows redirects, GET only)
     - Extracts Open Graph + fallback meta (title, description, image, published_at)
     - Returns a preview payload — no DB writes
  2. Admin classifies (type + industry + modules + type-specific fields)
  3. POST /api/admin/intel/ingest/publish { preview, classification }
     - Writes to the right collection with `status: "pending"` for the
       approval queue admins already use.

No scheduled crawling. This is manual — one URL at a time.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, now_iso
from dependencies import require_admin

router = APIRouter()

USER_AGENT = "HCMOrbitBot/1.0 (+https://hcmorbit.com; contact: admin@hcmorbit.com) manual-ingest"
FETCH_TIMEOUT = 10.0
MAX_HTML_BYTES = 2_000_000  # 2 MB — reject monster pages

# ---- helpers ---------------------------------------------------------------
def _allowed_by_robots(url: str) -> tuple[bool, str]:
    """Return (allowed, reason). robots.txt errors are treated as allowed
    (many sites have no robots.txt at all)."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, "Only http(s) URLs are supported"
        if not parsed.netloc:
            return False, "URL missing host"
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            rp.read()
        except Exception:
            return True, "robots.txt unreadable — proceeding"
        if rp.can_fetch(USER_AGENT, url):
            return True, "allowed"
        return False, f"Disallowed by {robots_url}"
    except Exception as exc:
        return True, f"robots check errored ({exc}) — proceeding"


def _meta(soup: BeautifulSoup, name: str) -> Optional[str]:
    tag = (
        soup.find("meta", property=name)
        or soup.find("meta", attrs={"name": name})
    )
    if tag and tag.get("content"):
        return tag["content"].strip()
    return None


def _extract_metadata(html: str, base_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    title = (
        _meta(soup, "og:title")
        or _meta(soup, "twitter:title")
        or (soup.title.string.strip() if soup.title and soup.title.string else None)
        or ""
    )
    description = (
        _meta(soup, "og:description")
        or _meta(soup, "twitter:description")
        or _meta(soup, "description")
        or ""
    )
    image = _meta(soup, "og:image") or _meta(soup, "twitter:image") or None
    site_name = _meta(soup, "og:site_name") or urlparse(base_url).netloc
    published_at = (
        _meta(soup, "article:published_time")
        or _meta(soup, "og:updated_time")
        or _meta(soup, "date")
        or ""
    )
    # A crude excerpt — first <p> with meaningful length
    excerpt = ""
    for p in soup.find_all("p")[:20]:
        txt = (p.get_text() or "").strip()
        if len(txt) >= 60:
            excerpt = txt[:400]
            break

    return {
        "title": title[:400],
        "description": description[:600],
        "image": image,
        "site_name": site_name,
        "published_at": published_at,
        "excerpt": excerpt,
    }


# ---- Fetch endpoint --------------------------------------------------------
class FetchIn(BaseModel):
    url: str


@router.post("/admin/intel/ingest/fetch")
async def ingest_fetch(payload: FetchIn, _: dict = Depends(require_admin)):
    url = payload.url.strip()
    if not url:
        raise HTTPException(400, "URL is required")

    allowed, reason = _allowed_by_robots(url)
    if not allowed:
        raise HTTPException(403, f"Refusing to fetch: {reason}")

    try:
        async with httpx.AsyncClient(
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            resp = await client.get(url)
    except httpx.RequestError as exc:
        raise HTTPException(502, f"Fetch failed: {type(exc).__name__}: {exc}")

    if resp.status_code >= 400:
        raise HTTPException(502, f"Upstream returned {resp.status_code}")

    ctype = resp.headers.get("content-type", "").lower()
    if "html" not in ctype and "xml" not in ctype:
        raise HTTPException(415, f"Unsupported content type: {ctype or 'unknown'}")

    body = resp.text
    if len(body.encode("utf-8", errors="ignore")) > MAX_HTML_BYTES:
        body = body[:MAX_HTML_BYTES]

    meta = _extract_metadata(body, str(resp.url))
    return {
        "url": str(resp.url),
        "status_code": resp.status_code,
        "content_type": ctype,
        "robots_ok": True,
        "robots_reason": reason,
        **meta,
    }


# ---- Publish endpoint ------------------------------------------------------
class Classification(BaseModel):
    signal_type: str  # go_live | event | news | source
    industry: Optional[str] = None
    modules: List[str] = Field(default_factory=list)
    industry_tags: List[str] = Field(default_factory=list)
    # Type-specific fields — all optional; validated per signal_type
    customer_name: Optional[str] = None
    region: Optional[str] = None
    announcement_date: Optional[str] = None
    event_title: Optional[str] = None
    event_type: Optional[str] = None
    event_start_date: Optional[str] = None
    event_end_date: Optional[str] = None
    event_location: Optional[str] = None
    event_virtual: Optional[bool] = None
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    confidence_score: int = 60
    notes: Optional[str] = None


class PublishIn(BaseModel):
    preview: dict
    classification: Classification


@router.post("/admin/intel/ingest/publish")
async def ingest_publish(payload: PublishIn, admin: dict = Depends(require_admin)):
    c = payload.classification
    p = payload.preview
    source_url = p.get("url") or ""
    if not source_url:
        raise HTTPException(400, "preview.url is required")

    now = now_iso()
    signal_type = c.signal_type.strip().lower()

    if signal_type == "go_live":
        if not c.customer_name:
            # fall back to preview title if admin didn't type one
            c.customer_name = p.get("title") or p.get("site_name") or ""
        if not c.customer_name:
            raise HTTPException(400, "customer_name is required for go_live")
        if not c.industry:
            raise HTTPException(400, "industry is required for go_live")
        doc = {
            "id": str(uuid.uuid4()),
            "customer_name": c.customer_name,
            "industry": c.industry,
            "region": c.region or "Americas",
            "modules": c.modules,
            "source_url": source_url,
            "source_name": p.get("site_name") or "Manual submission",
            "announcement_date": c.announcement_date or p.get("published_at") or now[:10],
            "confidence_score": c.confidence_score,
            "status": "pending",
            "created_at": now,
            "ingested_by": admin.get("username"),
            "ingest_note": c.notes,
            "preview_title": p.get("title"),
            "preview_description": p.get("description"),
        }
        await db.intel_go_lives.insert_one(doc)
        return {"ok": True, "collection": "intel_go_lives", "id": doc["id"], "status": "pending"}

    if signal_type == "event":
        title = c.event_title or p.get("title") or ""
        if not title:
            raise HTTPException(400, "event_title is required for event")
        doc = {
            "id": str(uuid.uuid4()),
            "title": title,
            "event_type": c.event_type or "Webinar",
            "start_date": c.event_start_date or p.get("published_at") or now[:10],
            "end_date": c.event_end_date or "",
            "location": c.event_location or "",
            "virtual": c.event_virtual if c.event_virtual is not None else True,
            "registration_url": source_url,
            "source_url": source_url,
            "industry_tags": c.industry_tags or ([c.industry] if c.industry else []),
            "module_tags": c.modules,
            "status": "pending",
            "created_at": now,
            "ingested_by": admin.get("username"),
            "ingest_note": c.notes,
            "preview_description": p.get("description"),
        }
        await db.intel_events.insert_one(doc)
        return {"ok": True, "collection": "intel_events", "id": doc["id"], "status": "pending"}

    if signal_type == "source":
        doc = {
            "id": str(uuid.uuid4()),
            "source_name": c.source_name or p.get("site_name") or urlparse(source_url).netloc,
            "source_type": c.source_type or "other",
            "source_url": source_url,
            "crawl_frequency": "weekly",
            "enabled": False,  # keep disabled until admin explicitly turns it on
            "last_crawled_at": None,
            "last_status": "never_run",
            "reliability_score": c.confidence_score,
            "notes": c.notes or "",
            "status": "pending",
            "created_at": now,
            "updated_at": now,
            "ingested_by": admin.get("username"),
        }
        await db.intel_sources.insert_one(doc)
        return {"ok": True, "collection": "intel_sources", "id": doc["id"], "status": "pending"}

    if signal_type == "news":
        # No dedicated news collection in Phase 1 — reuse ecosystem_news so it
        # shows on the existing /ecosystem/community-news page after approval.
        # Guard against duplicates by URL.
        existing = await db.ecosystem_news.find_one({"url": source_url})
        if existing:
            raise HTTPException(409, "This URL already exists in community news")
        doc = {
            "id": str(uuid.uuid4()),
            "title": p.get("title") or c.notes or "Untitled",
            "summary": p.get("description") or p.get("excerpt") or "",
            "url": source_url,
            "source": p.get("site_name") or urlparse(source_url).netloc,
            "image_url": p.get("image") or None,
            "published_at": p.get("published_at") or now,
            "is_published": False,   # admin must approve on the news page
            "created_at": now,
            "ingested_by": admin.get("username"),
            "industry_tags": c.industry_tags or ([c.industry] if c.industry else []),
            "module_tags": c.modules,
        }
        await db.ecosystem_news.insert_one(doc)
        return {"ok": True, "collection": "ecosystem_news", "id": doc["id"], "status": "pending"}

    raise HTTPException(400, f"Unknown signal_type: {signal_type}")

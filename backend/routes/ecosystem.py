"""Public + admin Ecosystem endpoints — community news (RSS-hydrated) + curated events."""
import calendar
import time
import uuid
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, HttpUrl

from core import db, now_iso
from dependencies import require_admin, log_admin_action
from event_scraper import fetch_event_metadata
from jobs.rug_scraper import scrape_rug_events
from jobs.meetup_scraper import scrape_meetup_events
from jobs.eventbrite_scraper import scrape_eventbrite_rugs

router = APIRouter()


# ── Public-submit rate limit ───────────────────────────────────────────────
# Simple in-memory sliding window — bounded by # of active submitter IPs, no
# Redis needed at this scale. Each list holds Unix timestamps of recent hits.
_SUBMIT_RL_WINDOW_S = 3600     # 1 hour
_SUBMIT_RL_MAX_HITS = 5        # max submissions per IP per window
_submit_hits: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    """Best-effort client IP — honors X-Forwarded-For (Kubernetes ingress)."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        # First entry is the original client, rest are proxies.
        return fwd.split(",")[0].strip()
    return (request.client.host if request.client else "unknown") or "unknown"


def _check_submit_rate_limit(request: Request) -> None:
    """Sliding-window per-IP guard for the public submit endpoint. Raises 429."""
    ip = _client_ip(request)
    now = time.monotonic()
    cutoff = now - _SUBMIT_RL_WINDOW_S
    hits = _submit_hits[ip]
    # Drop expired timestamps in-place to keep the list bounded.
    fresh = [t for t in hits if t > cutoff]
    if len(fresh) >= _SUBMIT_RL_MAX_HITS:
        _submit_hits[ip] = fresh  # keep memory clean even when rejecting
        raise HTTPException(status_code=429, detail="Too many submissions — please try again later")
    fresh.append(now)
    _submit_hits[ip] = fresh



# ── Community news (RSS-hydrated) ──────────────────────────────────────────

@router.get("/ecosystem/news")
async def list_ecosystem_news(limit: int = Query(5, ge=1, le=50)):
    """Return the `limit` most-recent ecosystem news items, newest first."""
    cursor = (
        db.ecosystem_news
        .find({}, {"_id": 0, "title": 1, "url": 1, "published_at": 1, "summary": 1, "source": 1, "image_url": 1})
        .sort("published_at", -1)
        .limit(limit)
    )
    items = await cursor.to_list(limit)
    return {"items": items}


# ── Events (admin-managed) ─────────────────────────────────────────────────

EVENT_TYPES = {"RUG", "Conference", "Webinar"}
RECURRENCE_RULES = {"weekly", "monthly", "monthly_nth_weekday"}
EVENT_PUBLIC_PROJECTION = {
    "_id": 0, "id": 1, "title": 1, "event_type": 1, "date": 1, "time": 1,
    "timezone": 1, "sponsor": 1, "location": 1, "register_url": 1, "description": 1,
    "is_published": 1, "source": 1,
    # Recurrence + on-demand metadata (all optional).
    "is_recurring": 1, "recurrence_rule": 1, "recurrence_end": 1,
    "series_url": 1, "is_on_demand": 1,
}


class EventIn(BaseModel):
    title: str
    event_type: str
    date: Optional[str] = None         # ISO date — required unless `is_on_demand` is true.
    time: Optional[str] = None         # e.g. "4:00 PM – 7:00 PM"
    timezone: Optional[str] = None     # e.g. "MT", "CT", "UTC"
    sponsor: Optional[str] = None
    location: Optional[str] = None
    register_url: Optional[str] = None
    description: Optional[str] = None
    is_published: bool = True
    # Recurrence / on-demand (mutually exclusive — see _validate_event_temporal).
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None     # "weekly" | "monthly" | "monthly_nth_weekday"
    recurrence_end: Optional[str] = None      # ISO date; series ends after this
    series_url: Optional[str] = None
    is_on_demand: bool = False


class EventPatch(BaseModel):
    title: Optional[str] = None
    event_type: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    timezone: Optional[str] = None
    sponsor: Optional[str] = None
    location: Optional[str] = None
    register_url: Optional[str] = None
    description: Optional[str] = None
    is_published: Optional[bool] = None
    is_recurring: Optional[bool] = None
    recurrence_rule: Optional[str] = None
    recurrence_end: Optional[str] = None
    series_url: Optional[str] = None
    is_on_demand: Optional[bool] = None


def _validate_event_type(t: str):
    if t not in EVENT_TYPES:
        raise HTTPException(400, f"event_type must be one of {sorted(EVENT_TYPES)}")


def _validate_event_temporal(doc: dict) -> None:
    """Enforce date/recurrence/on-demand rules consistently for create + update.

    Rules:
      - is_recurring and is_on_demand cannot both be true.
      - date is required unless is_on_demand is true. Recurring events still
        need a date (it seeds the series).
      - recurrence_rule must be in RECURRENCE_RULES when is_recurring is true,
        and must be empty otherwise.
    """
    is_recurring = bool(doc.get("is_recurring"))
    is_on_demand = bool(doc.get("is_on_demand"))
    if is_recurring and is_on_demand:
        raise HTTPException(400, "is_recurring and is_on_demand are mutually exclusive")
    if not is_on_demand and not (doc.get("date") or "").strip():
        raise HTTPException(400, "date is required unless is_on_demand is true")
    if is_recurring:
        rule = (doc.get("recurrence_rule") or "").strip()
        if rule not in RECURRENCE_RULES:
            raise HTTPException(
                400,
                f"recurrence_rule must be one of {sorted(RECURRENCE_RULES)} when is_recurring is true",
            )
    else:
        # Keep the data tight — drop any stray rule on non-recurring rows.
        if doc.get("recurrence_rule") is not None:
            doc["recurrence_rule"] = None
        if doc.get("recurrence_end") is not None:
            doc["recurrence_end"] = None


# ── Recurrence helpers ─────────────────────────────────────────────────────

def _parse_iso(d: Optional[str]) -> Optional[date]:
    if not d:
        return None
    try:
        return date.fromisoformat(d[:10])
    except ValueError:
        return None


def _add_months(d: date, n: int) -> date:
    """Add n months to d, clamping the day to the target month's max."""
    m_idx = d.month - 1 + n
    y = d.year + m_idx // 12
    m = m_idx % 12 + 1
    last_day = calendar.monthrange(y, m)[1]
    return date(y, m, min(d.day, last_day))


def _nth_weekday_of_month(seed: date, target: date) -> date:
    """Return the same Nth-occurrence-of-weekday as `seed` falls in `target`'s month.
    e.g. seed = 3rd Tuesday in May → returns 3rd Tuesday of target.year/target.month.
    Falls back to the last matching weekday when the Nth doesn't exist that month.
    """
    weekday = seed.weekday()
    n = (seed.day - 1) // 7 + 1
    # Find all occurrences of this weekday in the target month.
    days_in_month = calendar.monthrange(target.year, target.month)[1]
    matches = [
        date(target.year, target.month, day)
        for day in range(1, days_in_month + 1)
        if date(target.year, target.month, day).weekday() == weekday
    ]
    if not matches:
        return target  # should never happen — every weekday occurs each month
    return matches[min(n, len(matches)) - 1]


def compute_next_occurrence(seed_iso: str, rule: Optional[str], today: Optional[date] = None) -> Optional[str]:
    """For a recurring event seeded by `seed_iso`, return the next occurrence
    on or after `today` as an ISO string. Returns the seed itself if it is
    already in the future. Returns None if the rule is unknown or the seed
    cannot be parsed.
    """
    today = today or date.today()
    seed = _parse_iso(seed_iso)
    if seed is None or not rule:
        return None
    if seed >= today:
        return seed.isoformat()
    if rule == "weekly":
        delta_days = (today - seed).days
        weeks = (delta_days + 6) // 7  # ceil
        return (seed + timedelta(weeks=weeks)).isoformat()
    if rule == "monthly":
        # Walk month by month — bounded loop, max ~12 iterations per call site.
        candidate = seed
        while candidate < today:
            candidate = _add_months(candidate, 1)
        return candidate.isoformat()
    if rule == "monthly_nth_weekday":
        candidate = seed
        while candidate < today:
            candidate = _add_months(candidate, 1)
            candidate = _nth_weekday_of_month(seed, candidate)
        return candidate.isoformat()
    return None


def _series_active(ev: dict, today: Optional[date] = None) -> bool:
    """True iff a recurring event has no end date or its end is still in the future."""
    today = today or date.today()
    end = _parse_iso(ev.get("recurrence_end"))
    return end is None or end >= today


def _annotate_event(ev: dict, today: Optional[date] = None) -> dict:
    """Attach derived fields the UI needs: `next_date`, `is_past`.

    - On-demand events: next_date=None, is_past=False (never past).
    - Recurring active: next_date=computed rollforward, is_past=False.
    - Recurring expired (past recurrence_end): is_past=True.
    - One-off: next_date=date, is_past iff date < today.
    """
    today = today or date.today()
    out = dict(ev)
    if ev.get("is_on_demand"):
        out["next_date"] = None
        out["is_past"] = False
        return out
    if ev.get("is_recurring") and ev.get("date"):
        if not _series_active(ev, today):
            out["next_date"] = ev.get("date")
            out["is_past"] = True
            return out
        out["next_date"] = compute_next_occurrence(ev["date"], ev.get("recurrence_rule"), today) or ev["date"]
        out["is_past"] = False
        return out
    out["next_date"] = ev.get("date")
    seed = _parse_iso(ev.get("date"))
    out["is_past"] = seed is not None and seed < today
    return out


def _sort_key(ev: dict):
    """Upcoming sort: dated first by date, on-demand pushed to the end."""
    if ev.get("is_on_demand"):
        return (1, "")
    return (0, ev.get("next_date") or ev.get("date") or "9999-12-31")


@router.get("/ecosystem/events")
async def list_events_public():
    """Published events, annotated with `next_date` + `is_past` so the client
    can split Upcoming/Past consistently for one-off, recurring, and on-demand
    events. Sort: dated first by next occurrence, on-demand last."""
    cursor = db.ecosystem_events.find({"is_published": True}, EVENT_PUBLIC_PROJECTION)
    raw = await cursor.to_list(500)
    items = [_annotate_event(ev) for ev in raw]
    items.sort(key=_sort_key)
    return {"items": items}


@router.get("/admin/ecosystem/events")
async def list_events_admin(admin: dict = Depends(require_admin)):
    """All events (published + drafts), annotated like the public endpoint."""
    cursor = db.ecosystem_events.find({}, EVENT_PUBLIC_PROJECTION)
    raw = await cursor.to_list(1000)
    items = [_annotate_event(ev) for ev in raw]
    items.sort(key=_sort_key)
    return {"items": items}


# Body shape for the "Paste URL → auto-fill" admin helper. Kept loose so a
# typo never bounces with a 422 — the scraper itself fails silently downstream.
class FetchUrlBody(BaseModel):
    url: HttpUrl


@router.post("/admin/ecosystem/events/fetch-url")
async def admin_fetch_event_url(body: FetchUrlBody, admin: dict = Depends(require_admin)):
    """Best-effort scrape of an event URL → returns whatever fields it could
    extract (title, description, date, time, sponsor, location, event_type,
    register_url, source). Frontend pre-fills the create-event form with these.
    """
    return await fetch_event_metadata(str(body.url))


@router.post("/ecosystem/events/fetch-url")
async def public_fetch_event_url(body: FetchUrlBody):
    """Public version of the URL auto-fill scraper for the community submission
    form. Reads only external public pages — no internal data exposed."""
    return await fetch_event_metadata(str(body.url))


@router.post("/ecosystem/events/submit", status_code=201)
async def submit_event_public(ev: EventIn, request: Request):
    """Community submission — no auth required. Rate-limited to 5/IP/hour.
    Always stored as draft (`is_published=False`) with `source='community'`
    for admin review; anything the client tries to set for `is_published`
    is ignored."""
    _check_submit_rate_limit(request)
    _validate_event_type(ev.event_type)
    if not (ev.title or "").strip():
        raise HTTPException(400, "title is required")
    if not (ev.register_url or "").strip():
        raise HTTPException(400, "register_url is required")
    doc = ev.model_dump()
    _validate_event_temporal(doc)
    doc["id"] = f"evt_{uuid.uuid4().hex[:12]}"
    doc["is_published"] = False
    doc["source"] = "community"
    doc["submitted_at"] = now_iso()
    await db.ecosystem_events.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@router.post("/admin/ecosystem/scrape-rugs")
async def admin_scrape_rugs(admin: dict = Depends(require_admin)):
    """Trigger the WDBeacon RUG scraper on demand. Returns the run summary.
    Scraped events land in `ecosystem_events` as drafts (`is_published=False`)
    with `source: 'wdbeacon'` for admin review."""
    return await scrape_rug_events()


@router.post("/admin/ecosystem/scrape-meetup")
async def admin_scrape_meetup(admin: dict = Depends(require_admin)):
    """Trigger the Meetup.com Workday/HCM scraper on demand. Same draft flow as
    `scrape-rugs`, but events land with `source: 'meetup'`."""
    return await scrape_meetup_events()


@router.post("/admin/ecosystem/scrape-eventbrite")
async def admin_scrape_eventbrite(admin: dict = Depends(require_admin)):
    """Trigger the Eventbrite Workday RUG scraper on demand.
    Events land with `source: 'eventbrite'`, `event_type: 'RUG'`."""
    return await scrape_eventbrite_rugs()


@router.post("/admin/ecosystem/events")
async def create_event(payload: EventIn, admin: dict = Depends(require_admin)):
    _validate_event_type(payload.event_type)
    doc = payload.model_dump()
    _validate_event_temporal(doc)
    doc["id"] = f"evt_{uuid.uuid4().hex[:12]}"
    doc["created_at"] = now_iso()
    doc["updated_at"] = doc["created_at"]
    await db.ecosystem_events.insert_one(doc)
    await log_admin_action(admin, "ecosystem_event_create", note=f"{doc['id']} {doc['title']}")
    doc.pop("_id", None)
    return doc


@router.patch("/admin/ecosystem/events/{event_id}")
async def update_event(event_id: str, payload: EventPatch, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if "event_type" in updates and updates["event_type"]:
        _validate_event_type(updates["event_type"])
    if not updates:
        raise HTTPException(400, "No fields to update")
    # Re-validate temporal rules using the merged view of the doc post-update.
    if {"is_recurring", "is_on_demand", "date", "recurrence_rule"} & updates.keys():
        current = await db.ecosystem_events.find_one({"id": event_id}, EVENT_PUBLIC_PROJECTION)
        if not current:
            raise HTTPException(404, "Event not found")
        merged = {**current, **updates}
        _validate_event_temporal(merged)
        # Carry any normalizations (e.g. cleared recurrence_rule) back to the update.
        for k in ("recurrence_rule", "recurrence_end"):
            if k in merged and merged[k] != current.get(k):
                updates[k] = merged[k]
    updates["updated_at"] = now_iso()
    result = await db.ecosystem_events.update_one({"id": event_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Event not found")
    doc = await db.ecosystem_events.find_one({"id": event_id}, EVENT_PUBLIC_PROJECTION)
    await log_admin_action(admin, "ecosystem_event_update", note=f"{event_id}")
    return doc


@router.delete("/admin/ecosystem/events/{event_id}")
async def delete_event(event_id: str, admin: dict = Depends(require_admin)):
    result = await db.ecosystem_events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Event not found")
    await log_admin_action(admin, "ecosystem_event_delete", note=f"{event_id}")
    return {"ok": True, "id": event_id}


# ── Certifications (admin-managed) ─────────────────────────────────────────

CERT_STATUSES = {"New", "Upcoming", "Released"}
CERT_PUBLIC_PROJECTION = {
    "_id": 0, "id": 1, "name": 1, "status": 1, "date_label": 1, "is_published": 1,
}


class CertIn(BaseModel):
    name: str
    status: str
    date_label: Optional[str] = None
    is_published: bool = True


class CertPatch(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    date_label: Optional[str] = None
    is_published: Optional[bool] = None


def _validate_cert_status(s: str):
    if s not in CERT_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(CERT_STATUSES)}")


@router.get("/ecosystem/certifications")
async def list_certifications_public():
    """All published certifications, ordered by sort_index then created_at."""
    cursor = (
        db.ecosystem_certifications
        .find({"is_published": True}, CERT_PUBLIC_PROJECTION)
        .sort([("status", 1), ("name", 1)])
    )
    return {"items": await cursor.to_list(200)}


@router.get("/admin/ecosystem/certifications")
async def list_certifications_admin(admin: dict = Depends(require_admin)):
    cursor = db.ecosystem_certifications.find({}, CERT_PUBLIC_PROJECTION).sort("name", 1)
    return {"items": await cursor.to_list(500)}


@router.post("/admin/ecosystem/certifications")
async def create_cert(payload: CertIn, admin: dict = Depends(require_admin)):
    _validate_cert_status(payload.status)
    doc = payload.model_dump()
    doc["id"] = f"cert_{uuid.uuid4().hex[:12]}"
    doc["created_at"] = now_iso()
    doc["updated_at"] = doc["created_at"]
    await db.ecosystem_certifications.insert_one(doc)
    await log_admin_action(admin, "ecosystem_cert_create", note=f"{doc['id']} {doc['name']}")
    doc.pop("_id", None)
    return doc


@router.patch("/admin/ecosystem/certifications/{cert_id}")
async def update_cert(cert_id: str, payload: CertPatch, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if "status" in updates and updates["status"]:
        _validate_cert_status(updates["status"])
    if not updates:
        raise HTTPException(400, "No fields to update")
    updates["updated_at"] = now_iso()
    result = await db.ecosystem_certifications.update_one({"id": cert_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "Certification not found")
    doc = await db.ecosystem_certifications.find_one({"id": cert_id}, CERT_PUBLIC_PROJECTION)
    await log_admin_action(admin, "ecosystem_cert_update", note=f"{cert_id}")
    return doc


@router.delete("/admin/ecosystem/certifications/{cert_id}")
async def delete_cert(cert_id: str, admin: dict = Depends(require_admin)):
    result = await db.ecosystem_certifications.delete_one({"id": cert_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Certification not found")
    await log_admin_action(admin, "ecosystem_cert_delete", note=f"{cert_id}")
    return {"ok": True, "id": cert_id}

"""Public + admin Ecosystem endpoints — community news (RSS-hydrated) + curated events."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, HttpUrl

from core import db, now_iso
from dependencies import require_admin, log_admin_action
from event_scraper import fetch_event_metadata

router = APIRouter()


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
EVENT_PUBLIC_PROJECTION = {
    "_id": 0, "id": 1, "title": 1, "event_type": 1, "date": 1, "time": 1,
    "timezone": 1, "sponsor": 1, "location": 1, "register_url": 1, "description": 1, "is_published": 1,
}


class EventIn(BaseModel):
    title: str
    event_type: str
    date: str                      # ISO date — e.g. "2026-06-17"
    time: Optional[str] = None     # e.g. "4:00 PM – 7:00 PM"
    timezone: Optional[str] = None # e.g. "MT", "CT", "UTC"
    sponsor: Optional[str] = None
    location: Optional[str] = None
    register_url: Optional[str] = None
    description: Optional[str] = None
    is_published: bool = True


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


def _validate_event_type(t: str):
    if t not in EVENT_TYPES:
        raise HTTPException(400, f"event_type must be one of {sorted(EVENT_TYPES)}")


@router.get("/ecosystem/events")
async def list_events_public():
    """All published events, soonest first."""
    cursor = (
        db.ecosystem_events
        .find({"is_published": True}, EVENT_PUBLIC_PROJECTION)
        .sort("date", 1)
    )
    return {"items": await cursor.to_list(200)}


@router.get("/admin/ecosystem/events")
async def list_events_admin(admin: dict = Depends(require_admin)):
    """All events (published + drafts), soonest first — for the admin manager."""
    cursor = db.ecosystem_events.find({}, EVENT_PUBLIC_PROJECTION).sort("date", 1)
    return {"items": await cursor.to_list(500)}


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


@router.post("/admin/ecosystem/events")
async def create_event(payload: EventIn, admin: dict = Depends(require_admin)):
    _validate_event_type(payload.event_type)
    doc = payload.model_dump()
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

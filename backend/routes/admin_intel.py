"""Admin CRUD for the Industry Pulse intelligence layer.

Covers:
  * Source registry (add/edit/enable/disable public data sources)
  * Go-lives review + approve/reject queue
  * Events review + approve/reject queue
  * Manual override of module adoption scores
  * Manual trigger for a source "crawl" (Phase 1: just marks as crawled)

Every route is protected by `require_admin`.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core import db, now_iso
from dependencies import require_admin

router = APIRouter()


# ---------- Operations dashboard -------------------------------------------
@router.get("/admin/intel/operations")
async def operations_overview(_: dict = Depends(require_admin)):
    """Ops dashboard payload: today's activity, crawler health, recent activity."""
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async def _count_today(coll, extra_status: str | None = None):
        q: dict = {"created_at": {"$regex": f"^{today_iso}"}, "ingested_by": {"$exists": True}}
        if extra_status:
            q["status"] = extra_status
        return await coll.count_documents(q)

    # Today's activity — union of all ingested rows across collections.
    submitted = (
        await _count_today(db.intel_go_lives)
        + await _count_today(db.intel_events)
        + await _count_today(db.intel_sources)
        + await db.ecosystem_news.count_documents({
            "created_at": {"$regex": f"^{today_iso}"}, "ingested_by": {"$exists": True}
        })
    )
    published = (
        await _count_today(db.intel_go_lives, "approved")
        + await _count_today(db.intel_events, "approved")
        + await db.ecosystem_news.count_documents({
            "created_at": {"$regex": f"^{today_iso}"}, "ingested_by": {"$exists": True}, "is_published": True
        })
    )
    pending = (
        await _count_today(db.intel_go_lives, "pending")
        + await _count_today(db.intel_events, "pending")
        + await _count_today(db.intel_sources, "pending")
        + await db.ecosystem_news.count_documents({
            "created_at": {"$regex": f"^{today_iso}"}, "ingested_by": {"$exists": True}, "is_published": False
        })
    )
    rejected = (
        await _count_today(db.intel_go_lives, "rejected")
        + await _count_today(db.intel_events, "rejected")
    )

    todays_activity = {
        "submitted": submitted,
        "published": published,
        "pending": pending,
        "rejected": rejected,
    }

    # Crawler health — real numbers today; empty state for stats that only the
    # scheduled crawler (Phase 2B) will populate.
    sources_enabled = await db.intel_sources.count_documents({"enabled": True})
    last_run = None
    async for r in db.intel_crawl_runs.find().sort("run_date", -1).limit(1):
        last_run = r
    crawler_health = {
        "sources_enabled": sources_enabled,
        "last_crawl_at": last_run.get("run_date") if last_run else None,
        "last_crawl_status": last_run.get("status") if last_run else "never_run",
        "records_found": last_run.get("records_found") if last_run else 0,
        "records_published": last_run.get("records_created") if last_run else 0,
        "duplicates": last_run.get("records_updated") if last_run else 0,
        "errors": len(last_run.get("errors") or []) if last_run else 0,
        "crawler_live": False,   # flips true when Phase 2B ships
        "phase_note": "Manual ingestion only — scheduled crawler arrives in Phase 2B.",
    }

    # Recent activity — 10 most recent ingested items across all collections.
    async def _pluck(coll_name, coll, target_label_fn):
        rows = []
        async for r in coll.find({"ingested_by": {"$exists": True}}).sort("created_at", -1).limit(10):
            rows.append({
                "created_at": r.get("created_at"),
                "title": target_label_fn(r),
                "signal_type": coll_name,
                "status": r.get("status") or ("published" if r.get("is_published") else "pending"),
                "source_url": r.get("source_url") or r.get("url"),
                "ingested_by": r.get("ingested_by"),
            })
        return rows

    all_recent = (
        await _pluck("go_live", db.intel_go_lives, lambda r: r.get("customer_name") or "Untitled go-live")
        + await _pluck("event", db.intel_events, lambda r: r.get("title") or "Untitled event")
        + await _pluck("source", db.intel_sources, lambda r: r.get("source_name") or "Unnamed source")
        + await _pluck("news", db.ecosystem_news, lambda r: r.get("title") or "Untitled news")
    )
    all_recent.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    return {
        "todays_activity": todays_activity,
        "crawler_health": crawler_health,
        "recent_activity": all_recent[:12],
    }


# ---------- Sources ---------------------------------------------------------
class SourceIn(BaseModel):
    source_name: str
    source_type: str  # press_release | blog | event | rug | partner | job_board | customer_story
    source_url: str
    crawl_frequency: str = "weekly"  # daily | weekly | monthly
    enabled: bool = True
    reliability_score: int = 70
    notes: Optional[str] = None


class SourcePatch(BaseModel):
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    source_url: Optional[str] = None
    crawl_frequency: Optional[str] = None
    enabled: Optional[bool] = None
    reliability_score: Optional[int] = None
    notes: Optional[str] = None


def _strip(d):
    d.pop("_id", None)
    return d


@router.get("/admin/intel/sources")
async def list_sources(_: dict = Depends(require_admin)):
    docs = [_strip(d) async for d in db.intel_sources.find().sort("created_at", -1)]
    return {"sources": docs}


@router.post("/admin/intel/sources")
async def create_source(payload: SourceIn, _: dict = Depends(require_admin)):
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "last_crawled_at": None,
        "last_status": "never_run",
        "status": "approved",
        "created_at": now,
        "updated_at": now,
    }
    await db.intel_sources.insert_one(doc)
    return _strip(doc)


@router.patch("/admin/intel/sources/{source_id}")
async def update_source(source_id: str, patch: SourcePatch, _: dict = Depends(require_admin)):
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "No fields to update")
    update["updated_at"] = now_iso()
    result = await db.intel_sources.update_one({"id": source_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Source not found")
    doc = await db.intel_sources.find_one({"id": source_id})
    return _strip(doc)


@router.delete("/admin/intel/sources/{source_id}")
async def delete_source(source_id: str, _: dict = Depends(require_admin)):
    result = await db.intel_sources.delete_one({"id": source_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Source not found")
    return {"ok": True}


@router.post("/admin/intel/sources/{source_id}/trigger-crawl")
async def trigger_crawl(source_id: str, _: dict = Depends(require_admin)):
    """Phase 1: records a manual crawl-trigger event (no real crawling yet)."""
    doc = await db.intel_sources.find_one({"id": source_id})
    if not doc:
        raise HTTPException(404, "Source not found")
    now = now_iso()
    await db.intel_sources.update_one(
        {"id": source_id},
        {"$set": {"last_crawled_at": now, "last_status": "manual_trigger_stub"}}
    )
    await db.intel_crawl_runs.insert_one({
        "id": str(uuid.uuid4()),
        "run_date": now,
        "source_id": source_id,
        "source_name": doc.get("source_name"),
        "status": "stub_no_crawler_yet",
        "records_found": 0,
        "records_created": 0,
        "records_updated": 0,
        "errors": [],
        "duration_seconds": 0,
        "note": "Phase 2 will attach the actual crawler here.",
    })
    return {"ok": True, "note": "Phase 1 stub — real crawling arrives in Phase 2."}


@router.get("/admin/intel/crawl-runs")
async def list_crawl_runs(_: dict = Depends(require_admin)):
    runs = [_strip(d) async for d in db.intel_crawl_runs.find().sort("run_date", -1).limit(50)]
    return {"runs": runs}


# ---------- Go-lives queue --------------------------------------------------
class GoLiveIn(BaseModel):
    customer_name: str
    industry: str
    region: str
    modules: List[str] = Field(default_factory=list)
    source_url: str
    source_name: str
    announcement_date: str
    confidence_score: int = 70


@router.get("/admin/intel/go-lives")
async def list_go_lives(
    status: str = Query("all"),
    industry: Optional[str] = None,
    _: dict = Depends(require_admin),
):
    q: dict = {}
    if status != "all":
        q["status"] = status
    if industry:
        q["industry"] = industry
    rows = [_strip(d) async for d in db.intel_go_lives.find(q).sort("announcement_date", -1).limit(200)]
    return {"go_lives": rows}


@router.post("/admin/intel/go-lives")
async def create_go_live(payload: GoLiveIn, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "status": "approved",
        "created_at": now_iso(),
    }
    await db.intel_go_lives.insert_one(doc)
    return _strip(doc)


class GoLivePatch(BaseModel):
    status: Optional[str] = None
    confidence_score: Optional[int] = None
    modules: Optional[List[str]] = None
    region: Optional[str] = None
    customer_name: Optional[str] = None
    announcement_date: Optional[str] = None


@router.patch("/admin/intel/go-lives/{go_live_id}")
async def update_go_live(go_live_id: str, patch: GoLivePatch, _: dict = Depends(require_admin)):
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "No fields to update")
    if update.get("status") not in (None, "approved", "rejected", "pending", "sample_data"):
        raise HTTPException(400, "Invalid status")
    result = await db.intel_go_lives.update_one({"id": go_live_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Go-live not found")
    doc = await db.intel_go_lives.find_one({"id": go_live_id})
    return _strip(doc)


@router.delete("/admin/intel/go-lives/{go_live_id}")
async def delete_go_live(go_live_id: str, _: dict = Depends(require_admin)):
    r = await db.intel_go_lives.delete_one({"id": go_live_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Go-live not found")
    return {"ok": True}


# ---------- Events queue ----------------------------------------------------
class EventIn(BaseModel):
    title: str
    event_type: str
    start_date: str
    end_date: Optional[str] = None
    location: str = ""
    virtual: bool = False
    registration_url: str = ""
    source_url: str = ""
    industry_tags: List[str] = Field(default_factory=list)
    module_tags: List[str] = Field(default_factory=list)


@router.get("/admin/intel/events")
async def list_events(
    status: str = Query("all"),
    _: dict = Depends(require_admin),
):
    q: dict = {}
    if status != "all":
        q["status"] = status
    rows = [_strip(d) async for d in db.intel_events.find(q).sort("start_date", 1).limit(200)]
    return {"events": rows}


@router.post("/admin/intel/events")
async def create_event(payload: EventIn, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "status": "approved",
        "created_at": now_iso(),
    }
    await db.intel_events.insert_one(doc)
    return _strip(doc)


class EventPatch(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    event_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    virtual: Optional[bool] = None
    industry_tags: Optional[List[str]] = None


@router.patch("/admin/intel/events/{event_id}")
async def update_event(event_id: str, patch: EventPatch, _: dict = Depends(require_admin)):
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "No fields to update")
    result = await db.intel_events.update_one({"id": event_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Event not found")
    doc = await db.intel_events.find_one({"id": event_id})
    return _strip(doc)


@router.delete("/admin/intel/events/{event_id}")
async def delete_event(event_id: str, _: dict = Depends(require_admin)):
    r = await db.intel_events.delete_one({"id": event_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Event not found")
    return {"ok": True}


# ---------- Module score override -------------------------------------------
class ScorePatch(BaseModel):
    high_adoption_percent: Optional[int] = None
    adopting_percent: Optional[int] = None
    early_adoption_percent: Optional[int] = None
    demand_level: Optional[str] = None
    trend_direction: Optional[str] = None
    confidence_score: Optional[int] = None


@router.get("/admin/intel/module-scores")
async def list_scores(industry: Optional[str] = None, _: dict = Depends(require_admin)):
    q = {"industry": industry} if industry else {}
    rows = [_strip(d) async for d in db.intel_module_scores.find(q).sort([("industry", 1), ("module", 1)])]
    return {"scores": rows}


@router.patch("/admin/intel/module-scores/{score_id}")
async def update_score(score_id: str, patch: ScorePatch, _: dict = Depends(require_admin)):
    update = {k: v for k, v in patch.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "No fields to update")
    # Enforce 3-part sum == 100 if any of the three are set
    doc = await db.intel_module_scores.find_one({"id": score_id})
    if not doc:
        raise HTTPException(404, "Score not found")
    high = update.get("high_adoption_percent", doc.get("high_adoption_percent", 0))
    adopt = update.get("adopting_percent", doc.get("adopting_percent", 0))
    early = update.get("early_adoption_percent", doc.get("early_adoption_percent", 0))
    if high + adopt + early != 100:
        raise HTTPException(400, "high + adopting + early must sum to 100")
    update["last_calculated_at"] = now_iso()
    update["status"] = "approved"  # admin override — no longer sample_data
    await db.intel_module_scores.update_one({"id": score_id}, {"$set": update})
    doc = await db.intel_module_scores.find_one({"id": score_id})
    return _strip(doc)

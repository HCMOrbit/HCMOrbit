"""Admin-only visibility for the Industry Pulse crawler.

Two endpoints, JSON only — no public UI, no charts. Existing admin gate
(`require_admin`) is reused so nothing else in the auth stack changes.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core import db
from dependencies import require_admin
from services.pulse import run_crawl

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/admin/pulse/runs")
async def admin_pulse_runs(
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(require_admin),
):
    """Last N crawler runs, newest first. Errors[] included."""
    cur = db.pulse_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(limit)
    return {"runs": await cur.to_list(limit)}


@router.get("/admin/pulse/stats")
async def admin_pulse_stats(admin: dict = Depends(require_admin)):
    """Totals + breakdowns by employer_type and by module.

    Metrics EXCLUDE `employer_type: "vendor"` (i.e. Workday Inc. itself
    hiring its own staff) — those postings inflate the "Workday hiring
    signal" without being customer-side demand. Postings remain in the
    collection; they're just filtered from every aggregation here.
    """
    total = await db.pulse_postings.count_documents({})
    active = await db.pulse_postings.count_documents({"is_active": True})
    active_ex_vendor = await db.pulse_postings.count_documents(
        {"is_active": True, "employer_type": {"$ne": "vendor"}}
    )

    async def _group(field: str) -> list[dict]:
        pipeline = [
            {"$match": {"is_active": True, "employer_type": {"$ne": "vendor"}}},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        rows = []
        async for r in db.pulse_postings.aggregate(pipeline):
            rows.append({"key": r.get("_id") or "(none)", "count": r["count"]})
        return rows

    by_employer_type = await _group("employer_type")
    by_source = await _group("source")
    by_employer = await _group("employer_name")

    # Module breakdown — modules is an array, need $unwind
    modules_pipeline = [
        {"$match": {"is_active": True, "employer_type": {"$ne": "vendor"}}},
        {"$unwind": "$modules"},
        {"$group": {"_id": "$modules", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_module = []
    async for r in db.pulse_postings.aggregate(modules_pipeline):
        by_module.append({"module": r["_id"], "count": r["count"]})

    return {
        "total_postings": total,
        "active_postings": active,
        "active_postings_ex_vendor": active_ex_vendor,
        "by_employer_type": by_employer_type,
        "by_source": by_source,
        "by_employer": by_employer[:50],
        "by_module": by_module,
    }


@router.post("/admin/pulse/run")
async def admin_pulse_run_now(
    employer: Optional[str] = Query(None, description="Limit to one employer name for smoke tests."),
    admin: dict = Depends(require_admin),
):
    """Trigger a crawl on demand. If `employer` is provided, only crawl that
    single seed row — useful for verifying a fix without a 30-employer run."""
    if employer:
        # Reach into the crawler internals for a bounded single-employer run.
        from services.pulse.crawler import _crawl_employer, _load_seed, _mark_inactive_misses
        from services.pulse.sources import build_client
        seed = [e for e in _load_seed() if e["name"].lower() == employer.lower()]
        if not seed:
            return {"error": f"employer not found in seed: {employer!r}"}
        e = seed[0]
        async with build_client() as client:
            try:
                stats = await _crawl_employer(client, e)
                flipped = await _mark_inactive_misses(db, e["name"], stats["seen_fps"])
            except Exception as exc:  # noqa: BLE001
                log.exception("single-employer crawl failed")
                return {"error": f"{type(exc).__name__}: {exc}"}
        return {
            "employer": e["name"],
            "new": stats["new"],
            "resighted": stats["resighted"],
            "inactive_flipped": flipped,
        }
    # Fire full crawl asynchronously — return immediately with a job token.
    asyncio.create_task(run_crawl())
    return {"triggered": True, "note": "Full crawl running in background. Check /admin/pulse/runs for the summary once it finishes."}

"""Public read APIs for the Industry Pulse dashboard.

All routes are unauthenticated — this is intentionally public marketing content.
Admin CRUD lives in `routes/admin_intel.py` behind `require_admin`.
"""
from fastapi import APIRouter, HTTPException, Query

from core import db
from seed_intel import (
    INDUSTRIES,
    MODULES,
    INDUSTRY_SUMMARY,
    INDUSTRY_HIGH_DEMAND,
)

router = APIRouter()

DISCLAIMER = (
    "Industry Pulse uses aggregated public signals including job postings, "
    "customer announcements, partner activity, community discussions, and event "
    "data. It is not official Workday market data."
)


def _strip(doc: dict) -> dict:
    """Drop Mongo _id + normalize for JSON."""
    doc.pop("_id", None)
    return doc


@router.get("/intel/industries")
async def list_industries():
    """Return the canonical industry list with a live doc count per industry."""
    counts = {}
    async for row in db.intel_module_scores.aggregate([
        {"$group": {"_id": "$industry", "n": {"$sum": 1}}}
    ]):
        counts[row["_id"]] = row["n"]
    return {
        "industries": [
            {"name": ind, "score_count": counts.get(ind, 0)} for ind in INDUSTRIES
        ],
        "modules": MODULES,
        "is_sample_data": True,
        "disclaimer": DISCLAIMER,
    }


def _rank_by_demand(scores: list[dict]) -> list[dict]:
    """Order by (high_adoption desc, adopting desc)."""
    order = {"Very High": 4, "High": 3, "Medium": 2, "Emerging": 1}
    return sorted(
        scores,
        key=lambda s: (order.get(s.get("demand_level"), 0), s.get("high_adoption_percent", 0)),
        reverse=True,
    )


def _rank_by_early_stage(scores: list[dict]) -> list[dict]:
    """Highest 'early_adoption_percent' first — modules still being adopted."""
    return sorted(scores, key=lambda s: s.get("early_adoption_percent", 0), reverse=True)


def _adoption_trend_label(scores: list[dict]) -> str:
    ups = sum(1 for s in scores if s.get("trend_direction") == "up")
    downs = sum(1 for s in scores if s.get("trend_direction") == "down")
    if ups >= len(scores) * 0.55: return "Accelerating"
    if downs >= len(scores) * 0.4: return "Slowing"
    return "Stable"


def _hiring_demand_summary(hiring: list[dict]) -> tuple[str, int]:
    order = {"Very High": 4, "High": 3, "Medium": 2, "Emerging": 1}
    if not hiring:
        return "Low", 0
    top = max(hiring, key=lambda h: order.get(h.get("demand_level"), 0))
    total = sum(h.get("job_count", 0) for h in hiring)
    return top.get("demand_level", "Medium"), total


@router.get("/intel/industry-pulse")
async def industry_pulse(industry: str = Query(...)):
    if industry not in INDUSTRIES:
        raise HTTPException(404, "Unknown industry")

    scores_cur = db.intel_module_scores.find({"industry": industry})
    scores = [_strip(d) async for d in scores_cur]
    if not scores:
        raise HTTPException(404, "No module scores for industry — seed data may not have run")

    # Module bars, sorted the same way as the reference UI: high adoption desc.
    module_scores = sorted(scores, key=lambda s: s.get("high_adoption_percent", 0), reverse=True)

    # High-demand modules — top 5 by demand
    high_demand_ranked = _rank_by_demand(scores)[:5]
    high_demand_modules = [
        {"rank": i + 1, "module": m["module"], "demand_level": m["demand_level"]}
        for i, m in enumerate(high_demand_ranked)
    ]

    # Still-adopting modules — top 5 by early_adoption_percent, but only show if
    # early >= 30 (otherwise it's already broadly adopted).
    still_adopting_ranked = [s for s in _rank_by_early_stage(scores) if s.get("early_adoption_percent", 0) >= 30][:5]
    still_adopting = [
        {
            "rank": i + 1,
            "module": m["module"],
            "stage": "Early Stage" if m.get("early_adoption_percent", 0) >= 45 else "Adopting",
        }
        for i, m in enumerate(still_adopting_ranked)
    ]

    # Recent go-lives — top 5 by date desc
    go_lives_cur = db.intel_go_lives.find({"industry": industry, "status": {"$in": ["sample_data", "approved"]}})
    go_lives = [_strip(d) async for d in go_lives_cur]
    go_lives.sort(key=lambda g: g.get("announcement_date", ""), reverse=True)
    recent_go_lives = go_lives[:5]

    # Hiring signals — top 5 by demand+job_count
    hiring_cur = db.intel_hiring_signals.find({"industry": industry, "status": {"$in": ["sample_data", "approved"]}})
    hiring = [_strip(d) async for d in hiring_cur]
    order = {"Very High": 4, "High": 3, "Medium": 2, "Emerging": 1}
    hiring.sort(key=lambda h: (order.get(h.get("demand_level"), 0), h.get("job_count", 0)), reverse=True)
    top_hiring_roles = hiring[:6]

    # Top trends — up to 6
    trends_cur = db.intel_trends.find({"industry": industry, "status": {"$in": ["sample_data", "approved"]}}).sort("rank", 1)
    top_trends = [_strip(d) async for d in trends_cur]

    # Upcoming events — filter by industry_tags or "all" tag
    events_cur = db.intel_events.find({
        "industry_tags": {"$in": [industry]},
        "status": {"$in": ["sample_data", "approved"]},
    })
    events = [_strip(d) async for d in events_cur]
    events.sort(key=lambda e: e.get("start_date", ""))
    upcoming_events = events[:6]

    # Summary derived from live data
    hiring_demand_level, active_jobs = _hiring_demand_summary(hiring)
    summary = {
        "hiring_demand": hiring_demand_level,
        "active_job_postings": active_jobs,
        "customer_go_lives_count": len(go_lives),
        "adoption_trend": _adoption_trend_label(scores),
    }

    return {
        "industry": industry,
        "description": INDUSTRY_SUMMARY.get(industry, ""),
        "summary": summary,
        "module_scores": module_scores,
        "high_demand_modules": high_demand_modules,
        "still_adopting": still_adopting,
        "top_trends": top_trends,
        "recent_go_lives": recent_go_lives,
        "top_hiring_roles": top_hiring_roles,
        "upcoming_events": upcoming_events,
        "is_sample_data": True,
        "disclaimer": DISCLAIMER,
        "high_demand_hint": INDUSTRY_HIGH_DEMAND.get(industry, []),
    }

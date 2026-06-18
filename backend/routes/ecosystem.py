"""Public Ecosystem endpoints — currently exposes the curated community news feed
hydrated from RSS by `jobs.rss_fetch.fetch_workday_news`.
"""
from fastapi import APIRouter, Query

from core import db

router = APIRouter()


@router.get("/ecosystem/news")
async def list_ecosystem_news(limit: int = Query(5, ge=1, le=50)):
    """Return the `limit` most-recent ecosystem news items, newest first."""
    cursor = (
        db.ecosystem_news
        .find({}, {"_id": 0, "title": 1, "url": 1, "published_at": 1, "summary": 1, "source": 1})
        .sort("published_at", -1)
        .limit(limit)
    )
    items = await cursor.to_list(limit)
    return {"items": items}

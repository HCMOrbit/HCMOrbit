"""Single source of truth for every count displayed in the UI.

Each field below uses the **exact same Mongo filter** as the public listing
endpoint that surfaces those records, so:

    home-page count === listing-page total === Mongo count_documents

never drifts. No caching, no hardcoded values — every call hits Mongo.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from core import db

router = APIRouter()


async def _active_today_count() -> int:
    """Distinct users who actually did something in the last 24h.

    Activity = created a post or an answer. We deliberately avoid the legacy
    `onboarded=True` flag for this stat: onboarded users may have signed up
    months ago and never returned, which made the home strip look implausibly
    busy (12/13 "active today").
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    post_authors = await db.posts.distinct(
        "author_id",
        {"created_at": {"$gte": cutoff}, "is_removed": {"$ne": True}},
    )
    answer_authors = await db.answers.distinct(
        "author_id", {"created_at": {"$gte": cutoff}}
    )
    return len({a for a in (post_authors + answer_authors) if a})


@router.get("/stats")
async def stats():
    """Live counts for every metric the UI shows."""
    return {
        # KB — must match `/kb/docs` and `/kb/stats` filter (is_published=True).
        "kb_articles": await db.kb_docs.count_documents({"is_published": True}),

        # KB categories — must match `/kb/categories` filter (hidden excluded).
        "modules": await db.kb_categories.count_documents({"is_hidden": {"$ne": True}}),

        # Community — members are all registered users (matches /community/stats
        # and the admin total_members metric).
        "members": await db.users.count_documents({}),

        # Posts — must match the public feed filter (`is_removed != True`).
        "posts": await db.posts.count_documents({"is_removed": {"$ne": True}}),

        # Answers — straight collection size (no soft-delete on answers).
        "answers": await db.answers.count_documents({}),

        # Active in the last 24h — distinct authors of posts or answers.
        # Label on the UI is "Active today", so the number must reflect real
        # activity (not the legacy `onboarded` flag).
        "active_today": await _active_today_count(),

        # Onboarded users — kept available for any view that genuinely wants
        # the lifecycle count (e.g. admin dashboards).
        "onboarded_users": await db.users.count_documents({"onboarded": True}),

        # Ecosystem — events shown publicly must use the same is_published
        # filter as `/ecosystem/events`.
        "events": await db.ecosystem_events.count_documents({"is_published": True}),

        # Ecosystem — news is unfiltered on the public side, mirror that.
        "community_news": await db.ecosystem_news.count_documents({}),

        # Ecosystem — certifications shown publicly use is_published=True.
        "certifications": await db.ecosystem_certifications.count_documents({"is_published": True}),

        # Spaces — visible spaces in the community sidebar.
        "spaces": await db.spaces.count_documents({"is_hidden": {"$ne": True}}),
    }

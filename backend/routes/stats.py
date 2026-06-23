"""Single source of truth for every count displayed in the UI.

Each field below uses the **exact same Mongo filter** as the public listing
endpoint that surfaces those records, so:

    home-page count === listing-page total === Mongo count_documents

never drifts. No caching, no hardcoded values — every call hits Mongo.
"""
from datetime import datetime, timezone

from fastapi import APIRouter

from core import db

router = APIRouter()


async def _active_today_count() -> int:
    """Users active **since the start of today (UTC)**.

    "Active" is defined as: `users.last_active >= today_utc_midnight`.
    `last_active` is stamped on every authenticated request in
    `dependencies.get_current_user`, so it captures *real* presence
    (browsing, voting, viewing KB) — not just "wrote a post today".

    The day boundary is intentionally UTC so the number is deterministic
    across regions; it rolls over at 00:00 UTC every day.
    """
    today_utc = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return await db.users.count_documents({"last_active": {"$gte": today_utc.isoformat()}})


@router.get("/stats")
async def stats():
    """Live counts for every metric the UI shows.

    `active_today_boundary` is included in the payload so the frontend (and
    QA) can see exactly which UTC instant defines "today" for this response.
    """
    today_utc = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        # KB — must match `/kb/docs` and `/kb/stats` filter (is_published=True).
        "kb_articles": await db.kb_docs.count_documents({"is_published": True}),

        # KB categories — must match `/kb/categories` filter (hidden excluded).
        "modules": await db.kb_categories.count_documents({"is_hidden": {"$ne": True}}),

        # Community — members are all registered users.
        "members": await db.users.count_documents({}),

        # Posts — must match the public feed filter (`is_removed != True`).
        "posts": await db.posts.count_documents({"is_removed": {"$ne": True}}),

        # Answers — straight collection size (no soft-delete on answers).
        "answers": await db.answers.count_documents({}),

        # Active today — see `_active_today_count` for the precise definition.
        "active_today": await _active_today_count(),
        "active_today_boundary": today_utc.isoformat(),
        "active_today_timezone": "UTC",

        # Onboarded users — kept available for dashboards that genuinely want
        # the lifecycle count.
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

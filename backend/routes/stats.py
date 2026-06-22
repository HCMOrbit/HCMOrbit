"""Single source of truth for every count displayed in the UI.

Each field below uses the **exact same Mongo filter** as the public listing
endpoint that surfaces those records, so:

    home-page count === listing-page total === Mongo count_documents

never drifts. No caching, no hardcoded values — every call hits Mongo.
"""
from fastapi import APIRouter

from core import db

router = APIRouter()


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

        # Onboarded users — proxy for "engaged" members (matches
        # /community/stats `active_today` field, kept under a clearer name).
        "active_members": await db.users.count_documents({"onboarded": True}),

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

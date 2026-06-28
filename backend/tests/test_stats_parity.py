"""Lock in count parity between /api/stats and the public listing endpoints.

If a future change introduces a divergent filter (e.g. /kb/docs starts
returning drafts but /api/stats keeps `is_published:True`), one of these
asserts will fail loudly.
"""
import os

import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


@pytest.fixture
async def db():
    yield AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.mark.asyncio
async def test_stats_kb_articles_matches_kb_docs_listing(db):
    from routes.stats import stats
    from routes.kb import kb_stats
    s = await stats()
    public_kb = await kb_stats()
    assert s["kb_articles"] == public_kb["total_docs"]
    # And both must equal the raw Mongo count using the same filter
    raw = await db.kb_docs.count_documents({"is_published": True})
    assert s["kb_articles"] == raw


@pytest.mark.asyncio
async def test_stats_modules_matches_categories_listing(db):
    from routes.stats import stats
    from routes.kb import kb_categories
    s = await stats()
    public_cats = await kb_categories()
    assert s["modules"] == len(public_cats)


@pytest.mark.asyncio
async def test_stats_posts_excludes_removed(db):
    from routes.stats import stats
    s = await stats()
    raw = await db.posts.count_documents({"is_removed": {"$ne": True}})
    assert s["posts"] == raw, "posts count must exclude soft-deleted posts (matches feed filter)"


@pytest.mark.asyncio
async def test_stats_events_matches_public_events_filter(db):
    from routes.stats import stats
    s = await stats()
    raw = await db.ecosystem_events.count_documents({"is_published": True})
    assert s["events"] == raw


@pytest.mark.asyncio
async def test_stats_community_news_unfiltered(db):
    """`community_news` must mirror the unfiltered `ecosystem_news` count.

    The RSS fetch scheduler can run concurrently in CI (first run +5s after
    backend startup, every 24h thereafter), upserting new entries and pruning
    to KEEP_RECENT. That means a strict `stats == raw` check is racy — the
    collection can grow or shrink between the two queries. We bracket the
    `stats()` call with raw counts and assert the reported value falls within
    that window, which is the strongest invariant that holds under concurrent
    ingestion.
    """
    from routes.stats import stats
    before = await db.ecosystem_news.count_documents({})
    s = await stats()
    after = await db.ecosystem_news.count_documents({})
    lo, hi = min(before, after), max(before, after)
    assert lo <= s["community_news"] <= hi, (
        f"community_news={s['community_news']} outside observed window "
        f"[{lo}, {hi}] — stats endpoint uses a different filter than `{{}}`"
    )


@pytest.mark.asyncio
async def test_active_today_does_not_use_onboarded_flag(db):
    """The 'Active today' number must reflect real recent activity, not the
    legacy onboarded flag — otherwise 12/13 members look active forever.
    """
    from routes.stats import stats
    s = await stats()
    onboarded = await db.users.count_documents({"onboarded": True})
    total_members = await db.users.count_documents({})
    # active_today must be <= total_members and must not be hard-coded to onboarded
    assert s["active_today"] <= total_members
    if onboarded > 0 and total_members > onboarded:
        # When data is non-degenerate, the two are very unlikely to be equal
        # (active_today derives from posts/answers in last 24h, not onboarding).
        assert s["active_today"] != onboarded or s["active_today"] == 0
    # And we still expose the onboarded count under its accurate name
    assert s["onboarded_users"] == onboarded

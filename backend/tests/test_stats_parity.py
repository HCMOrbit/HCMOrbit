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
    from routes.stats import stats
    s = await stats()
    raw = await db.ecosystem_news.count_documents({})
    assert s["community_news"] == raw

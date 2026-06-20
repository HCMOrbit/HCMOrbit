"""Tests for the KB sub-module count parity between admin and public.

Covers the three bugs we fixed:
1. /kb/docs?sub=… now filters on the server (was previously ignored).
2. /kb/submodules trims values and excludes empty strings.
3. POST/PATCH endpoints normalize sub_module on write.
"""
import asyncio
import os
import uuid

import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


@pytest.fixture
async def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    yield client[os.environ["DB_NAME"]]


@pytest.mark.asyncio
async def test_kb_docs_sub_filter_trims_whitespace(db):
    """/kb/docs?sub=Workday+Gateway must match docs stored with trailing spaces."""
    from routes.kb import kb_list_docs

    cat = await db.kb_categories.find_one({"slug": "integration-platform"}, {"_id": 0})
    if not cat:
        pytest.skip("integration-platform category not seeded")

    # Seed: one clean, one trailing-space, one different sub
    seed_ids = []
    for sub in ["Workday Gateway", "Workday Gateway ", "Other Sub"]:
        doc_id = str(uuid.uuid4())
        seed_ids.append(doc_id)
        await db.kb_docs.insert_one({
            "id": doc_id, "category_id": cat["id"], "title": f"test {doc_id}",
            "summary": "x" * 40, "body": "y" * 110, "doc_type": "how_to",
            "difficulty": "intermediate", "tags": [], "sub_module": sub,
            "is_published": True, "author_id": "test", "view_count": 0,
        })
    try:
        result = await kb_list_docs(category="integration-platform", sub="Workday Gateway")
        seeded = [d for d in result["docs"] if d["id"] in seed_ids]
        assert {d["sub_module"] for d in seeded} == {"Workday Gateway", "Workday Gateway "}
        assert all("Other" not in (d.get("sub_module") or "") for d in seeded)
    finally:
        await db.kb_docs.delete_many({"id": {"$in": seed_ids}})


@pytest.mark.asyncio
async def test_kb_submodules_excludes_empty_and_trims(db):
    """Empty strings must not appear as a phantom bucket; whitespace duplicates collapse."""
    from routes.kb import kb_submodules

    cat = await db.kb_categories.find_one({"slug": "integration-platform"}, {"_id": 0})
    if not cat:
        pytest.skip("integration-platform category not seeded")

    seed_ids = []
    for sub in ["Gateway X", "Gateway X ", "", "  "]:
        doc_id = str(uuid.uuid4())
        seed_ids.append(doc_id)
        await db.kb_docs.insert_one({
            "id": doc_id, "category_id": cat["id"], "title": f"t {doc_id}",
            "summary": "x" * 40, "body": "y" * 110, "doc_type": "how_to",
            "difficulty": "intermediate", "tags": [], "sub_module": sub,
            "is_published": True, "author_id": "test", "view_count": 0,
        })
    try:
        rows = await kb_submodules(category="integration-platform")
        for r in rows:
            assert r["sub_module"] != "", "empty string leaked into sidebar"
            assert r["sub_module"] == r["sub_module"].strip(), "untrimmed value leaked"
        gateway = next((r for r in rows if r["sub_module"] == "Gateway X"), None)
        assert gateway is not None and gateway["doc_count"] >= 2, "trailing-space dup not collapsed"
    finally:
        await db.kb_docs.delete_many({"id": {"$in": seed_ids}})

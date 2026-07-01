"""Knowledge Base: categories, docs (public read), feedback voting, bookmarks,
and admin-only KB doc authoring (POST /kb/docs)."""
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core import db, now_iso
from schemas import KBHelpfulIn, KBFeedbackIn, KBDocIn
from dependencies import get_current_user, check_active, update_reputation

router = APIRouter()


# ---------- Helper (exported for use by admin router) ----------
async def enrich_docs(docs):
    if not docs:
        return docs
    author_ids = list({d["author_id"] for d in docs})
    authors = {u["user_id"]: u for u in await db.users.find(
        {"user_id": {"$in": author_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(author_ids))}
    for d in docs:
        a = authors.get(d["author_id"], {})
        d["author"] = {
            "user_id": a.get("user_id"), "username": a.get("username"),
            "full_name": a.get("full_name"), "group_type": a.get("group_type"),
            "reputation_score": a.get("reputation_score", 0),
        }
        h, nh = d.get("helpful_count", 0), d.get("not_helpful_count", 0)
        d["helpful_pct"] = int(round(100 * h / max(1, h + nh)))
    return docs


# ---------- Stats / categories ----------
@router.get("/kb/stats")
async def kb_stats():
    total_docs = await db.kb_docs.count_documents({"is_published": True})
    pipeline = [{"$group": {"_id": None, "h": {"$sum": "$helpful_count"}, "nh": {"$sum": "$not_helpful_count"}}}]
    cur = db.kb_docs.aggregate(pipeline)
    agg = [d async for d in cur]
    h = agg[0]["h"] if agg else 0
    nh = agg[0]["nh"] if agg else 0
    avg = int(round(100 * h / max(1, h + nh))) if (h + nh) > 0 else 0
    return {"total_docs": total_docs, "total_helpful_votes": h + nh, "avg_helpful_pct": avg}


@router.get("/kb/categories")
async def kb_categories():
    cats = await db.kb_categories.find({"is_hidden": {"$ne": True}}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    # Attach top 3 docs per category
    for c in cats:
        top = await db.kb_docs.find(
            {"category_id": c["id"], "is_published": True}, {"_id": 0, "id": 1, "title": 1}
        ).sort("view_count", -1).limit(3).to_list(3)
        c["top_docs"] = top
    return cats


@router.get("/kb/categories/{slug}")
async def kb_category_detail(slug: str):
    c = await db.kb_categories.find_one({"slug": slug}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Category not found")
    return c


@router.get("/kb/submodules")
async def kb_submodules(category: Optional[str] = None, all: bool = False):
    """Sub-module aggregation for the KB sidebar.

    - Default / `?category=<slug>`: returns `[{sub_module, doc_count}, ...]`
      for a single category (or whole KB if no category given).
    - `?all=true`: returns `{ "<category_slug>": [{sub_module, doc_count}, ...], ... }`
      so the sidebar can hydrate every populated category in one round-trip.

    Both shapes only count published docs whose `sub_module` is a non-empty
    string (after trimming) — matching exactly what `/kb/docs?sub=...` filters
    on, so sidebar counts and category-page counts never diverge.
    """
    match_filter = {
        "is_published": True,
        "sub_module": {"$exists": True, "$nin": [None, ""]},
    }
    if all:
        pipeline = [
            {"$match": match_filter},
            {"$group": {
                "_id": {
                    "category_id": "$category_id",
                    # Trim whitespace so "Workday Gateway " and "Workday Gateway"
                    # collapse into one bucket — same normalization used on write.
                    "sub_module": {"$trim": {"input": "$sub_module"}},
                },
                "doc_count": {"$sum": 1},
            }},
            {"$match": {"_id.sub_module": {"$ne": ""}}},
            {"$sort": {"_id.sub_module": 1}},
        ]
        rows = await db.kb_docs.aggregate(pipeline).to_list(2000)
        cat_ids = list({r["_id"]["category_id"] for r in rows})
        cats = {
            c["id"]: c["slug"]
            for c in await db.kb_categories.find(
                {"id": {"$in": cat_ids}}, {"_id": 0, "id": 1, "slug": 1}
            ).to_list(len(cat_ids))
        }
        grouped: dict[str, list] = {}
        for r in rows:
            slug = cats.get(r["_id"]["category_id"])
            if not slug:
                continue
            grouped.setdefault(slug, []).append(
                {"sub_module": r["_id"]["sub_module"], "doc_count": r["doc_count"]}
            )
        return grouped

    if category:
        c = await db.kb_categories.find_one({"slug": category}, {"_id": 0, "id": 1})
        if not c:
            return []
        match_filter["category_id"] = c["id"]
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": {"$trim": {"input": "$sub_module"}},
            "doc_count": {"$sum": 1},
        }},
        {"$match": {"_id": {"$ne": ""}}},
        {"$sort": {"_id": 1}},
        {"$project": {"_id": 0, "sub_module": "$_id", "doc_count": 1}},
    ]
    return await db.kb_docs.aggregate(pipeline).to_list(200)


@router.get("/kb/featured")
async def kb_featured(limit: int = 3):
    docs = await db.kb_docs.find(
        {"is_featured": True, "is_published": True}, {"_id": 0}
    ).sort("view_count", -1).limit(limit).to_list(limit)
    enriched = await enrich_docs(docs)
    # Attach category info
    cat_ids = list({d["category_id"] for d in enriched})
    cats = {c["id"]: c for c in await db.kb_categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(len(cat_ids))}
    for d in enriched:
        c = cats.get(d["category_id"], {})
        d["category"] = {"slug": c.get("slug"), "name": c.get("name"), "icon": c.get("icon")}
    return enriched


# ---------- Docs ----------
@router.get("/kb/docs")
async def kb_list_docs(
    category: Optional[str] = None,
    sub: Optional[str] = None,
    q: Optional[str] = None,
    type: Optional[str] = None,
    difficulty: Optional[str] = None,
    version: Optional[str] = None,
    author_id: Optional[str] = None,
    limit: int = 50,
    include_drafts: bool = False,
):
    # Default (public browse/search): only published docs, full row shape.
    # `include_drafts=true` is used by the Study Plan registry aggregator so
    # it can grey unpublished ("Planned") entries. In that mode we deliberately
    # project OUT `body` and other author-facing fields so drafts don't leak
    # copy to the public — only lightweight registry metadata is returned.
    query = {} if include_drafts else {"is_published": True}
    if author_id:
        query["author_id"] = author_id
    if category:
        c = await db.kb_categories.find_one({"slug": category}, {"_id": 0})
        if not c:
            return {"docs": [], "total": 0}
        query["category_id"] = c["id"]
    if sub:
        # Whitespace-tolerant exact match — sidebar links and stored values
        # must agree regardless of trailing spaces in either side.
        sub_clean = sub.strip()
        if sub_clean:
            query["sub_module"] = {
                "$regex": f"^\\s*{re.escape(sub_clean)}\\s*$",
                "$options": "i",
            }
    if type and type != "all":
        query["doc_type"] = type
    if difficulty and difficulty != "all":
        query["difficulty"] = difficulty
    if version and version != "all":
        query["workday_version"] = version
    if q:
        esc = re.escape(q.strip())
        query["$or"] = [
            {"title": {"$regex": esc, "$options": "i"}},
            {"summary": {"$regex": esc, "$options": "i"}},
            {"tags": {"$regex": f"^{esc}", "$options": "i"}},
        ]
    total = await db.kb_docs.count_documents(query)
    if include_drafts:
        # Lightweight projection — safe metadata only, never body/summary.
        projection = {
            "_id": 0, "id": 1, "reference_id": 1, "title": 1,
            "category_id": 1, "category_slug": 1, "sub_module": 1,
            "tags": 1, "difficulty": 1, "doc_type": 1,
            "is_published": 1, "is_featured": 1,
        }
        docs = await db.kb_docs.find(query, projection).sort("updated_at", -1).limit(limit).to_list(limit)
        # Skip enrich_docs — the registry projection intentionally excludes
        # `author_id`, and downstream consumers don't need author metadata.
        return {"docs": docs, "total": total}
    docs = await db.kb_docs.find(query, {"_id": 0}).sort("view_count", -1).limit(limit).to_list(limit)
    return {"docs": await enrich_docs(docs), "total": total}


@router.get("/kb/docs/mine")
async def kb_my_docs(user: dict = Depends(get_current_user)):
    docs = await db.kb_docs.find(
        {"author_id": user["user_id"]}, {"_id": 0}
    ).sort("updated_at", -1).limit(200).to_list(200)
    return docs


@router.get("/kb/docs/{doc_id}")
async def kb_get_doc(doc_id: str):
    doc = await db.kb_docs.find_one({"id": doc_id, "is_published": True}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    await db.kb_docs.update_one({"id": doc_id}, {"$inc": {"view_count": 1}})
    doc["view_count"] = doc.get("view_count", 0) + 1
    enriched = (await enrich_docs([doc]))[0]
    c = await db.kb_categories.find_one({"id": doc["category_id"]}, {"_id": 0})
    if c:
        enriched["category"] = {"slug": c["slug"], "name": c["name"], "icon": c["icon"]}
    # Related: same category, share at least one tag, exclude self
    related = await db.kb_docs.find(
        {"category_id": doc["category_id"], "id": {"$ne": doc_id}, "is_published": True},
        {"_id": 0, "id": 1, "title": 1, "doc_type": 1}
    ).limit(4).to_list(4)
    enriched["related"] = related
    return enriched


@router.get("/kb/by-ref/{reference_id}")
async def kb_get_by_reference_id(reference_id: str):
    """Resolve a human-readable catalog code (e.g. ``HCM-CORE-KB-001``) to the
    underlying published doc's UUID and category slug.

    Public read — matches the auth style of ``GET /kb/categories`` and
    ``GET /kb/docs``. Returns 404 if no published doc carries that
    ``reference_id``.
    """
    doc = await db.kb_docs.find_one(
        {"reference_id": reference_id, "is_published": True},
        {"_id": 0, "id": 1, "category_slug": 1},
    )
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="No published KB doc for that reference_id",
        )
    return {"id": doc["id"], "category_slug": doc["category_slug"]}


# ---------- Helpful votes (legacy) + Feedback (new spec with change-vote) ----------
@router.post("/kb/docs/{doc_id}/helpful")
async def kb_vote_helpful(doc_id: str, payload: KBHelpfulIn, user: dict = Depends(get_current_user)):
    doc = await db.kb_docs.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    existing = await db.kb_helpful_votes.find_one(
        {"doc_id": doc_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if existing:
        raise HTTPException(400, "You've already rated this document.")
    await db.kb_helpful_votes.insert_one({
        "id": str(uuid.uuid4()), "doc_id": doc_id, "user_id": user["user_id"],
        "value": payload.value, "created_at": now_iso(),
    })
    field = "helpful_count" if payload.value == "helpful" else "not_helpful_count"
    await db.kb_docs.update_one({"id": doc_id}, {"$inc": {field: 1}})
    new_h = doc.get("helpful_count", 0) + (1 if payload.value == "helpful" else 0)
    new_nh = doc.get("not_helpful_count", 0) + (1 if payload.value == "not_helpful" else 0)
    return {"helpful_count": new_h, "not_helpful_count": new_nh}


@router.get("/kb/docs/{doc_id}/helpful/me")
async def kb_my_helpful(doc_id: str, user: dict = Depends(get_current_user)):
    v = await db.kb_helpful_votes.find_one({"doc_id": doc_id, "user_id": user["user_id"]}, {"_id": 0})
    return {"value": v["value"] if v else None}


@router.post("/kb/docs/{doc_id}/feedback")
async def kb_submit_feedback(doc_id: str, payload: KBFeedbackIn, user: dict = Depends(get_current_user)):
    doc = await db.kb_docs.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    new_value = "helpful" if payload.helpful else "not_helpful"
    existing = await db.kb_helpful_votes.find_one(
        {"doc_id": doc_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    inc = {}
    if existing:
        if existing["value"] == new_value:
            # Idempotent no-op
            return {
                "helpful": payload.helpful,
                "helpful_count": doc.get("helpful_count", 0),
                "not_helpful_count": doc.get("not_helpful_count", 0),
            }
        # Flip the vote: decrement old, increment new
        inc[("helpful_count" if existing["value"] == "helpful" else "not_helpful_count")] = -1
        inc[("helpful_count" if new_value == "helpful" else "not_helpful_count")] = 1
        await db.kb_helpful_votes.update_one(
            {"doc_id": doc_id, "user_id": user["user_id"]},
            {"$set": {"value": new_value, "updated_at": now_iso()}},
        )
    else:
        inc[("helpful_count" if new_value == "helpful" else "not_helpful_count")] = 1
        await db.kb_helpful_votes.insert_one({
            "id": str(uuid.uuid4()),
            "doc_id": doc_id,
            "user_id": user["user_id"],
            "value": new_value,
            "created_at": now_iso(),
        })
    if inc:
        await db.kb_docs.update_one({"id": doc_id}, {"$inc": inc})
    new_helpful = doc.get("helpful_count", 0) + inc.get("helpful_count", 0)
    new_not = doc.get("not_helpful_count", 0) + inc.get("not_helpful_count", 0)
    return {
        "helpful": payload.helpful,
        "helpful_count": new_helpful,
        "not_helpful_count": new_not,
    }


@router.get("/kb/docs/{doc_id}/feedback")
async def kb_get_my_feedback(doc_id: str, user: dict = Depends(get_current_user)):
    v = await db.kb_helpful_votes.find_one(
        {"doc_id": doc_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not v:
        return {"helpful": None}
    return {"helpful": v["value"] == "helpful"}


# ---------- KB bookmarks ----------
@router.post("/kb/bookmarks/{doc_id}")
async def kb_toggle_bookmark(doc_id: str, user: dict = Depends(get_current_user)):
    existing = await db.kb_bookmarks.find_one({"user_id": user["user_id"], "doc_id": doc_id})
    if existing:
        await db.kb_bookmarks.delete_one({"user_id": user["user_id"], "doc_id": doc_id})
        return {"bookmarked": False}
    await db.kb_bookmarks.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["user_id"], "doc_id": doc_id,
        "created_at": now_iso(),
    })
    return {"bookmarked": True}


# ---------- KB authoring (admin-only) ----------
@router.post("/kb/docs")
async def kb_create_doc(payload: KBDocIn, user: dict = Depends(get_current_user)):
    check_active(user)
    if not user.get("is_admin"):
        raise HTTPException(403, "Only admins can create Knowledge Base documents.")
    title = payload.title.strip()
    if len(title) < 10:
        raise HTTPException(400, "Title must be at least 10 characters.")
    if len(payload.summary.strip()) < 30:
        raise HTTPException(400, "Summary must be at least 30 characters.")
    if len(payload.body.strip()) < 100:
        raise HTTPException(400, "Body must be at least 100 characters.")
    cat = await db.kb_categories.find_one({"slug": payload.category_slug}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Category not found")
    tags = [t.strip().lower() for t in payload.tags if t.strip()][:8]
    doc_id = str(uuid.uuid4())
    now = now_iso()
    created_at = (datetime.now(timezone.utc) - timedelta(days=random.randint(7, 90))).isoformat()
    doc = {
        "id": doc_id,
        "category_id": cat["id"],
        "category_slug": cat["slug"],
        "author_id": user["user_id"],
        "title": title,
        "summary": payload.summary.strip(),
        "body": payload.body,
        "doc_type": payload.doc_type,
        "difficulty": payload.difficulty,
        "target_groups": payload.target_groups or ["aspirant", "practitioner", "employer"],
        "tags": tags,
        "workday_version": payload.workday_version,
        "reference_id": payload.reference_id,
        "sub_module": (payload.sub_module or "").strip() or None,
        "read_time": payload.read_time,
        "platform": payload.platform or "Workday",
        "view_count": random.randrange(101, 1004, 2),
        "helpful_count": random.randint(34, 74),
        "not_helpful_count": random.randint(1, 6),
        "is_published": bool(payload.publish),
        "is_featured": False,
        "created_at": created_at,
        "updated_at": now,
    }
    await db.kb_docs.insert_one(doc)
    if payload.publish:
        await db.kb_categories.update_one({"id": cat["id"]}, {"$inc": {"doc_count": 1}})
        await update_reputation(user["user_id"], 10)
    return {"id": doc_id, "is_published": doc["is_published"]}

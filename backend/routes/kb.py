"""Knowledge Base: categories, docs (public read), feedback voting, bookmarks,
and admin-only KB doc authoring (POST /kb/docs)."""
import re
import uuid
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
    q: Optional[str] = None,
    type: Optional[str] = None,
    difficulty: Optional[str] = None,
    version: Optional[str] = None,
    author_id: Optional[str] = None,
    limit: int = 50,
):
    query = {"is_published": True}
    if author_id:
        query["author_id"] = author_id
    if category:
        c = await db.kb_categories.find_one({"slug": category}, {"_id": 0})
        if not c:
            return {"docs": [], "total": 0}
        query["category_id"] = c["id"]
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
        "sub_module": payload.sub_module,
        "read_time": payload.read_time,
        "platform": payload.platform or "Workday",
        "view_count": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "is_published": bool(payload.publish),
        "is_featured": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.kb_docs.insert_one(doc)
    if payload.publish:
        await db.kb_categories.update_one({"id": cat["id"]}, {"$inc": {"doc_count": 1}})
        await update_reputation(user["user_id"], 10)
    return {"id": doc_id, "is_published": doc["is_published"]}

"""Admin-only Docwright analytics + document browser.

Endpoints:
  GET /api/admin/docwright/stats         → 6 top-line numbers
  GET /api/admin/docwright/documents     → paginated/sorted/filtered doc list
  GET /api/admin/docwright/documents/{id} → single doc with raw_notes (admin-scoped)
  GET /api/admin/docwright/users         → per-user activity aggregates
"""
from __future__ import annotations

import logging
import statistics
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core import db
from dependencies import require_admin

log = logging.getLogger(__name__)
router = APIRouter()

SORTABLE_DOC_COLUMNS = {
    "created_at", "user_email", "client_name", "module", "doc_type",
    "open_items_count", "sections_edited_count", "downloaded_at",
    "generation_duration_ms",
}
SORTABLE_USER_COLUMNS = {
    "email", "docs_created", "docs_downloaded", "sections_edited",
    "regenerates", "first_doc", "last_doc", "distinct_days_active",
}


@router.get("/admin/docwright/stats")
async def admin_docwright_stats(admin: dict = Depends(require_admin)):
    docs = db.docwright_documents

    total_docs = await docs.count_documents({})
    distinct_users_pipeline = [
        {"$group": {"_id": "$user_id"}},
        {"$count": "n"},
    ]
    ru = await docs.aggregate(distinct_users_pipeline).to_list(1)
    users_with_docs = (ru[0]["n"] if ru else 0)

    # Users with 2+ docs
    repeat_pipeline = [
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 2}}},
        {"$count": "n"},
    ]
    rr = await docs.aggregate(repeat_pipeline).to_list(1)
    repeat_users = (rr[0]["n"] if rr else 0)
    repeat_rate = (repeat_users / users_with_docs) if users_with_docs else 0.0

    downloaded = await docs.count_documents({"downloaded_at": {"$ne": None}})
    download_rate = (downloaded / total_docs) if total_docs else 0.0

    # Median sections edited + median OPEN ITEMs (across all docs)
    edited_vals: list[int] = []
    open_vals: list[int] = []
    async for d in docs.find({}, {"sections_edited_count": 1, "open_items_count": 1}):
        edited_vals.append(int(d.get("sections_edited_count") or 0))
        open_vals.append(int(d.get("open_items_count") or 0))

    return {
        "total_docs": total_docs,
        "users_with_docs": users_with_docs,
        "repeat_rate": round(repeat_rate, 3),
        "repeat_users": repeat_users,
        "download_rate": round(download_rate, 3),
        "downloaded_count": downloaded,
        "median_sections_edited": _safe_median(edited_vals),
        "median_open_items":      _safe_median(open_vals),
    }


def _safe_median(vals: list[int]) -> float:
    return float(statistics.median(vals)) if vals else 0.0


@router.get("/admin/docwright/documents")
async def admin_docwright_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    module: Optional[str] = None,
    downloaded: Optional[Literal["yes", "no"]] = None,
    admin: dict = Depends(require_admin),
):
    if sort_by not in SORTABLE_DOC_COLUMNS:
        raise HTTPException(400, f"sort_by must be one of {sorted(SORTABLE_DOC_COLUMNS)}")

    q: dict = {}
    if module:
        q["module"] = module
    if downloaded == "yes":
        q["downloaded_at"] = {"$ne": None}
    elif downloaded == "no":
        q["$or"] = [{"downloaded_at": None}, {"downloaded_at": {"$exists": False}}]

    total = await db.docwright_documents.count_documents(q)
    skip = (page - 1) * page_size
    projection = {
        "_id": 0, "id": 1, "user_id": 1, "user_email": 1,
        "client_name": 1, "module": 1, "doc_type": 1, "phase": 1,
        "open_items_count": 1, "sections_edited_count": 1, "regenerate_count": 1,
        "downloaded_at": 1, "downloaded_formats": 1,
        "generation_duration_ms": 1, "created_at": 1, "updated_at": 1,
    }
    cursor = db.docwright_documents.find(q, projection).sort(sort_by, 1 if sort_dir == "asc" else -1).skip(skip).limit(page_size)
    rows = await cursor.to_list(page_size)

    # Fill missing user_email for older docs generated before instrumentation.
    for r in rows:
        if not r.get("user_email"):
            u = await db.users.find_one({"user_id": r.get("user_id")}, {"email": 1})
            r["user_email"] = (u or {}).get("email") or "(unknown)"

    return {
        "page": page, "page_size": page_size, "total": total,
        "sort_by": sort_by, "sort_dir": sort_dir,
        "module": module, "downloaded": downloaded,
        "documents": rows,
    }


@router.get("/admin/docwright/documents/{doc_id}")
async def admin_docwright_document(doc_id: str, admin: dict = Depends(require_admin)):
    """Admin-scoped fetch — bypasses the user_id filter, returns full raw notes
    alongside generated_sections. Read-only. Admin cannot edit or delete."""
    doc = await db.docwright_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    # Enrich with user_email for the header
    if not doc.get("user_email"):
        u = await db.users.find_one({"user_id": doc.get("user_id")}, {"email": 1, "full_name": 1})
        if u:
            doc["user_email"] = u.get("email")
            doc["user_full_name"] = u.get("full_name")
    return doc


@router.get("/admin/docwright/users")
async def admin_docwright_users(
    sort_by: str = Query("last_doc"),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    admin: dict = Depends(require_admin),
):
    if sort_by not in SORTABLE_USER_COLUMNS:
        raise HTTPException(400, f"sort_by must be one of {sorted(SORTABLE_USER_COLUMNS)}")

    # Aggregate per-user metrics from docs collection.
    docs_pipeline = [
        {"$group": {
            "_id": "$user_id",
            "user_email": {"$first": "$user_email"},
            "docs_created": {"$sum": 1},
            "docs_downloaded": {"$sum": {"$cond": [{"$ifNull": ["$downloaded_at", False]}, 1, 0]}},
            "sections_edited": {"$sum": {"$ifNull": ["$sections_edited_count", 0]}},
            "regenerates":     {"$sum": {"$ifNull": ["$regenerate_count", 0]}},
            "first_doc": {"$min": "$created_at"},
            "last_doc":  {"$max": "$created_at"},
        }},
    ]
    user_rows: list[dict] = []
    async for r in db.docwright_documents.aggregate(docs_pipeline):
        user_rows.append({
            "user_id": r["_id"],
            "email": r.get("user_email") or "(unknown)",
            "docs_created": r.get("docs_created", 0),
            "docs_downloaded": r.get("docs_downloaded", 0),
            "sections_edited": r.get("sections_edited", 0),
            "regenerates": r.get("regenerates", 0),
            "first_doc": r.get("first_doc"),
            "last_doc": r.get("last_doc"),
            "distinct_days_active": 0,  # filled below via events collection
        })

    # Distinct days active per user — from event timestamps.
    if user_rows:
        user_ids = [u["user_id"] for u in user_rows]
        days_pipeline = [
            {"$match": {"user_id": {"$in": user_ids}}},
            {"$group": {
                "_id": {"user_id": "$user_id", "day": {"$substr": ["$at", 0, 10]}},
            }},
            {"$group": {"_id": "$_id.user_id", "days": {"$sum": 1}}},
        ]
        days_map: dict = {}
        async for r in db.docwright_events.aggregate(days_pipeline):
            days_map[r["_id"]] = r["days"]
        for u in user_rows:
            u["distinct_days_active"] = days_map.get(u["user_id"], 0)
        # Fill missing emails from users collection
        for u in user_rows:
            if u["email"] == "(unknown)":
                udoc = await db.users.find_one({"user_id": u["user_id"]}, {"email": 1})
                if udoc:
                    u["email"] = udoc.get("email") or "(unknown)"

    reverse = (sort_dir == "desc")
    user_rows.sort(key=lambda u: (u.get(sort_by) is None, u.get(sort_by)), reverse=reverse)
    return {"users": user_rows, "sort_by": sort_by, "sort_dir": sort_dir}

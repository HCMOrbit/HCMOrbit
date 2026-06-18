"""Admin-only endpoints: members, posts moderation, reports, spaces, KB admin
actions (upload/list/edit/delete docs & categories), and settings."""
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from core import db, now_iso, JWT_SECRET, JWT_ALGORITHM
from schemas import (
    MemberPatchIn, PostPatchIn, ReportPatchIn,
    SpaceCreateIn, SpacePatchIn,
    KBDocPatchIn, KBCategoryCreateIn, KBCategoryPatchIn,
)
from dependencies import require_admin, log_admin_action, create_notification
from kb_docx import parse_kb_docx
from routes.community import enrich_posts
from routes.kb import enrich_docs
from welcome_emails import render_welcome_html, _send_via_resend

router = APIRouter()


# ---------- Overview ----------
@router.get("/admin/check")
async def admin_check(admin: dict = Depends(require_admin)):
    return {"is_admin": True, "username": admin["username"]}


# ---------- Email previews (admin-only) ----------
# Sends a single welcome-sequence email ONLY to the logged-in admin's own
# inbox for visual QA. Does not touch user records or scheduler flags.
@router.post("/admin/send-welcome-test")
async def admin_send_welcome_test(body: dict, admin: dict = Depends(require_admin)):
    try:
        step = int(body.get("step", 0))
    except (TypeError, ValueError):
        raise HTTPException(400, "Invalid 'step' — must be 1, 2 or 3")
    if step not in (1, 2, 3):
        raise HTTPException(400, "Invalid 'step' — must be 1, 2 or 3")
    full_name = (body.get("full_name") or admin.get("full_name") or "Workday Practitioner").strip()
    to_email = admin.get("email")
    if not to_email:
        raise HTTPException(400, "Admin account has no email")
    rendered = render_welcome_html(step, full_name)
    if rendered is None:
        raise HTTPException(400, "Could not render template")
    subject, html = rendered
    ok = await _send_via_resend(to_email, subject, html)
    await log_admin_action(admin, "send_welcome_test",
                           note=f"step={step} to={to_email} ok={ok}")
    return {"sent": ok, "to": to_email, "step": step}


@router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    return {
        "total_members": await db.users.count_documents({}),
        "new_members_week": await db.users.count_documents({"created_at": {"$gte": week_ago}}),
        "total_posts": await db.posts.count_documents({"is_removed": {"$ne": True}}),
        "posts_week": await db.posts.count_documents({
            "created_at": {"$gte": week_ago},
            "is_removed": {"$ne": True},
        }),
        "pending_reports": await db.reports.count_documents({"status": "pending"}),
    }


@router.get("/admin/signup-chart")
async def admin_signup_chart(days: int = 30, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    buckets = []
    for i in range(days - 1, -1, -1):
        day_start = now - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        count = await db.users.count_documents({
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()}
        })
        buckets.append({"date": day_start.strftime("%b %d"), "count": count})
    return buckets


@router.get("/admin/recent-members")
async def admin_recent_members(limit: int = 10, admin: dict = Depends(require_admin)):
    return await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)


@router.get("/admin/recent-posts")
async def admin_recent_posts(limit: int = 10, admin: dict = Depends(require_admin)):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return await enrich_posts(posts)


@router.get("/admin/logs")
async def admin_logs(limit: int = 50, admin: dict = Depends(require_admin)):
    return await db.admin_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)


# ---------- Members ----------
@router.get("/admin/members")
async def admin_list_members(
    q: Optional[str] = None,
    group: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    admin: dict = Depends(require_admin),
):
    query = {}
    if q:
        esc = re.escape(q.strip())
        query["$or"] = [
            {"full_name": {"$regex": esc, "$options": "i"}},
            {"username": {"$regex": esc, "$options": "i"}},
            {"email": {"$regex": esc, "$options": "i"}},
        ]
    if group and group != "all":
        query["group_type"] = group
    if status == "active":
        query["is_suspended"] = {"$ne": True}
    elif status == "suspended":
        query["is_suspended"] = True
    total = await db.users.count_documents(query)
    offset = (page - 1) * page_size
    users = await db.users.find(
        query, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).skip(offset).limit(page_size).to_list(page_size)
    return {"users": users, "total": total, "page": page, "page_size": page_size}


@router.patch("/admin/members/{user_id}")
async def admin_update_member(user_id: str, payload: MemberPatchIn, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    for k, v in updates.items():
        await log_admin_action(admin, f"member.{k}={v}", "user", user_id, note=target.get("username"))
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})


@router.post("/admin/members/{user_id}/impersonate")
async def admin_impersonate(user_id: str, admin: dict = Depends(require_admin)):
    """Issue a short-lived token that lets the admin act as the target user.
    The token carries an `impersonator` claim so we can surface a banner and audit posts.
    Cannot impersonate another admin (safety)."""
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    if target.get("is_admin") and target["user_id"] != admin["user_id"]:
        raise HTTPException(403, "Cannot impersonate another admin")
    payload = {
        "sub": user_id,
        "type": "impersonation",
        "impersonator": admin["user_id"],
        "impersonator_username": admin.get("username"),
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    await log_admin_action(
        admin, "member.impersonate_start", "user", user_id,
        note=f"@{target.get('username')}",
    )
    return {"token": token, "user": target, "expires_in_hours": 2}


@router.delete("/admin/members/{user_id}")
async def admin_delete_member(user_id: str, admin: dict = Depends(require_admin)):
    if admin["user_id"] == user_id:
        raise HTTPException(400, "You cannot delete your own account from here.")
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    # Cascade: posts, answers, votes, bookmarks, notifications, sessions
    await db.posts.delete_many({"author_id": user_id})
    await db.answers.delete_many({"author_id": user_id})
    await db.votes.delete_many({"user_id": user_id})
    await db.bookmarks.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})
    await log_admin_action(admin, "member.delete", "user", user_id, note=target.get("username"))
    return {"ok": True}


# ---------- Posts moderation ----------
@router.get("/admin/posts")
async def admin_list_posts(
    q: Optional[str] = None,
    type: Optional[str] = None,
    space: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    admin: dict = Depends(require_admin),
):
    query = {}
    if q:
        query["title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    if type and type != "all":
        query["type"] = type
    if space and space != "all":
        sp = await db.spaces.find_one({"slug": space}, {"_id": 0})
        if sp:
            query["space_id"] = sp["id"]
    if status == "pinned":
        query["is_pinned"] = True
    elif status == "removed":
        query["is_removed"] = True
    elif status == "active":
        query["is_removed"] = {"$ne": True}
    total = await db.posts.count_documents(query)
    offset = (page - 1) * page_size
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(page_size).to_list(page_size)
    enriched = await enrich_posts(posts)
    return {"posts": enriched, "total": total, "page": page, "page_size": page_size}


@router.patch("/admin/posts/{post_id}")
async def admin_update_post(post_id: str, payload: PostPatchIn, admin: dict = Depends(require_admin)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    await db.posts.update_one({"id": post_id}, {"$set": updates})
    for k, v in updates.items():
        await log_admin_action(admin, f"post.{k}={v}", "post", post_id, note=post.get("title", "")[:80])
    return await db.posts.find_one({"id": post_id}, {"_id": 0})


@router.delete("/admin/posts/{post_id}")
async def admin_delete_post(post_id: str, admin: dict = Depends(require_admin)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    # Cascade: answers + their comments + votes + bookmarks
    answers = await db.answers.find({"post_id": post_id}, {"_id": 0, "id": 1}).to_list(500)
    answer_ids = [a["id"] for a in answers]
    if answer_ids:
        await db.comments.delete_many({"answer_id": {"$in": answer_ids}})
        await db.votes.delete_many({"target_id": {"$in": answer_ids}, "target_type": "answer"})
    await db.answers.delete_many({"post_id": post_id})
    await db.votes.delete_many({"target_id": post_id, "target_type": "post"})
    await db.bookmarks.delete_many({"post_id": post_id})
    await db.posts.delete_one({"id": post_id})
    await db.spaces.update_one({"id": post.get("space_id")}, {"$inc": {"post_count": -1}})
    await log_admin_action(admin, "post.delete", "post", post_id, note=post.get("title", "")[:80])
    return {"ok": True}


# ---------- Reports ----------
@router.get("/admin/reports")
async def admin_list_reports(status: str = "pending", admin: dict = Depends(require_admin)):
    if status not in ("pending", "reviewed", "dismissed"):
        raise HTTPException(400, "Invalid status")
    reports = await db.reports.find(
        {"status": status}, {"_id": 0}
    ).sort("created_at", -1).limit(200).to_list(200)
    # enrich with reporter + target preview
    reporter_ids = list({r["reporter_id"] for r in reports})
    reporters = {u["user_id"]: u for u in await db.users.find(
        {"user_id": {"$in": reporter_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(reporter_ids))}
    for r in reports:
        rep = reporters.get(r["reporter_id"], {})
        r["reporter"] = {"username": rep.get("username"), "full_name": rep.get("full_name")}
        # Fetch target preview
        if r["target_type"] == "post":
            t = await db.posts.find_one({"id": r["target_id"]}, {"_id": 0, "title": 1, "id": 1})
            r["target_preview"] = {"title": t.get("title") if t else "(deleted)", "link": f"/community/posts/{r['target_id']}"}
        elif r["target_type"] == "answer":
            a = await db.answers.find_one({"id": r["target_id"]}, {"_id": 0, "body": 1, "post_id": 1})
            r["target_preview"] = {"title": (a.get("body", "")[:80] + "...") if a else "(deleted)", "link": f"/community/posts/{a.get('post_id')}" if a else "#"}
        else:
            c = await db.comments.find_one({"id": r["target_id"]}, {"_id": 0, "body": 1, "answer_id": 1})
            r["target_preview"] = {"title": (c.get("body", "")[:80] + "...") if c else "(deleted)", "link": "#"}
    return reports


@router.get("/admin/reports/pending-count")
async def admin_reports_pending_count(admin: dict = Depends(require_admin)):
    return {"count": await db.reports.count_documents({"status": "pending"})}


@router.patch("/admin/reports/{report_id}")
async def admin_update_report(report_id: str, payload: ReportPatchIn, admin: dict = Depends(require_admin)):
    r = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Report not found")
    await db.reports.update_one({"id": report_id}, {"$set": {"status": payload.status}})
    reporter_notified = False
    if payload.remove_content:
        # Determine link to surface (post link for post/answer, anchor for comment)
        link = "#"
        snippet = ""
        if r["target_type"] == "post":
            tgt = await db.posts.find_one({"id": r["target_id"]}, {"_id": 0, "title": 1})
            snippet = (tgt or {}).get("title", "a post")[:80]
            await db.posts.update_one({"id": r["target_id"]}, {"$set": {"is_removed": True}})
        elif r["target_type"] == "answer":
            tgt = await db.answers.find_one({"id": r["target_id"]}, {"_id": 0, "body": 1, "post_id": 1})
            snippet = ((tgt or {}).get("body", "an answer")[:80])
            link = f"/community/posts/{(tgt or {}).get('post_id')}" if tgt else "#"
            await db.answers.delete_one({"id": r["target_id"]})
        elif r["target_type"] == "comment":
            tgt = await db.comments.find_one({"id": r["target_id"]}, {"_id": 0, "body": 1})
            snippet = ((tgt or {}).get("body", "a comment")[:80])
            await db.comments.delete_one({"id": r["target_id"]})
        # Thank-you notification to the reporter
        await create_notification(
            r["reporter_id"], "report_actioned",
            f"Thanks — your report on \"{snippet}\" was actioned. The content has been removed.",
            link,
        )
        reporter_notified = True
    await log_admin_action(admin, f"report.{payload.status}", r["target_type"], r["target_id"],
                           note=f"reason={r.get('reason')} remove_content={payload.remove_content}")
    return {"ok": True, "reporter_notified": reporter_notified}


# ---------- Spaces ----------
@router.get("/admin/spaces")
async def admin_list_spaces(admin: dict = Depends(require_admin)):
    spaces = await db.spaces.find({}, {"_id": 0}).to_list(100)
    return spaces


@router.post("/admin/spaces")
async def admin_create_space(payload: SpaceCreateIn, admin: dict = Depends(require_admin)):
    slug = payload.slug.lower().strip().replace(" ", "-")
    if await db.spaces.find_one({"slug": slug}):
        raise HTTPException(400, "A space with this slug already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "name": payload.name,
        "description": payload.description or "",
        "icon": payload.icon or "Hash",
        "post_count": 0,
        "member_count": 0,
        "is_hidden": False,
        "created_at": now_iso(),
    }
    await db.spaces.insert_one(doc)
    doc.pop("_id", None)
    await log_admin_action(admin, "space.create", "space", doc["id"], note=slug)
    return doc


@router.patch("/admin/spaces/{slug}")
async def admin_update_space(slug: str, payload: SpacePatchIn, admin: dict = Depends(require_admin)):
    sp = await db.spaces.find_one({"slug": slug}, {"_id": 0})
    if not sp:
        raise HTTPException(404, "Space not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    await db.spaces.update_one({"slug": slug}, {"$set": updates})
    await log_admin_action(admin, "space.update", "space", sp["id"], note=f"{slug}: {list(updates.keys())}")
    return await db.spaces.find_one({"slug": slug}, {"_id": 0})


# ---------- Knowledge Base (admin) ----------
@router.post("/admin/kb/docs/upload")
async def admin_upload_kb_docx(
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
):
    """Parse an uploaded .docx file and return the parsed payload for the
    admin review screen. Nothing is persisted at this stage — the admin
    edits any flagged fields, then calls POST /api/kb/docs to save as draft.
    """
    if not (file.filename or "").lower().endswith(".docx"):
        raise HTTPException(400, "Please upload a .docx file.")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(400, "File is larger than 10 MB.")
    try:
        parsed = parse_kb_docx(raw)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception:  # noqa: BLE001
        raise HTTPException(400, "Could not parse this .docx file.")

    # Decorate with the categories admin can pick from in the review UI
    categories = await db.kb_categories.find({}, {"_id": 0, "slug": 1, "name": 1, "icon": 1}).sort("sort_order", 1).to_list(50)
    parsed["available_categories"] = categories
    parsed["available_doc_types"] = [
        {"id": "fix_guide", "label": "Fix guide"},
        {"id": "how_to", "label": "How-to"},
        {"id": "learning_bite", "label": "Learning bite"},
        {"id": "reference", "label": "Reference"},
        {"id": "checklist", "label": "Checklist"},
    ]
    parsed["filename"] = file.filename

    # Duplicate detection on reference_id (case-insensitive exact match)
    parsed["duplicate"] = None
    ref_id = (parsed.get("reference_id") or "").strip()
    if ref_id:
        existing = await db.kb_docs.find_one(
            {"reference_id": {"$regex": f"^{re.escape(ref_id)}$", "$options": "i"}},
            {"_id": 0, "id": 1, "title": 1, "is_published": 1},
        )
        if existing:
            parsed["duplicate"] = {
                "existing_id": existing["id"],
                "title": existing.get("title", ""),
                "is_published": bool(existing.get("is_published")),
            }
    return parsed


@router.get("/admin/kb/stats")
async def admin_kb_stats(admin: dict = Depends(require_admin)):
    return {
        "total_docs": await db.kb_docs.count_documents({}),
        "published_docs": await db.kb_docs.count_documents({"is_published": True}),
        "drafts": await db.kb_docs.count_documents({"is_published": False}),
        "featured": await db.kb_docs.count_documents({"is_featured": True}),
        "total_categories": await db.kb_categories.count_documents({}),
    }


@router.get("/admin/kb/docs")
async def admin_kb_list_docs(
    q: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    admin: dict = Depends(require_admin),
):
    query: dict = {}
    if q:
        esc = re.escape(q.strip())
        query["$or"] = [
            {"title": {"$regex": esc, "$options": "i"}},
            {"summary": {"$regex": esc, "$options": "i"}},
        ]
    if status == "published":
        query["is_published"] = True
    elif status == "draft":
        query["is_published"] = False
    elif status == "featured":
        query["is_featured"] = True
    if category and category != "all":
        cat = await db.kb_categories.find_one({"slug": category}, {"_id": 0})
        if cat:
            query["category_id"] = cat["id"]
    total = await db.kb_docs.count_documents(query)
    offset = (page - 1) * page_size
    docs = await db.kb_docs.find(query, {"_id": 0}).sort("updated_at", -1).skip(offset).limit(page_size).to_list(page_size)
    enriched = await enrich_docs(docs)
    cat_ids = list({d["category_id"] for d in enriched})
    cats = {c["id"]: c for c in await db.kb_categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(len(cat_ids))}
    for d in enriched:
        c = cats.get(d["category_id"], {})
        d["category"] = {"slug": c.get("slug"), "name": c.get("name"), "icon": c.get("icon")}
    return {"docs": enriched, "total": total, "page": page, "page_size": page_size}


@router.patch("/admin/kb/docs/{doc_id}")
async def admin_update_kb_doc(doc_id: str, payload: KBDocPatchIn, admin: dict = Depends(require_admin)):
    doc = await db.kb_docs.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    updates: dict = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")

    # Handle category change
    if "category_slug" in updates:
        new_cat = await db.kb_categories.find_one({"slug": updates["category_slug"]}, {"_id": 0})
        if not new_cat:
            raise HTTPException(404, "Category not found")
        updates["category_id"] = new_cat["id"]
        # Re-bucket counts if previously published
        if doc.get("is_published") and new_cat["id"] != doc.get("category_id"):
            await db.kb_categories.update_one({"id": doc["category_id"]}, {"$inc": {"doc_count": -1}})
            await db.kb_categories.update_one({"id": new_cat["id"]}, {"$inc": {"doc_count": 1}})

    # Handle publish toggle (adjusts category counts)
    if "is_published" in updates and updates["is_published"] != doc.get("is_published"):
        target_cat_id = updates.get("category_id") or doc["category_id"]
        delta = 1 if updates["is_published"] else -1
        await db.kb_categories.update_one({"id": target_cat_id}, {"$inc": {"doc_count": delta}})

    if "tags" in updates:
        updates["tags"] = [t.strip().lower() for t in updates["tags"] if t.strip()][:8]

    updates["updated_at"] = now_iso()
    await db.kb_docs.update_one({"id": doc_id}, {"$set": updates})
    await log_admin_action(admin, "kb.update", "kb_doc", doc_id, note=f"keys={list(updates.keys())}")
    return await db.kb_docs.find_one({"id": doc_id}, {"_id": 0})


@router.delete("/admin/kb/docs/{doc_id}")
async def admin_delete_kb_doc(doc_id: str, admin: dict = Depends(require_admin)):
    doc = await db.kb_docs.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    await db.kb_helpful_votes.delete_many({"doc_id": doc_id})
    await db.kb_bookmarks.delete_many({"doc_id": doc_id})
    await db.kb_docs.delete_one({"id": doc_id})
    if doc.get("is_published"):
        await db.kb_categories.update_one({"id": doc["category_id"]}, {"$inc": {"doc_count": -1}})
    await log_admin_action(admin, "kb.delete", "kb_doc", doc_id, note=doc.get("title", "")[:80])
    return {"ok": True}


@router.get("/admin/kb/categories")
async def admin_kb_list_categories(admin: dict = Depends(require_admin)):
    return await db.kb_categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)


@router.post("/admin/kb/categories")
async def admin_create_kb_category(payload: KBCategoryCreateIn, admin: dict = Depends(require_admin)):
    slug = payload.slug.lower().strip().replace(" ", "-")
    if not slug:
        raise HTTPException(400, "Slug is required")
    if await db.kb_categories.find_one({"slug": slug}):
        raise HTTPException(400, "A category with this slug already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "name": payload.name,
        "icon": payload.icon or "📚",
        "description": payload.description or "",
        "sort_order": payload.sort_order or 99,
        "doc_count": 0,
        "total_views": 0,
        "avg_helpful_pct": 0,
        "is_hidden": False,
        "created_at": now_iso(),
    }
    await db.kb_categories.insert_one(doc)
    doc.pop("_id", None)
    await log_admin_action(admin, "kb.category.create", "kb_category", doc["id"], note=slug)
    return doc


@router.patch("/admin/kb/categories/{slug}")
async def admin_update_kb_category(slug: str, payload: KBCategoryPatchIn, admin: dict = Depends(require_admin)):
    cat = await db.kb_categories.find_one({"slug": slug}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Category not found")
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    await db.kb_categories.update_one({"slug": slug}, {"$set": updates})
    await log_admin_action(admin, "kb.category.update", "kb_category", cat["id"], note=f"{slug}: {list(updates.keys())}")
    return await db.kb_categories.find_one({"slug": slug}, {"_id": 0})


# ---------- Settings ----------
@router.get("/admin/settings")
async def admin_list_settings(admin: dict = Depends(require_admin)):
    docs = await db.settings.find({}, {"_id": 0}).to_list(50)
    return {d["key"]: d["value"] for d in docs}


@router.patch("/admin/settings")
async def admin_update_settings(payload: dict, admin: dict = Depends(require_admin)):
    if not isinstance(payload, dict) or not payload:
        raise HTTPException(400, "Payload must be a non-empty object of key->value")
    for key, value in payload.items():
        await db.settings.update_one(
            {"key": key},
            {"$set": {"key": key, "value": str(value), "updated_at": now_iso()}},
            upsert=True,
        )
    await log_admin_action(admin, "settings.update", "settings", None, note=",".join(payload.keys()))
    return {"ok": True}

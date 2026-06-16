"""Community: spaces, posts, answers, comments, votes, bookmarks,
notifications, reports, community stats, and public settings."""
import re
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core import db, now_iso
from schemas import PostIn, AnswerIn, CommentIn, VoteIn, ReportIn
from dependencies import (
    get_current_user, get_setting, check_active,
    update_reputation, create_notification,
)

router = APIRouter()


# ---------- Helpers (exported for use by admin router and auth router) ----------
async def enrich_posts(posts: list) -> list:
    if not posts:
        return posts
    author_ids = list({p["author_id"] for p in posts})
    space_ids = list({p["space_id"] for p in posts if p.get("space_id")})
    authors = {u["user_id"]: u for u in await db.users.find(
        {"user_id": {"$in": author_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(author_ids))}
    spaces = {s["id"]: s for s in await db.spaces.find(
        {"id": {"$in": space_ids}}, {"_id": 0}
    ).to_list(len(space_ids))}
    for p in posts:
        a = authors.get(p["author_id"], {})
        p["author"] = {
            "user_id": a.get("user_id"),
            "username": a.get("username"),
            "full_name": a.get("full_name"),
            "avatar_url": a.get("avatar_url"),
            "group_type": a.get("group_type"),
            "reputation_score": a.get("reputation_score", 0),
        }
        sp = spaces.get(p.get("space_id"))
        if sp:
            p["space"] = {"slug": sp["slug"], "name": sp["name"], "icon": sp.get("icon")}
    return posts


# ---------- Spaces ----------
@router.get("/spaces")
async def list_spaces():
    return await db.spaces.find({"is_hidden": {"$ne": True}}, {"_id": 0}).to_list(100)


@router.get("/spaces/{slug}")
async def get_space(slug: str):
    sp = await db.spaces.find_one({"slug": slug}, {"_id": 0})
    if not sp:
        raise HTTPException(404, "Space not found")
    return sp


# ---------- Posts ----------
@router.get("/posts")
async def list_posts(
    space: Optional[str] = None,
    type: Optional[str] = None,
    sort: str = "latest",
    unanswered: bool = False,
    q: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    query = {}
    if space:
        sp = await db.spaces.find_one({"slug": space}, {"_id": 0})
        if sp:
            query["space_id"] = sp["id"]
    if type:
        query["type"] = type
    if unanswered:
        query["answer_count"] = 0
    if q:
        # Case-insensitive search on title, tags, and body
        escaped = re.escape(q.strip())
        if escaped:
            query["$or"] = [
                {"title": {"$regex": escaped, "$options": "i"}},
                {"tags": {"$regex": f"^{escaped}", "$options": "i"}},
                {"body": {"$regex": escaped, "$options": "i"}},
            ]
    # Hide removed posts from public list
    query["is_removed"] = {"$ne": True}
    sort_key = "vote_count" if sort in ("top", "hot") else "created_at"
    posts = await db.posts.find(query, {"_id": 0}).sort(sort_key, -1).skip(offset).limit(limit).to_list(limit)
    enriched = await enrich_posts(posts)
    total = await db.posts.count_documents(query)
    return {"posts": enriched, "total": total}


@router.post("/posts")
async def create_post(payload: PostIn, user: dict = Depends(get_current_user)):
    check_active(user)
    if not user.get("onboarded"):
        raise HTTPException(403, "Complete your profile first")
    min_rep_post = int(await get_setting("min_rep_post", "0") or 0)
    if user.get("reputation_score", 0) < min_rep_post:
        raise HTTPException(403, f"You need at least {min_rep_post} reputation to post.")
    sp = await db.spaces.find_one({"slug": payload.space_slug}, {"_id": 0})
    if not sp:
        raise HTTPException(404, "Space not found")
    if len(payload.title) < 10 or len(payload.title) > 150:
        raise HTTPException(400, "Title must be 10-150 characters")
    if len(payload.body) < 30:
        raise HTTPException(400, "Body must be at least 30 characters")
    post_id = str(uuid.uuid4())
    doc = {
        "id": post_id,
        "space_id": sp["id"],
        "author_id": user["user_id"],
        "type": payload.type,
        "title": payload.title,
        "body": payload.body,
        "tags": payload.tags[:5],
        "vote_count": 0,
        "answer_count": 0,
        "view_count": 0,
        "is_solved": False,
        "accepted_answer_id": None,
        "is_pinned": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    await db.spaces.update_one({"id": sp["id"]}, {"$inc": {"post_count": 1}})
    posts_count = await db.posts.count_documents({"author_id": user["user_id"], "type": payload.type})
    if posts_count == 1 and payload.type == "question":
        await update_reputation(user["user_id"], 5)
    if user.get("impersonator_user_id"):
        await db.admin_logs.insert_one({
            "id": str(uuid.uuid4()),
            "admin_id": user["impersonator_user_id"],
            "admin_username": user.get("impersonator_username"),
            "action": "impersonation.post_created",
            "target_type": "post", "target_id": post_id,
            "note": f"as @{user.get('username')}: {payload.title[:80]}",
            "created_at": now_iso(),
        })
    return doc


@router.get("/posts/{post_id}")
async def get_post(post_id: str):
    post = await db.posts.find_one({"id": post_id, "is_removed": {"$ne": True}}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    await db.posts.update_one({"id": post_id}, {"$inc": {"view_count": 1}})
    post["view_count"] = post.get("view_count", 0) + 1
    return (await enrich_posts([post]))[0]


@router.get("/posts/{post_id}/live")
async def post_live_counts(post_id: str):
    """Lightweight endpoint for live polling — returns just the counts that change."""
    post = await db.posts.find_one(
        {"id": post_id},
        {"_id": 0, "vote_count": 1, "answer_count": 1, "view_count": 1, "is_solved": 1, "accepted_answer_id": 1},
    )
    if not post:
        raise HTTPException(404, "Post not found")
    # Per-answer vote counts
    answers = await db.answers.find(
        {"post_id": post_id},
        {"_id": 0, "id": 1, "vote_count": 1, "is_accepted": 1},
    ).to_list(500)
    return {"post": post, "answers": answers}


@router.get("/posts/{post_id}/answers")
async def get_answers(post_id: str):
    answers = await db.answers.find({"post_id": post_id}, {"_id": 0}).to_list(200)
    if not answers:
        return []
    author_ids = list({a["author_id"] for a in answers})
    authors = {u["user_id"]: u for u in await db.users.find(
        {"user_id": {"$in": author_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(author_ids))}
    answer_ids = [a["id"] for a in answers]
    cmts = await db.comments.find({"answer_id": {"$in": answer_ids}}, {"_id": 0}).sort("created_at", 1).to_list(500)
    c_author_ids = list({c["author_id"] for c in cmts})
    c_authors = {u["user_id"]: u for u in await db.users.find(
        {"user_id": {"$in": c_author_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(c_author_ids))}
    comments_by_answer: dict = {}
    for c in cmts:
        a = c_authors.get(c["author_id"], {})
        c["author"] = {"username": a.get("username"), "full_name": a.get("full_name"), "group_type": a.get("group_type")}
        comments_by_answer.setdefault(c["answer_id"], []).append(c)
    for ans in answers:
        a = authors.get(ans["author_id"], {})
        ans["author"] = {
            "user_id": a.get("user_id"),
            "username": a.get("username"),
            "full_name": a.get("full_name"),
            "avatar_url": a.get("avatar_url"),
            "group_type": a.get("group_type"),
            "reputation_score": a.get("reputation_score", 0),
        }
        ans["comments"] = comments_by_answer.get(ans["id"], [])
    answers.sort(key=lambda x: (not x.get("is_accepted"), -x.get("vote_count", 0)))
    return answers


@router.post("/posts/{post_id}/answers")
async def create_answer(post_id: str, payload: AnswerIn, user: dict = Depends(get_current_user)):
    check_active(user)
    if not user.get("onboarded"):
        raise HTTPException(403, "Complete your profile first")
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    if len(payload.body) < 50:
        raise HTTPException(400, "Answer must be at least 50 characters")
    ans_id = str(uuid.uuid4())
    doc = {
        "id": ans_id,
        "post_id": post_id,
        "author_id": user["user_id"],
        "body": payload.body,
        "vote_count": 0,
        "is_accepted": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.answers.insert_one(doc)
    doc.pop("_id", None)
    await db.posts.update_one({"id": post_id}, {"$inc": {"answer_count": 1}})
    ans_count = await db.answers.count_documents({"author_id": user["user_id"]})
    if ans_count == 1:
        await update_reputation(user["user_id"], 5)
    if user.get("impersonator_user_id"):
        await db.admin_logs.insert_one({
            "id": str(uuid.uuid4()),
            "admin_id": user["impersonator_user_id"],
            "admin_username": user.get("impersonator_username"),
            "action": "impersonation.answer_created",
            "target_type": "answer", "target_id": doc["id"],
            "note": f"as @{user.get('username')} on post {post_id[:8]}",
            "created_at": now_iso(),
        })
    if post["author_id"] != user["user_id"]:
        await create_notification(
            post["author_id"], "answer",
            f"{user['full_name']} answered your question",
            f"/community/posts/{post_id}",
        )
    doc["author"] = {
        "user_id": user["user_id"],
        "username": user["username"],
        "full_name": user["full_name"],
        "avatar_url": user.get("avatar_url"),
        "group_type": user.get("group_type"),
        "reputation_score": user.get("reputation_score", 0),
    }
    doc["comments"] = []
    return doc


@router.patch("/answers/{answer_id}")
async def edit_answer(answer_id: str, payload: AnswerIn, user: dict = Depends(get_current_user)):
    ans = await db.answers.find_one({"id": answer_id}, {"_id": 0})
    if not ans:
        raise HTTPException(404, "Answer not found")
    if ans["author_id"] != user["user_id"]:
        raise HTTPException(403, "Only the answer author can edit")
    if len(payload.body) < 50:
        raise HTTPException(400, "Answer must be at least 50 characters")
    await db.answers.update_one(
        {"id": answer_id},
        {"$set": {"body": payload.body, "updated_at": now_iso()}},
    )
    return {"ok": True, "body": payload.body, "updated_at": now_iso()}


@router.delete("/answers/{answer_id}")
async def delete_answer(answer_id: str, user: dict = Depends(get_current_user)):
    ans = await db.answers.find_one({"id": answer_id}, {"_id": 0})
    if not ans:
        raise HTTPException(404, "Answer not found")
    if ans["author_id"] != user["user_id"]:
        raise HTTPException(403, "Only the answer author can delete")
    # Cascade: comments + votes on this answer
    await db.comments.delete_many({"answer_id": answer_id})
    await db.votes.delete_many({"target_id": answer_id, "target_type": "answer"})
    await db.answers.delete_one({"id": answer_id})
    # Decrement post answer_count, unset accepted_answer if this was it
    post = await db.posts.find_one({"id": ans["post_id"]}, {"_id": 0})
    if post:
        update = {"$inc": {"answer_count": -1}}
        if post.get("accepted_answer_id") == answer_id:
            update["$set"] = {"accepted_answer_id": None, "is_solved": False}
        await db.posts.update_one({"id": ans["post_id"]}, update)
    return {"ok": True}


@router.post("/posts/{post_id}/accept-answer")
async def accept_answer(post_id: str, body: dict, user: dict = Depends(get_current_user)):
    answer_id = body.get("answer_id")
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    if post["author_id"] != user["user_id"]:
        raise HTTPException(403, "Only the post author can accept an answer")
    ans = await db.answers.find_one({"id": answer_id}, {"_id": 0})
    if not ans or ans["post_id"] != post_id:
        raise HTTPException(404, "Answer not found")
    await db.answers.update_many({"post_id": post_id}, {"$set": {"is_accepted": False}})
    await db.answers.update_one({"id": answer_id}, {"$set": {"is_accepted": True}})
    await db.posts.update_one({"id": post_id}, {"$set": {"is_solved": True, "accepted_answer_id": answer_id}})
    await update_reputation(ans["author_id"], 25)
    await update_reputation(user["user_id"], 2)
    await create_notification(
        ans["author_id"], "accepted",
        f"Your answer was accepted on '{post['title'][:60]}'",
        f"/community/posts/{post_id}",
    )
    return {"ok": True}


# ---------- Votes ----------
@router.post("/votes")
async def cast_vote(payload: VoteIn, user: dict = Depends(get_current_user)):
    check_active(user)
    if payload.value not in (1, -1):
        raise HTTPException(400, "Vote value must be 1 or -1")
    if payload.value == -1:
        min_rep_down = int(await get_setting("min_rep_downvote", "0") or 0)
        if user.get("reputation_score", 0) < min_rep_down:
            raise HTTPException(403, f"You need at least {min_rep_down} reputation to downvote.")
    target_coll = db.posts if payload.target_type == "post" else db.answers
    target = await target_coll.find_one({"id": payload.target_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Target not found")
    if target["author_id"] == user["user_id"]:
        raise HTTPException(400, "Cannot vote on your own content")

    existing = await db.votes.find_one(
        {"user_id": user["user_id"], "target_id": payload.target_id, "target_type": payload.target_type},
        {"_id": 0},
    )
    delta = 0
    new_value = payload.value
    if existing and existing["value"] == payload.value:
        await db.votes.delete_one({"id": existing["id"]})
        delta = -payload.value
        new_value = 0
        # revert author rep
        if payload.value == 1:
            await update_reputation(target["author_id"], -10)
        else:
            await update_reputation(target["author_id"], 2)
            await update_reputation(user["user_id"], 1)
    elif existing:
        await db.votes.update_one({"id": existing["id"]}, {"$set": {"value": payload.value}})
        delta = payload.value * 2
        if payload.value == 1:
            await update_reputation(target["author_id"], 12)
            await update_reputation(user["user_id"], 1)
        else:
            await update_reputation(target["author_id"], -12)
            await update_reputation(user["user_id"], -1)
    else:
        await db.votes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "target_id": payload.target_id,
            "target_type": payload.target_type,
            "value": payload.value,
            "created_at": now_iso(),
        })
        delta = payload.value
        if payload.value == 1:
            await update_reputation(target["author_id"], 10)
        else:
            await update_reputation(target["author_id"], -2)
            await update_reputation(user["user_id"], -1)

    await target_coll.update_one({"id": payload.target_id}, {"$inc": {"vote_count": delta}})
    new_count = target.get("vote_count", 0) + delta
    return {"new_count": new_count, "user_vote": new_value}


@router.get("/votes/me")
async def my_votes(target_ids: str = Query(""), user: dict = Depends(get_current_user)):
    ids = [t for t in target_ids.split(",") if t]
    if not ids:
        return {}
    votes = await db.votes.find(
        {"user_id": user["user_id"], "target_id": {"$in": ids}}, {"_id": 0}
    ).to_list(len(ids))
    return {v["target_id"]: v["value"] for v in votes}


# ---------- Comments ----------
@router.post("/answers/{answer_id}/comments")
async def add_comment(answer_id: str, payload: CommentIn, user: dict = Depends(get_current_user)):
    ans = await db.answers.find_one({"id": answer_id}, {"_id": 0})
    if not ans:
        raise HTTPException(404, "Answer not found")
    doc = {
        "id": str(uuid.uuid4()),
        "answer_id": answer_id,
        "author_id": user["user_id"],
        "body": payload.body,
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    doc["author"] = {
        "username": user["username"],
        "full_name": user["full_name"],
        "group_type": user.get("group_type"),
    }
    return doc


# ---------- Notifications ----------
@router.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    unread = await db.notifications.count_documents({"user_id": user["user_id"], "is_read": False})
    return {"items": items, "unread": unread}


@router.post("/notifications/mark-read")
async def mark_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


# ---------- Bookmarks ----------
@router.post("/bookmarks/{post_id}")
async def toggle_bookmark(post_id: str, user: dict = Depends(get_current_user)):
    """Toggle bookmark on a post. Returns the new bookmarked state."""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "id": 1})
    if not post:
        raise HTTPException(404, "Post not found")
    existing = await db.bookmarks.find_one(
        {"user_id": user["user_id"], "post_id": post_id}, {"_id": 0}
    )
    if existing:
        await db.bookmarks.delete_one({"user_id": user["user_id"], "post_id": post_id})
        return {"bookmarked": False}
    await db.bookmarks.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "post_id": post_id,
        "created_at": now_iso(),
    })
    return {"bookmarked": True}


@router.get("/bookmarks")
async def list_bookmarks(user: dict = Depends(get_current_user)):
    """List the current user's bookmarked posts, enriched."""
    bms = await db.bookmarks.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    if not bms:
        return []
    post_ids = [b["post_id"] for b in bms]
    posts = await db.posts.find({"id": {"$in": post_ids}}, {"_id": 0}).to_list(len(post_ids))
    enriched = await enrich_posts(posts)
    # Preserve bookmark-creation order
    order = {b["post_id"]: idx for idx, b in enumerate(bms)}
    enriched.sort(key=lambda p: order.get(p["id"], 9999))
    return enriched


@router.get("/bookmarks/me")
async def my_bookmarks_lookup(post_ids: str = Query(""), user: dict = Depends(get_current_user)):
    """Return a dict {post_id: true} for the given post_ids that the user has bookmarked."""
    ids = [p for p in post_ids.split(",") if p]
    if not ids:
        return {}
    bms = await db.bookmarks.find(
        {"user_id": user["user_id"], "post_id": {"$in": ids}}, {"_id": 0}
    ).to_list(len(ids))
    return {b["post_id"]: True for b in bms}


# ---------- Community discovery ----------
@router.get("/community/stats")
async def community_stats():
    return {
        "members": await db.users.count_documents({}),
        "posts": await db.posts.count_documents({}),
        "answers": await db.answers.count_documents({}),
        "active_today": await db.users.count_documents({"onboarded": True}),
    }


@router.get("/community/top-contributors")
async def top_contributors(limit: int = 5):
    users = await db.users.find(
        {"onboarded": True}, {"_id": 0, "password_hash": 0}
    ).sort("reputation_score", -1).limit(limit).to_list(limit)
    return users


@router.get("/community/recent-activity")
async def recent_activity(limit: int = 5):
    posts = await db.posts.find({"is_removed": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return await enrich_posts(posts)


@router.get("/community/tags")
async def tag_cloud(limit: int = 20):
    pipeline = [
        {"$match": {"is_removed": {"$ne": True}}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    cur = db.posts.aggregate(pipeline)
    return [{"tag": d["_id"], "count": d["count"]} async for d in cur]


# ---------- Public settings ----------
@router.get("/settings/public")
async def public_settings():
    keys = ["community_name", "community_tagline", "registrations_open"]
    docs = await db.settings.find({"key": {"$in": keys}}, {"_id": 0}).to_list(len(keys))
    return {d["key"]: d["value"] for d in docs}


# ---------- Reports ----------
@router.post("/reports")
async def create_report(payload: ReportIn, user: dict = Depends(get_current_user)):
    valid_reasons = {"Spam", "Misinformation", "Off-topic", "Inappropriate", "Other"}
    if payload.reason not in valid_reasons:
        raise HTTPException(400, "Invalid reason")
    # Verify target exists
    coll = {"post": db.posts, "answer": db.answers, "comment": db.comments}[payload.target_type]
    target = await coll.find_one({"id": payload.target_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(404, "Target not found")
    # Prevent duplicate pending reports from same user
    existing = await db.reports.find_one({
        "reporter_id": user["user_id"],
        "target_id": payload.target_id,
        "target_type": payload.target_type,
        "status": "pending",
    })
    if existing:
        return {"ok": True, "duplicate": True}
    await db.reports.insert_one({
        "id": str(uuid.uuid4()),
        "reporter_id": user["user_id"],
        "target_id": payload.target_id,
        "target_type": payload.target_type,
        "reason": payload.reason,
        "status": "pending",
        "created_at": now_iso(),
    })
    return {"ok": True}

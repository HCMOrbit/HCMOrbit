from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import uuid
import logging
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")

app = FastAPI(title="HCMOrbit API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("hcmorbit")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, days: int = 7) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=days),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        expires_at = sess.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < datetime.now(timezone.utc):
            raise HTTPException(401, "Session expired")
        user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
        if user:
            return user
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if user:
            return user
    except jwt.InvalidTokenError:
        pass
    raise HTTPException(401, "Invalid or expired token")


GroupType = Literal["aspirant", "practitioner", "employer"]
PostType = Literal["question", "discussion", "success_story"]


class RegisterIn(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileSetupIn(BaseModel):
    group_type: GroupType
    workday_modules: List[str] = []
    years_experience: Optional[int] = None
    bio: Optional[str] = None
    company_name: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    current_role: Optional[str] = None
    employment_type: Optional[str] = None
    company_role: Optional[str] = None
    here_for: Optional[str] = None
    company_size: Optional[str] = None
    goals: Optional[str] = None


class PostIn(BaseModel):
    space_slug: str
    type: PostType
    title: str
    body: str
    tags: List[str] = []


class AnswerIn(BaseModel):
    body: str


class CommentIn(BaseModel):
    body: str


class VoteIn(BaseModel):
    target_id: str
    target_type: Literal["post", "answer"]
    value: int


class EmergentSessionIn(BaseModel):
    session_id: str


async def update_reputation(user_id: str, delta: int):
    if not user_id or delta == 0:
        return
    await db.users.update_one({"user_id": user_id}, {"$inc": {"reputation_score": delta}})


async def create_notification(user_id: str, type_: str, message: str, link: str):
    if not user_id:
        return
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type_,
        "message": message,
        "link": link,
        "is_read": False,
        "created_at": now_iso(),
    })


# ---------- Auth ----------
@api.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower().strip()
    username = payload.username.strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    if await db.users.find_one({"username": username}):
        raise HTTPException(400, "Username already taken")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "username": username,
        "full_name": payload.full_name,
        "password_hash": hash_password(payload.password),
        "avatar_url": None,
        "bio": None,
        "group_type": None,
        "workday_modules": [],
        "years_experience": None,
        "company_name": None,
        "location": None,
        "linkedin_url": None,
        "reputation_score": 0,
        "is_verified": False,
        "onboarded": False,
        "auth_provider": "email",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    token = create_token(user_id)
    user = {k: v for k, v in doc.items() if k != "password_hash"}
    return {"user": user, "token": token}


@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_token(user["user_id"])
    return {"user": user, "token": token}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/check-username")
async def check_username(body: dict):
    u = (body.get("username") or "").strip()
    if not u or len(u) < 3:
        return {"available": False, "reason": "Username must be at least 3 characters"}
    exists = await db.users.find_one({"username": u})
    return {"available": not bool(exists)}


@api.post("/auth/emergent-session")
async def emergent_session(payload: EmergentSessionIn):
    """REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH"""
    async with httpx.AsyncClient(timeout=15) as client_:
        r = await client_.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid Emergent session")
    data = r.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(400, "Incomplete session data")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"avatar_url": picture or existing.get("avatar_url")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        base_username = email.split("@")[0].replace(".", "_").lower()[:20]
        username = base_username
        i = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}{i}"
            i += 1
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "username": username,
            "full_name": name,
            "avatar_url": picture,
            "bio": None,
            "group_type": None,
            "workday_modules": [],
            "years_experience": None,
            "company_name": None,
            "location": None,
            "linkedin_url": None,
            "reputation_score": 0,
            "is_verified": True,
            "onboarded": False,
            "auth_provider": "google",
            "created_at": now_iso(),
        })

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user, "token": session_token}


@api.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        await db.user_sessions.delete_many({"session_token": token})
    return {"ok": True}


@api.post("/profile/setup")
async def profile_setup(payload: ProfileSetupIn, user: dict = Depends(get_current_user)):
    updates = payload.model_dump(exclude_none=True)
    updates["onboarded"] = True
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})


@api.get("/users/{username}")
async def get_user_profile(username: str):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    stats = {
        "questions": await db.posts.count_documents({"author_id": user["user_id"], "type": "question"}),
        "answers": await db.answers.count_documents({"author_id": user["user_id"]}),
        "accepted": await db.answers.count_documents({"author_id": user["user_id"], "is_accepted": True}),
        "votes_received": max(0, user.get("reputation_score", 0)) // 10,
    }
    return {"user": user, "stats": stats}


@api.get("/users/{username}/posts")
async def get_user_posts(username: str, type: Optional[str] = None):
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")
    q = {"author_id": user["user_id"]}
    if type:
        q["type"] = type
    posts = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return await _enrich_posts(posts)


@api.get("/spaces")
async def list_spaces():
    return await db.spaces.find({}, {"_id": 0}).to_list(100)


@api.get("/spaces/{slug}")
async def get_space(slug: str):
    sp = await db.spaces.find_one({"slug": slug}, {"_id": 0})
    if not sp:
        raise HTTPException(404, "Space not found")
    return sp


async def _enrich_posts(posts: list) -> list:
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


@api.get("/posts")
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
        # Case-insensitive search on title, tags, and body (in that priority)
        escaped = re.escape(q.strip())
        if escaped:
            query["$or"] = [
                {"title": {"$regex": escaped, "$options": "i"}},
                {"tags": {"$regex": f"^{escaped}", "$options": "i"}},
                {"body": {"$regex": escaped, "$options": "i"}},
            ]
    sort_key = "vote_count" if sort in ("top", "hot") else "created_at"
    posts = await db.posts.find(query, {"_id": 0}).sort(sort_key, -1).skip(offset).limit(limit).to_list(limit)
    enriched = await _enrich_posts(posts)
    total = await db.posts.count_documents(query)
    return {"posts": enriched, "total": total}


@api.post("/posts")
async def create_post(payload: PostIn, user: dict = Depends(get_current_user)):
    if not user.get("onboarded"):
        raise HTTPException(403, "Complete your profile first")
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
    return doc


@api.get("/posts/{post_id}")
async def get_post(post_id: str):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    await db.posts.update_one({"id": post_id}, {"$inc": {"view_count": 1}})
    post["view_count"] = post.get("view_count", 0) + 1
    return (await _enrich_posts([post]))[0]


@api.get("/posts/{post_id}/live")
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


@api.get("/posts/{post_id}/answers")
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


@api.post("/posts/{post_id}/answers")
async def create_answer(post_id: str, payload: AnswerIn, user: dict = Depends(get_current_user)):
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


@api.patch("/answers/{answer_id}")
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


@api.delete("/answers/{answer_id}")
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


@api.post("/posts/{post_id}/accept-answer")
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


@api.post("/votes")
async def cast_vote(payload: VoteIn, user: dict = Depends(get_current_user)):
    if payload.value not in (1, -1):
        raise HTTPException(400, "Vote value must be 1 or -1")
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


@api.get("/votes/me")
async def my_votes(target_ids: str = Query(""), user: dict = Depends(get_current_user)):
    ids = [t for t in target_ids.split(",") if t]
    if not ids:
        return {}
    votes = await db.votes.find(
        {"user_id": user["user_id"], "target_id": {"$in": ids}}, {"_id": 0}
    ).to_list(len(ids))
    return {v["target_id"]: v["value"] for v in votes}


@api.post("/answers/{answer_id}/comments")
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


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    unread = await db.notifications.count_documents({"user_id": user["user_id"], "is_read": False})
    return {"items": items, "unread": unread}


@api.post("/notifications/mark-read")
async def mark_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"is_read": True}})
    return {"ok": True}


# ---------- Bookmarks ----------
@api.post("/bookmarks/{post_id}")
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


@api.get("/bookmarks")
async def list_bookmarks(user: dict = Depends(get_current_user)):
    """List the current user's bookmarked posts, enriched."""
    bms = await db.bookmarks.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    if not bms:
        return []
    post_ids = [b["post_id"] for b in bms]
    posts = await db.posts.find({"id": {"$in": post_ids}}, {"_id": 0}).to_list(len(post_ids))
    enriched = await _enrich_posts(posts)
    # Preserve bookmark-creation order
    order = {b["post_id"]: idx for idx, b in enumerate(bms)}
    enriched.sort(key=lambda p: order.get(p["id"], 9999))
    return enriched


@api.get("/bookmarks/me")
async def my_bookmarks_lookup(post_ids: str = Query(""), user: dict = Depends(get_current_user)):
    """Return a dict {post_id: true} for the given post_ids that the user has bookmarked."""
    ids = [p for p in post_ids.split(",") if p]
    if not ids:
        return {}
    bms = await db.bookmarks.find(
        {"user_id": user["user_id"], "post_id": {"$in": ids}}, {"_id": 0}
    ).to_list(len(ids))
    return {b["post_id"]: True for b in bms}


@api.get("/community/stats")
async def community_stats():
    return {
        "members": await db.users.count_documents({}),
        "posts": await db.posts.count_documents({}),
        "answers": await db.answers.count_documents({}),
        "active_today": await db.users.count_documents({"onboarded": True}),
    }


@api.get("/community/top-contributors")
async def top_contributors(limit: int = 5):
    users = await db.users.find(
        {"onboarded": True}, {"_id": 0, "password_hash": 0}
    ).sort("reputation_score", -1).limit(limit).to_list(limit)
    return users


@api.get("/community/recent-activity")
async def recent_activity(limit: int = 5):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return await _enrich_posts(posts)


@api.get("/community/tags")
async def tag_cloud(limit: int = 20):
    pipeline = [
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    cur = db.posts.aggregate(pipeline)
    return [{"tag": d["_id"], "count": d["count"]} async for d in cur]


@api.get("/")
async def root():
    return {"app": "HCMOrbit", "status": "ok"}


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.spaces.create_index("slug", unique=True)
    await db.posts.create_index("id", unique=True)
    await db.answers.create_index("post_id")
    await db.votes.create_index(
        [("user_id", 1), ("target_id", 1), ("target_type", 1)],
        unique=True
    )
    await db.bookmarks.create_index([("user_id", 1), ("post_id", 1)], unique=True)
    await db.bookmarks.create_index([("user_id", 1), ("created_at", -1)])
    from seed_data import seed_all
    await seed_all(db, hash_password)
    # Seed admin
    if not await db.users.find_one({"email": os.environ["ADMIN_EMAIL"].lower()}):
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": os.environ["ADMIN_EMAIL"].lower(),
            "username": "admin",
            "full_name": "Admin",
            "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "avatar_url": None,
            "bio": "HCMOrbit administrator",
            "group_type": "practitioner",
            "workday_modules": [],
            "years_experience": None,
            "company_name": None,
            "location": None,
            "linkedin_url": None,
            "reputation_score": 0,
            "is_verified": True,
            "onboarded": True,
            "auth_provider": "email",
            "created_at": now_iso(),
        })
    log.info("Startup seeding complete")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

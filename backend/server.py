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
import certifi
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
# Use certifi's CA bundle for TLS verification — required for MongoDB Atlas
# connections on hosts (e.g. Railway) whose default trust store is missing
# the LetsEncrypt / ISRG root certificates Atlas presents.
_mongo_kwargs = {}
if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url.lower() or "ssl=true" in mongo_url.lower():
    _mongo_kwargs["tlsCAFile"] = certifi.where()
client = AsyncIOMotorClient(mongo_url, **_mongo_kwargs)
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
            # Surface impersonation context so frontend can show a banner & audit knows
            impersonator = payload.get("impersonator")
            if impersonator:
                user["impersonator_user_id"] = impersonator
                user["impersonator_username"] = payload.get("impersonator_username")
            return user
    except jwt.InvalidTokenError:
        pass
    raise HTTPException(401, "Invalid or expired token")


GroupType = Literal["aspirant", "practitioner", "employer"]
PostType = Literal["question", "discussion", "success_story"]


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin access required")
    return user


async def get_setting(key: str, default: str = "") -> str:
    doc = await db.settings.find_one({"key": key}, {"_id": 0})
    return doc["value"] if doc and "value" in doc else default


async def log_admin_action(admin: dict, action: str, target_type: Optional[str] = None,
                           target_id: Optional[str] = None, note: Optional[str] = None):
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_id": admin["user_id"],
        "admin_username": admin.get("username"),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "note": note,
        "created_at": now_iso(),
    })


def _check_active(user: dict):
    if user.get("is_suspended"):
        raise HTTPException(403, "Your account is suspended. You can read but not post or vote.")


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
    if (await get_setting("registrations_open", "true")).lower() != "true":
        raise HTTPException(403, "New registrations are temporarily closed. Please check back soon.")
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
    return await db.spaces.find({"is_hidden": {"$ne": True}}, {"_id": 0}).to_list(100)


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
    enriched = await _enrich_posts(posts)
    total = await db.posts.count_documents(query)
    return {"posts": enriched, "total": total}


@api.post("/posts")
async def create_post(payload: PostIn, user: dict = Depends(get_current_user)):
    _check_active(user)
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


@api.get("/posts/{post_id}")
async def get_post(post_id: str):
    post = await db.posts.find_one({"id": post_id, "is_removed": {"$ne": True}}, {"_id": 0})
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
    _check_active(user)
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
    _check_active(user)
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
    posts = await db.posts.find({"is_removed": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return await _enrich_posts(posts)


@api.get("/community/tags")
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


# ---------- Public settings (community name, registration toggle) ----------
@api.get("/settings/public")
async def public_settings():
    keys = ["community_name", "community_tagline", "registrations_open"]
    docs = await db.settings.find({"key": {"$in": keys}}, {"_id": 0}).to_list(len(keys))
    return {d["key"]: d["value"] for d in docs}


# ---------- Reports (any logged-in user can report) ----------
class ReportIn(BaseModel):
    target_id: str
    target_type: Literal["post", "answer", "comment"]
    reason: str


@api.post("/reports")
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


# ---------- Knowledge Base ----------
async def _enrich_docs(docs):
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


@api.get("/kb/stats")
async def kb_stats():
    total_docs = await db.kb_docs.count_documents({"is_published": True})
    pipeline = [{"$group": {"_id": None, "h": {"$sum": "$helpful_count"}, "nh": {"$sum": "$not_helpful_count"}}}]
    cur = db.kb_docs.aggregate(pipeline)
    agg = [d async for d in cur]
    h = agg[0]["h"] if agg else 0
    nh = agg[0]["nh"] if agg else 0
    avg = int(round(100 * h / max(1, h + nh))) if (h + nh) > 0 else 0
    return {"total_docs": total_docs, "total_helpful_votes": h + nh, "avg_helpful_pct": avg}


@api.get("/kb/categories")
async def kb_categories():
    cats = await db.kb_categories.find({"is_hidden": {"$ne": True}}, {"_id": 0}).sort("sort_order", 1).to_list(50)
    # Attach top 3 docs per category
    for c in cats:
        top = await db.kb_docs.find(
            {"category_id": c["id"], "is_published": True}, {"_id": 0, "id": 1, "title": 1}
        ).sort("view_count", -1).limit(3).to_list(3)
        c["top_docs"] = top
    return cats


@api.get("/kb/categories/{slug}")
async def kb_category_detail(slug: str):
    c = await db.kb_categories.find_one({"slug": slug}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Category not found")
    return c


@api.get("/kb/featured")
async def kb_featured(limit: int = 3):
    docs = await db.kb_docs.find(
        {"is_featured": True, "is_published": True}, {"_id": 0}
    ).sort("view_count", -1).limit(limit).to_list(limit)
    enriched = await _enrich_docs(docs)
    # Attach category info
    cat_ids = list({d["category_id"] for d in enriched})
    cats = {c["id"]: c for c in await db.kb_categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(len(cat_ids))}
    for d in enriched:
        c = cats.get(d["category_id"], {})
        d["category"] = {"slug": c.get("slug"), "name": c.get("name"), "icon": c.get("icon")}
    return enriched


@api.get("/kb/docs")
async def kb_list_docs(
    category: Optional[str] = None,
    q: Optional[str] = None,
    type: Optional[str] = None,
    difficulty: Optional[str] = None,
    version: Optional[str] = None,
    limit: int = 50,
):
    query = {"is_published": True}
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
    return {"docs": await _enrich_docs(docs), "total": total}


@api.get("/kb/docs/mine")
async def kb_my_docs(user: dict = Depends(get_current_user)):
    docs = await db.kb_docs.find(
        {"author_id": user["user_id"]}, {"_id": 0}
    ).sort("updated_at", -1).limit(200).to_list(200)
    return docs


@api.get("/kb/docs/{doc_id}")
async def kb_get_doc(doc_id: str):
    doc = await db.kb_docs.find_one({"id": doc_id, "is_published": True}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Document not found")
    await db.kb_docs.update_one({"id": doc_id}, {"$inc": {"view_count": 1}})
    doc["view_count"] = doc.get("view_count", 0) + 1
    enriched = (await _enrich_docs([doc]))[0]
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


class KBHelpfulIn(BaseModel):
    value: Literal["helpful", "not_helpful"]


@api.post("/kb/docs/{doc_id}/helpful")
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


@api.get("/kb/docs/{doc_id}/helpful/me")
async def kb_my_helpful(doc_id: str, user: dict = Depends(get_current_user)):
    v = await db.kb_helpful_votes.find_one({"doc_id": doc_id, "user_id": user["user_id"]}, {"_id": 0})
    return {"value": v["value"] if v else None}


# --- KB feedback (thumbs up/down) — new spec, supports change-vote ---
class KBFeedbackIn(BaseModel):
    helpful: bool


@api.post("/kb/docs/{doc_id}/feedback")
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


@api.get("/kb/docs/{doc_id}/feedback")
async def kb_get_my_feedback(doc_id: str, user: dict = Depends(get_current_user)):
    v = await db.kb_helpful_votes.find_one(
        {"doc_id": doc_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not v:
        return {"helpful": None}
    return {"helpful": v["value"] == "helpful"}


@api.post("/kb/bookmarks/{doc_id}")
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


# ---------- KB Contribution (authors) ----------
DocType = Literal["fix_guide", "how_to", "learning_bite", "reference", "checklist"]
Difficulty = Literal["beginner", "intermediate", "advanced"]


class KBDocIn(BaseModel):
    title: str
    summary: str
    body: str
    category_slug: str
    doc_type: DocType
    difficulty: Difficulty
    target_groups: List[GroupType] = ["aspirant", "practitioner", "employer"]
    tags: List[str] = []
    workday_version: Optional[str] = None
    publish: bool = True


@api.post("/kb/docs")
async def kb_create_doc(payload: KBDocIn, user: dict = Depends(get_current_user)):
    _check_active(user)
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


# ---------- Admin namespace ----------
@api.get("/admin/check")
async def admin_check(admin: dict = Depends(require_admin)):
    return {"is_admin": True, "username": admin["username"]}


@api.get("/admin/stats")
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


@api.get("/admin/signup-chart")
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


@api.get("/admin/recent-members")
async def admin_recent_members(limit: int = 10, admin: dict = Depends(require_admin)):
    return await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)


@api.get("/admin/recent-posts")
async def admin_recent_posts(limit: int = 10, admin: dict = Depends(require_admin)):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return await _enrich_posts(posts)


@api.get("/admin/logs")
async def admin_logs(limit: int = 50, admin: dict = Depends(require_admin)):
    return await db.admin_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)


# --- Members ---
@api.get("/admin/members")
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


class MemberPatchIn(BaseModel):
    group_type: Optional[GroupType] = None
    is_suspended: Optional[bool] = None
    is_admin: Optional[bool] = None


@api.patch("/admin/members/{user_id}")
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


@api.post("/admin/members/{user_id}/impersonate")
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


@api.delete("/admin/members/{user_id}")
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


# --- Posts ---
@api.get("/admin/posts")
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
    enriched = await _enrich_posts(posts)
    return {"posts": enriched, "total": total, "page": page, "page_size": page_size}


class PostPatchIn(BaseModel):
    is_pinned: Optional[bool] = None
    is_removed: Optional[bool] = None


@api.patch("/admin/posts/{post_id}")
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


@api.delete("/admin/posts/{post_id}")
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


# --- Reports ---
@api.get("/admin/reports")
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


@api.get("/admin/reports/pending-count")
async def admin_reports_pending_count(admin: dict = Depends(require_admin)):
    return {"count": await db.reports.count_documents({"status": "pending"})}


class ReportPatchIn(BaseModel):
    status: Literal["reviewed", "dismissed"]
    remove_content: Optional[bool] = False


@api.patch("/admin/reports/{report_id}")
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


# --- Spaces ---
@api.get("/admin/spaces")
async def admin_list_spaces(admin: dict = Depends(require_admin)):
    spaces = await db.spaces.find({}, {"_id": 0}).to_list(100)
    return spaces


class SpaceCreateIn(BaseModel):
    slug: str
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "Hash"


@api.post("/admin/spaces")
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


class SpacePatchIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_hidden: Optional[bool] = None


@api.patch("/admin/spaces/{slug}")
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


# --- Knowledge Base (admin) ---
@api.get("/admin/kb/stats")
async def admin_kb_stats(admin: dict = Depends(require_admin)):
    return {
        "total_docs": await db.kb_docs.count_documents({}),
        "published_docs": await db.kb_docs.count_documents({"is_published": True}),
        "drafts": await db.kb_docs.count_documents({"is_published": False}),
        "featured": await db.kb_docs.count_documents({"is_featured": True}),
        "total_categories": await db.kb_categories.count_documents({}),
    }


@api.get("/admin/kb/docs")
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
    enriched = await _enrich_docs(docs)
    cat_ids = list({d["category_id"] for d in enriched})
    cats = {c["id"]: c for c in await db.kb_categories.find({"id": {"$in": cat_ids}}, {"_id": 0}).to_list(len(cat_ids))}
    for d in enriched:
        c = cats.get(d["category_id"], {})
        d["category"] = {"slug": c.get("slug"), "name": c.get("name"), "icon": c.get("icon")}
    return {"docs": enriched, "total": total, "page": page, "page_size": page_size}


class KBDocPatchIn(BaseModel):
    is_published: Optional[bool] = None
    is_featured: Optional[bool] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    body: Optional[str] = None
    category_slug: Optional[str] = None
    doc_type: Optional[DocType] = None
    difficulty: Optional[Difficulty] = None
    target_groups: Optional[List[GroupType]] = None
    tags: Optional[List[str]] = None
    workday_version: Optional[str] = None


@api.patch("/admin/kb/docs/{doc_id}")
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


@api.delete("/admin/kb/docs/{doc_id}")
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


@api.get("/admin/kb/categories")
async def admin_kb_list_categories(admin: dict = Depends(require_admin)):
    return await db.kb_categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(100)


class KBCategoryCreateIn(BaseModel):
    slug: str
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "📚"
    sort_order: Optional[int] = 99


@api.post("/admin/kb/categories")
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


class KBCategoryPatchIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    is_hidden: Optional[bool] = None


@api.patch("/admin/kb/categories/{slug}")
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


# --- Settings ---
@api.get("/admin/settings")
async def admin_list_settings(admin: dict = Depends(require_admin)):
    docs = await db.settings.find({}, {"_id": 0}).to_list(50)
    return {d["key"]: d["value"] for d in docs}


@api.patch("/admin/settings")
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
    await db.reports.create_index([("status", 1), ("created_at", -1)])
    await db.admin_logs.create_index([("created_at", -1)])
    await db.kb_categories.create_index("slug", unique=True)
    await db.kb_docs.create_index("id", unique=True)
    await db.kb_docs.create_index([("category_id", 1), ("view_count", -1)])
    await db.kb_helpful_votes.create_index([("doc_id", 1), ("user_id", 1)], unique=True)
    await db.kb_bookmarks.create_index([("user_id", 1), ("doc_id", 1)], unique=True)
    from seed_data import seed_all
    await seed_all(db, hash_password)
    from seed_kb import seed_kb
    await seed_kb(db)
    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_doc = await db.users.find_one({"email": admin_email})
    if not admin_doc:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
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
            "is_admin": True,
            "is_suspended": False,
            "onboarded": True,
            "auth_provider": "email",
            "created_at": now_iso(),
        })
    else:
        # Ensure existing admin has is_admin=true
        await db.users.update_one({"email": admin_email}, {"$set": {"is_admin": True}})
    # Seed default settings
    DEFAULTS = {
        "community_name": "HCMOrbit",
        "community_tagline": "Where HCM professionals connect, learn, and grow",
        "registrations_open": "true",
        "require_email_verification": "false",
        "min_rep_downvote": "0",
        "min_rep_post": "0",
    }
    for k, v in DEFAULTS.items():
        await db.settings.update_one(
            {"key": k},
            {"$setOnInsert": {"key": k, "value": v, "updated_at": now_iso()}},
            upsert=True,
        )
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

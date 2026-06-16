"""Auth, profile, and user-profile endpoints."""
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, now_iso, hash_password, verify_password, create_token
from schemas import RegisterIn, LoginIn, ProfileSetupIn, EmergentSessionIn
from dependencies import get_current_user, get_setting

router = APIRouter()


@router.post("/auth/register")
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


@router.post("/auth/login")
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


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/auth/check-username")
async def check_username(body: dict):
    u = (body.get("username") or "").strip()
    if not u or len(u) < 3:
        return {"available": False, "reason": "Username must be at least 3 characters"}
    exists = await db.users.find_one({"username": u})
    return {"available": not bool(exists)}


@router.post("/auth/emergent-session")
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


@router.post("/auth/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        await db.user_sessions.delete_many({"session_token": token})
    return {"ok": True}


@router.post("/profile/setup")
async def profile_setup(payload: ProfileSetupIn, user: dict = Depends(get_current_user)):
    updates = payload.model_dump(exclude_none=True)
    updates["onboarded"] = True
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})


@router.get("/users/{username}")
async def get_user_profile(username: str):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    stats = {
        "questions": await db.posts.count_documents({"author_id": user["user_id"], "type": "question"}),
        "answers": await db.answers.count_documents({"author_id": user["user_id"]}),
        "accepted": await db.answers.count_documents({"author_id": user["user_id"], "is_accepted": True}),
        "votes_received": max(0, user.get("reputation_score", 0)) // 10,
        "posts": await db.posts.count_documents({"author_id": user["user_id"], "is_removed": {"$ne": True}}),
        "kb_articles": await db.kb_docs.count_documents({"author_id": user["user_id"], "is_published": True}),
        # Followers / following — placeholders until the follow system ships
        "followers": 0,
        "following": 0,
    }
    return {"user": user, "stats": stats}


@router.get("/users/{username}/posts")
async def get_user_posts(username: str, type: str | None = None):
    # Import locally to avoid circular import (community imports nothing from auth)
    from routes.community import enrich_posts
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")
    q = {"author_id": user["user_id"]}
    if type:
        q["type"] = type
    posts = await db.posts.find(q, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return await enrich_posts(posts)

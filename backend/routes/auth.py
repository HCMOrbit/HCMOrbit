"""Auth, profile, and user-profile endpoints."""
import asyncio
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, now_iso, hash_password, verify_password, create_token
from schemas import RegisterIn, LoginIn, ProfileSetupIn, EmergentSessionIn, ForgotPasswordIn, ResetPasswordIn
from dependencies import get_current_user, get_optional_user, get_setting
from welcome_emails import send_welcome_email
from password_reset_email import send_password_reset_email

router = APIRouter()


PASSWORD_RESET_TTL = timedelta(hours=1)


def _frontend_origin() -> str:
    """Resolve where the reset link should land. Prefer explicit FRONTEND_URL,
    else fall back to the production domain."""
    return os.environ.get("FRONTEND_URL", "https://hcmorbit.com").rstrip("/")


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
    # Fire-and-forget welcome email 1 (never blocks registration)
    asyncio.create_task(send_welcome_email(user, 1))
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


@router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    """Issue a single-use password-reset token and email it to the user.

    Always returns a success response — never reveals whether the email exists,
    to prevent user enumeration. Email send is fire-and-forget so response
    time is constant regardless of branch taken.
    """
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email, "auth_provider": "email"})
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + PASSWORD_RESET_TTL
        # Invalidate any previous outstanding tokens for this user
        await db.password_reset_tokens.delete_many({"user_id": user["user_id"]})
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["user_id"],
            "expires_at": expires_at,
            "created_at": now_iso(),
        })
        reset_url = f"{_frontend_origin()}/reset-password?token={token}"
        asyncio.create_task(send_password_reset_email(user["email"], user.get("full_name"), reset_url))
    return {"ok": True, "message": "If that email is associated with an account, a reset link is on its way."}


@router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    """Consume a password-reset token and set the new password."""
    if len(payload.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")

    record = await db.password_reset_tokens.find_one({"token": payload.token})
    if not record:
        raise HTTPException(400, "Invalid or already-used reset link.")
    expires_at = record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await db.password_reset_tokens.delete_one({"_id": record["_id"]})
        raise HTTPException(400, "This reset link has expired. Please request a new one.")

    user = await db.users.find_one({"user_id": record["user_id"]})
    if not user:
        await db.password_reset_tokens.delete_one({"_id": record["_id"]})
        raise HTTPException(400, "Invalid reset link.")

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": hash_password(payload.password)}},
    )
    await db.password_reset_tokens.delete_one({"_id": record["_id"]})
    return {"ok": True, "message": "Password updated. You can now sign in with your new password."}


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
        is_new_user = False
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
        is_new_user = True

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if is_new_user and user:
        asyncio.create_task(send_welcome_email(user, 1))
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
async def get_user_profile(username: str, me: dict | None = Depends(get_optional_user)):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    followers_count = await db.follows.count_documents({"following_id": user["user_id"]})
    following_count = await db.follows.count_documents({"follower_id": user["user_id"]})
    is_following = False
    if me and me["user_id"] != user["user_id"]:
        is_following = await db.follows.find_one(
            {"follower_id": me["user_id"], "following_id": user["user_id"]}
        ) is not None
    stats = {
        "questions": await db.posts.count_documents({"author_id": user["user_id"], "type": "question"}),
        "answers": await db.answers.count_documents({"author_id": user["user_id"]}),
        "accepted": await db.answers.count_documents({"author_id": user["user_id"], "is_accepted": True}),
        "votes_received": max(0, user.get("reputation_score", 0)) // 10,
        "posts": await db.posts.count_documents({"author_id": user["user_id"], "is_removed": {"$ne": True}}),
        "kb_articles": await db.kb_docs.count_documents({"author_id": user["user_id"], "is_published": True}),
        "followers": followers_count,
        "following": following_count,
    }
    return {"user": user, "stats": stats, "is_following": is_following}


@router.post("/users/{username}/follow")
async def follow_user(username: str, me: dict = Depends(get_current_user)):
    target = await db.users.find_one({"username": username}, {"_id": 0, "user_id": 1})
    if not target:
        raise HTTPException(404, "User not found")
    if target["user_id"] == me["user_id"]:
        raise HTTPException(400, "You cannot follow yourself")
    try:
        await db.follows.insert_one({
            "follower_id": me["user_id"],
            "following_id": target["user_id"],
            "created_at": now_iso(),
        })
    except Exception:
        # Duplicate key (unique index on follower_id+following_id) — already following
        pass
    followers_count = await db.follows.count_documents({"following_id": target["user_id"]})
    following_count = await db.follows.count_documents({"follower_id": target["user_id"]})
    return {"is_following": True, "followers_count": followers_count, "following_count": following_count}


@router.delete("/users/{username}/follow")
async def unfollow_user(username: str, me: dict = Depends(get_current_user)):
    target = await db.users.find_one({"username": username}, {"_id": 0, "user_id": 1})
    if not target:
        raise HTTPException(404, "User not found")
    if target["user_id"] == me["user_id"]:
        raise HTTPException(400, "You cannot unfollow yourself")
    await db.follows.delete_one(
        {"follower_id": me["user_id"], "following_id": target["user_id"]}
    )
    followers_count = await db.follows.count_documents({"following_id": target["user_id"]})
    following_count = await db.follows.count_documents({"follower_id": target["user_id"]})
    return {"is_following": False, "followers_count": followers_count, "following_count": following_count}


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

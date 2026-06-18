"""Shared FastAPI dependencies and helper coroutines used across route modules.

These functions touch the DB and may raise HTTPException, so they live close
to FastAPI but stay independent of any specific router.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request

from core import db, JWT_SECRET, JWT_ALGORITHM, now_iso


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


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin access required")
    return user


async def get_optional_user(request: Request) -> Optional[dict]:
    """Return the authenticated user if a valid token is present, else None.
    Never raises — used by endpoints that work for both anon and authed users."""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


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


def check_active(user: dict):
    if user.get("is_suspended"):
        raise HTTPException(403, "Your account is suspended. You can read but not post or vote.")


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

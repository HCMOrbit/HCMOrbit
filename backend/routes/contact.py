"""Public contact endpoint — accepts submissions from the /connect page.

Stores the message in MongoDB unconditionally and best-effort emails
ADMIN_EMAIL via Resend when RESEND_API_KEY is configured. Includes a
sliding-window per-IP rate limit (5/hour) modeled on the ecosystem submit
endpoint.
"""
import os
import time
import uuid
import asyncio
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from core import db, now_iso, log

router = APIRouter()

ADMIN_NOTIFY_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@hcmorbit.com")

# ── Rate limit ──────────────────────────────────────────────────────────────
_RL_WINDOW_S = 3600
_RL_MAX_HITS = 5
_hits: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return (request.client.host if request.client else "unknown") or "unknown"


def _check_rate_limit(request: Request) -> None:
    ip = _client_ip(request)
    now = time.monotonic()
    cutoff = now - _RL_WINDOW_S
    fresh = [t for t in _hits[ip] if t > cutoff]
    if len(fresh) >= _RL_MAX_HITS:
        _hits[ip] = fresh
        raise HTTPException(status_code=429, detail="Too many messages — please try again later")
    fresh.append(now)
    _hits[ip] = fresh


# ── Schema ──────────────────────────────────────────────────────────────────
TOPIC_CHOICES = {"partnership", "press", "speaking", "feedback", "support", "other"}


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    topic: str = Field(min_length=1, max_length=40)
    message: str = Field(min_length=10, max_length=5000)
    company: Optional[str] = Field(default=None, max_length=200)


# ── Email helper ────────────────────────────────────────────────────────────
async def _send_email_notification(doc: dict) -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    reply_to = doc.get("email")
    try:
        import resend
        resend.api_key = api_key
        html = (
            "<h3 style='font-family:system-ui;color:#0A1628;margin-bottom:8px'>"
            "New HCMOrbit contact message</h3>"
            "<table style='font-family:system-ui;font-size:14px;line-height:1.5;color:#0F172A'>"
            f"<tr><td style='padding:4px 12px 4px 0;color:#64748B'>From</td>"
            f"<td><b>{doc.get('name')}</b> &lt;{doc.get('email')}&gt;</td></tr>"
            f"<tr><td style='padding:4px 12px 4px 0;color:#64748B'>Topic</td>"
            f"<td>{doc.get('topic')}</td></tr>"
            + (f"<tr><td style='padding:4px 12px 4px 0;color:#64748B'>Company</td>"
               f"<td>{doc.get('company')}</td></tr>" if doc.get("company") else "")
            + f"<tr><td style='padding:4px 12px 4px 0;color:#64748B'>Submitted</td>"
            f"<td>{doc.get('submitted_at')}</td></tr>"
            "</table>"
            "<hr style='border:none;border-top:1px solid #E2E8F0;margin:16px 0'>"
            f"<p style='white-space:pre-wrap;font-family:system-ui;font-size:14px;"
            f"line-height:1.6;color:#0F172A'>{doc.get('message','')}</p>"
        )
        params = {
            "from": sender,
            "to": [ADMIN_NOTIFY_EMAIL],
            "subject": f"[HCMOrbit] {doc.get('topic','general').title()} — {doc.get('name')}",
            "html": html,
            "reply_to": reply_to,
        }
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:  # noqa: BLE001
        log.warning(f"Contact email notification failed (saved to DB regardless): {e}")


# ── Route ───────────────────────────────────────────────────────────────────
@router.post("/contact")
async def submit_contact(payload: ContactIn, request: Request):
    _check_rate_limit(request)
    topic = payload.topic.strip().lower()
    if topic not in TOPIC_CHOICES:
        topic = "other"
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "email": payload.email,
        "topic": topic,
        "company": (payload.company or "").strip() or None,
        "message": payload.message.strip(),
        "submitted_at": now_iso(),
        "ip": _client_ip(request),
    }
    await db.contact_messages.insert_one(dict(doc))
    await _send_email_notification(doc)
    return {"ok": True}

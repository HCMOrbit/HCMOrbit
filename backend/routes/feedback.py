"""Public feedback endpoint — accepts submissions from the WhyHCMOrbit
'Let's Sync → Feedback' modal. Writes to MongoDB unconditionally and best-effort
emails admin@hcmorbit.com via Resend when RESEND_API_KEY is configured.
"""
import os
import uuid
import asyncio
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field

from core import db, now_iso, log

router = APIRouter()

ADMIN_NOTIFY_EMAIL = os.environ.get("FEEDBACK_NOTIFY_EMAIL", "admin@hcmorbit.com")


class FeedbackIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    message: str = Field(min_length=1, max_length=5000)
    source: Optional[str] = "founder_page"


async def _send_email_notification(doc: dict):
    """Best-effort email via Resend. Silent no-op when not configured."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return
    sender = os.environ.get("FEEDBACK_SENDER_EMAIL", "onboarding@resend.dev")
    try:
        import resend
        resend.api_key = api_key
        html = (
            f"<h3>New HCMOrbit feedback</h3>"
            f"<p><b>From:</b> {doc.get('name') or '(anonymous)'} &lt;{doc.get('email') or 'n/a'}&gt;<br>"
            f"<b>Source:</b> {doc.get('source')}<br>"
            f"<b>Submitted:</b> {doc.get('submitted_at')}</p>"
            f"<hr><p style='white-space:pre-wrap;font-family:system-ui'>{doc.get('message','')}</p>"
        )
        params = {
            "from": sender,
            "to": [ADMIN_NOTIFY_EMAIL],
            "subject": f"HCMOrbit feedback from {doc.get('name') or 'anonymous'}",
            "html": html,
        }
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:  # noqa: BLE001
        log.warning(f"Feedback email notification failed (saved to DB regardless): {e}")


@router.post("/feedback")
async def submit_feedback(payload: FeedbackIn):
    doc = {
        "id": str(uuid.uuid4()),
        "name": (payload.name or "").strip() or None,
        "email": (payload.email or None),
        "message": payload.message.strip(),
        "source": (payload.source or "founder_page").strip() or "founder_page",
        "submitted_at": now_iso(),
    }
    await db.feedback.insert_one(dict(doc))
    # Email is best-effort and non-blocking from the caller's perspective
    await _send_email_notification(doc)
    return {"ok": True}

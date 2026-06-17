"""HCMOrbit 3-step welcome email sequence.

Sends a personal-style sequence from Suchismita Tripathy via Resend:
  - Email 1: Immediately on registration
  - Email 2: ~2 days after signup
  - Email 3: ~5 days after signup

Email delivery is best-effort and non-blocking. Failure to send never
breaks registration; the scheduled job retries on the next tick (every hour).

Each successful send sets `welcome_email_{N}_sent` (ISO timestamp) on the
user document so the scheduler only ever sends once per email.
"""
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from core import db, now_iso

log = logging.getLogger("welcome_emails")

# Resend / sender config (read at call time so env updates take effect on restart)
def _resend_config():
    return {
        "api_key": os.environ.get("RESEND_API_KEY"),
        "sender": os.environ.get("SENDER_EMAIL", "suchi@hcmorbit.com"),
        "reply_to": os.environ.get("REPLY_TO_EMAIL", "suchi@hcmorbit.com"),
    }


SIGNATURE_HTML = """
<p style="margin-top:32px;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.55;">
  Warmly,<br>
  <b>Suchismita Tripathy</b><br>
  Founder | HCMOrbit<br>
  <i style="color:#475569;">The Community Where Workday Professionals Learn, Solve, and Grow</i>
</p>
<p style="font-family:system-ui,-apple-system,sans-serif;color:#475569;font-size:14px;">
  <a href="https://hcmorbit.com" style="color:#2563eb;">hcmorbit.com</a>
  &nbsp;|&nbsp;
  <a href="https://calendar.app.google/xPmeV4iQ9WKi3ezY8" style="color:#2563eb;">Book a 1:1</a>
  &nbsp;|&nbsp;
  <a href="mailto:suchi@hcmorbit.com" style="color:#2563eb;">suchi@hcmorbit.com</a>
</p>
"""


def _wrap(body_html: str) -> str:
    """Wrap email body in a clean responsive shell."""
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <div style="max-width:640px;margin:24px auto;padding:32px;background:#ffffff;border-radius:12px;
              font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;line-height:1.6;">
    {body_html}
    {SIGNATURE_HTML}
  </div>
</body></html>"""


def _email_1_html(full_name: str | None) -> tuple[str, str]:
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi there,"
    body = f"""
    <p style="font-size:16px;">{greeting}</p>

    <p>Welcome to <b>HCMOrbit</b> — I'm so glad you joined.</p>

    <p style="border-left:3px solid #2563eb;padding-left:14px;color:#334155;font-style:italic;">
      I created HCMOrbit because the knowledge exists but it's scattered across consultants,
      project documents, Slack conversations, and tribal knowledge. HCMOrbit was built to bring
      that knowledge together.
    </p>

    <p>Here's where to start exploring:</p>
    <ul style="padding-left:18px;">
      <li><a href="https://hcmorbit.com/knowledge-base" style="color:#2563eb;font-weight:600;">Knowledge Base</a>
         — structured guides, references, and checklists across Workday modules.</li>
      <li><a href="https://hcmorbit.com/community" style="color:#2563eb;font-weight:600;">Community</a>
         — ask questions, share success stories, and learn from practitioners.</li>
      <li><a href="https://hcmorbit.com/career-hub" style="color:#2563eb;font-weight:600;">Career Hub</a>
         — interview prep, learning paths, and career growth.</li>
    </ul>

    <p style="background:#f1f5f9;padding:14px 16px;border-radius:8px;">
      <b>Quick ask:</b> What brought you to HCMOrbit? Just hit reply and tell me your role,
      which Workday modules you work with, and what challenges you'd like to solve.
      I read every message.
    </p>
    """
    return "Welcome to HCMOrbit", _wrap(body)


def _email_2_html(full_name: str | None) -> tuple[str, str]:
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi there,"
    body = f"""
    <p style="font-size:16px;">{greeting}</p>

    <p>A few days in — here are the <b>top 5 resources every Workday professional should know</b>
       on HCMOrbit:</p>

    <ol style="padding-left:20px;">
      <li style="margin-bottom:10px;">
        <a href="https://hcmorbit.com/knowledge-base" style="color:#2563eb;font-weight:600;">Knowledge Base</a>
        — start here. Module-by-module guides covering HCM Core, Security, Reporting,
        Integrations, Payroll, Talent, Recruiting, and more.
      </li>
      <li style="margin-bottom:10px;">
        <a href="https://hcmorbit.com/knowledge-base?category=security-governance" style="color:#2563eb;font-weight:600;">Governance &amp; Security articles</a>
        — the most underrated skill in any Workday team. These guides will save you weeks of
        trial-and-error.
      </li>
      <li style="margin-bottom:10px;">
        <a href="https://hcmorbit.com/career-hub" style="color:#2563eb;font-weight:600;">Interview prep in Career Hub</a>
        — real questions, scenario walk-throughs, and what hiring managers actually look for.
      </li>
      <li style="margin-bottom:10px;">
        <a href="https://hcmorbit.com/community" style="color:#2563eb;font-weight:600;">Community discussions</a>
        — see what fellow practitioners are wrestling with right now. Jump in with an answer
        or ask your own.
      </li>
      <li style="margin-bottom:10px;">
        <a href="https://hcmorbit.com/career-hub" style="color:#2563eb;font-weight:600;">Career Hub learning paths</a>
        — whether you're just starting or moving into architecture, there's a path mapped out for you.
      </li>
    </ol>

    <p>Bookmark anything that's useful — it'll show up under your profile so you can come back to it.</p>
    """
    return "Top 5 resources every Workday professional should know", _wrap(body)


def _email_3_html(full_name: str | None) -> tuple[str, str]:
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi there,"
    body = f"""
    <p style="font-size:16px;">{greeting}</p>

    <p>Quick one — <b>what's your biggest Workday challenge right now?</b></p>

    <p>I'd love to know where you're spending the most energy these days. Is it:</p>

    <ul style="padding-left:18px;">
      <li><b>Security</b> — domains, roles, segmented security, audit pressure?</li>
      <li><b>Reporting</b> — calc fields, composite reports, Prism, dashboards?</li>
      <li><b>Integrations</b> — Studio, EIBs, Core Connectors, web services?</li>
      <li><b>Recruiting / Talent</b> — candidate flow, requisitions, performance cycles?</li>
      <li><b>Career growth</b> — making the next move into architecture, lead, or consulting?</li>
    </ul>

    <p>Hit reply with whichever one (or two) resonates. Your answer helps me prioritize what
       to build next on HCMOrbit — and I'll point you to the resources, people, and articles
       that can help most.</p>

    <p>Looking forward to hearing from you.</p>
    """
    return "What's your biggest Workday challenge?", _wrap(body)


EMAIL_BUILDERS = {
    1: _email_1_html,
    2: _email_2_html,
    3: _email_3_html,
}


async def _send_via_resend(to_email: str, subject: str, html: str) -> bool:
    """Send a single email via Resend. Returns True on success."""
    cfg = _resend_config()
    if not cfg["api_key"]:
        log.warning("RESEND_API_KEY not configured — skipping welcome email send.")
        return False
    try:
        import resend
        resend.api_key = cfg["api_key"]
        params = {
            "from": cfg["sender"],
            "to": [to_email],
            "subject": subject,
            "html": html,
            "reply_to": cfg["reply_to"],
        }
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:  # noqa: BLE001
        log.warning(f"Welcome email send failed (to={to_email}): {e}")
        return False


async def send_welcome_email(user: dict, step: int) -> bool:
    """Send welcome email `step` (1, 2, or 3) to user. Updates user record on success."""
    builder = EMAIL_BUILDERS.get(step)
    if not builder:
        log.error(f"Unknown welcome email step: {step}")
        return False
    if not user.get("email"):
        return False
    subject, html = builder(user.get("full_name"))
    sent = await _send_via_resend(user["email"], subject, html)
    if sent:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {f"welcome_email_{step}_sent": now_iso()}},
        )
        log.info(f"Welcome email {step} sent to {user['email']}")
    return sent


# -------- Scheduler job --------
EMAIL_DELAYS = {
    2: timedelta(days=2),
    3: timedelta(days=5),
}


async def process_welcome_queue():
    """Hourly task: send pending email 2 and 3 to users past their delay.

    Throttled at ~3 req/sec to stay safely below Resend's 5 req/sec limit.
    Excludes seed/demo users whose emails are on the internal *.demo domain.
    """
    now = datetime.now(timezone.utc)
    for step, delay in EMAIL_DELAYS.items():
        cutoff = (now - delay).isoformat()
        # Users whose signup is older than the cutoff AND haven't received this step
        cursor = db.users.find({
            "auth_provider": {"$in": ["email", "google"]},
            "created_at": {"$lte": cutoff},
            f"welcome_email_{step}_sent": {"$exists": False},
            "email": {"$exists": True, "$ne": None, "$not": {"$regex": "@hcmorbit\\.demo$"}},
        }).limit(100)
        async for user in cursor:
            user.pop("_id", None)
            await send_welcome_email(user, step)
            await asyncio.sleep(0.35)  # ~3 req/sec — safely under Resend's 5/sec cap

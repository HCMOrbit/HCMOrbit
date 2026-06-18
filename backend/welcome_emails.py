"""HCMOrbit 3-step welcome email sequence.

Sends a personal-style sequence from Suchismita Tripathy via Resend:
  - Email 1: Immediately on registration
  - Email 2: ~2 days after signup
  - Email 3: ~5 days after signup

Email delivery is best-effort and non-blocking. Failure to send never
breaks registration; the scheduled job retries on the next tick (every hour).

Each successful send sets `welcome_email_{N}_sent` (ISO timestamp) on the
user document so the scheduler only ever sends once per email.

┌──────────────────────────────────────────────────────────────────────────┐
│ SYNC CHECKLIST — keep in lock-step with                                  │
│   /app/frontend/src/lib/welcomeEmailTemplates.js                         │
│                                                                          │
│ When you change ANY of the following strings here, mirror the change     │
│ in the JS file (used by /admin/email-previews):                          │
│                                                                          │
│   Email 1 subject : "Welcome to HCMOrbit"                                │
│   Email 2 subject : "Top 5 resources every Workday professional should   │
│                     know"                                                │
│   Email 3 subject : "What's your biggest Workday challenge?"             │
│                                                                          │
│   CTA labels     : "Quick ask:" / "Pro tip:" / "Hit reply"               │
│   Founder quote  : starts with "I created HCMOrbit because the           │
│                    knowledge exists"                                     │
│   Signature      : "Suchismita Tripathy" / "Founder | HCMOrbit"          │
│   Footer         : "You received this because you joined HCMOrbit."      │
│                                                                          │
│ `tests/test_template_sync.py` runs in CI and fails the build if the      │
│ two files drift apart — but the comment above is your at-a-glance        │
│ reminder while editing.                                                  │
└──────────────────────────────────────────────────────────────────────────┘
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
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:20px;">
  <tr><td style="font-family:Arial,Helvetica,sans-serif;color:#1B3A6B;line-height:1.55;font-size:15px;">
    Warmly,<br>
    <strong style="font-weight:700;">Suchismita Tripathy</strong><br>
    <span style="color:#1B3A6B;">Founder | HCMOrbit</span><br>
    <em style="color:#6b7280;font-size:13px;">The Community Where Workday Professionals Learn, Solve, and Grow</em>
  </td></tr>
  <tr><td style="padding-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0D9373;">
    <a href="https://hcmorbit.com" style="color:#0D9373;text-decoration:none;font-weight:600;">hcmorbit.com</a>
    &nbsp;<span style="color:#cbd5e1;">|</span>&nbsp;
    <a href="https://calendar.app.google/xPmeV4iQ9WKi3ezY8" style="color:#0D9373;text-decoration:none;font-weight:600;">Book a 1:1</a>
    &nbsp;<span style="color:#cbd5e1;">|</span>&nbsp;
    <a href="mailto:suchi@hcmorbit.com" style="color:#0D9373;text-decoration:none;font-weight:600;">suchi@hcmorbit.com</a>
  </td></tr>
</table>
"""

HEADER_HTML = """
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:#1B3A6B;border-radius:8px 8px 0 0;">
  <tr><td style="padding:32px 32px 24px 32px;font-family:Arial,Helvetica,sans-serif;text-align:left;">
    <div style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:0.5px;line-height:1;">
      HCM<span style="color:#5EEAD4;">Orbit</span>
    </div>
    <div style="color:#cbd5e1;font-size:13px;margin-top:8px;line-height:1.4;">
      The Community Where Workday Professionals Learn, Solve, and Grow
    </div>
  </td></tr>
</table>
"""

def _footer_html() -> str:
    """Build the email footer with the current UTC year (computed at render time)."""
    year = datetime.now(timezone.utc).year
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:#f3f4f6;border-radius:0 0 8px 8px;">
  <tr><td style="padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-align:center;line-height:1.5;">
    You received this because you joined HCMOrbit.<br>
    &copy; {year} HCMOrbit. All rights reserved.
  </td></tr>
</table>
"""


def _wrap(body_html: str) -> str:
    """Wrap email body in a branded, email-client-safe shell."""
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;
                    box-shadow:0 1px 2px rgba(15,23,42,0.06);">
        <tr><td>{HEADER_HTML}</td></tr>
        <tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;font-size:15px;">
          {body_html}
          {SIGNATURE_HTML}
        </td></tr>
        <tr><td>{_footer_html()}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _resource_card(emoji: str, title: str, url: str, description: str) -> str:
    """Single styled resource card with teal left border."""
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin:10px 0;background:#f9fafb;border-left:4px solid #0D9373;border-radius:4px;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;">
        <a href="{url}" style="color:#1B3A6B;text-decoration:none;font-weight:700;font-size:16px;">
          <span style="margin-right:8px;">{emoji}</span>{title}
        </a>
        <div style="color:#4b5563;font-size:14px;line-height:1.55;margin-top:4px;">{description}</div>
      </td></tr>
    </table>
    """


def _email_1_html(full_name: str | None) -> tuple[str, str]:
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi there,"
    cards = (
        _resource_card("📚", "Knowledge Base", "https://hcmorbit.com/knowledge-base",
                       "Structured guides, references, and checklists across Workday modules.")
        + _resource_card("💬", "Community", "https://hcmorbit.com/community",
                         "Ask questions, share success stories, and learn from practitioners.")
        + _resource_card("🚀", "Career Hub", "https://hcmorbit.com/career-hub",
                         "Interview prep, learning paths, and career growth.")
    )
    body = f"""
    <p style="font-size:16px;margin:0 0 14px 0;">{greeting}</p>

    <p style="margin:0 0 16px 0;">Welcome to <strong>HCMOrbit</strong> — I'm so glad you joined.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin:18px 0;background:#f3f4f6;border-left:4px solid #0D9373;border-radius:4px;">
      <tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-style:italic;color:#374151;line-height:1.6;">
        I created HCMOrbit because the knowledge exists but it's scattered across consultants,
        project documents, Slack conversations, and tribal knowledge. HCMOrbit was built to bring
        that knowledge together.
      </td></tr>
    </table>

    <p style="margin:24px 0 8px 0;font-weight:600;color:#1B3A6B;">Here's where to start exploring:</p>
    {cards}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-top:24px;background:#E1F5EE;border-radius:6px;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#0f5132;line-height:1.6;">
        <strong style="color:#0D9373;">Quick ask:</strong> What brought you to HCMOrbit?
        Just hit reply and tell me your role, which Workday modules you work with, and what
        challenges you'd like to solve. I read every message.
      </td></tr>
    </table>
    """
    return "Welcome to HCMOrbit", _wrap(body)


def _email_2_html(full_name: str | None) -> tuple[str, str]:
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi there,"
    cards = (
        _resource_card("📚", "Knowledge Base", "https://hcmorbit.com/knowledge-base",
                       "Start here. Module-by-module guides covering HCM Core, Security, Reporting, "
                       "Integrations, Payroll, Talent, Recruiting, and more.")
        + _resource_card("🛡️", "Governance & Security articles",
                         "https://hcmorbit.com/knowledge-base?category=security-governance",
                         "The most underrated skill in any Workday team. These guides will save you "
                         "weeks of trial-and-error.")
        + _resource_card("🎯", "Interview prep in Career Hub", "https://hcmorbit.com/career-hub",
                         "Real questions, scenario walk-throughs, and what hiring managers actually look for.")
        + _resource_card("💬", "Community discussions", "https://hcmorbit.com/community",
                         "See what fellow practitioners are wrestling with right now. Jump in with an "
                         "answer or ask your own.")
        + _resource_card("🚀", "Career Hub learning paths", "https://hcmorbit.com/career-hub",
                         "Whether you're just starting or moving into architecture, there's a path "
                         "mapped out for you.")
    )
    body = f"""
    <p style="font-size:16px;margin:0 0 14px 0;">{greeting}</p>

    <p style="margin:0 0 16px 0;">A few days in — here are the
       <strong>top 5 resources every Workday professional should know</strong> on HCMOrbit:</p>

    {cards}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-top:24px;background:#E1F5EE;border-radius:6px;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#0f5132;line-height:1.6;">
        <strong style="color:#0D9373;">Pro tip:</strong> Bookmark anything that's useful —
        it'll show up under your profile so you can come back to it.
      </td></tr>
    </table>
    """
    return "Top 5 resources every Workday professional should know", _wrap(body)


def _email_3_html(full_name: str | None) -> tuple[str, str]:
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi there,"
    cards = (
        _resource_card("🛡️", "Security",
                       "https://hcmorbit.com/community",
                       "Domains, roles, segmented security, audit pressure?")
        + _resource_card("📊", "Reporting",
                         "https://hcmorbit.com/community",
                         "Calc fields, composite reports, Prism, dashboards?")
        + _resource_card("🔗", "Integrations",
                         "https://hcmorbit.com/community",
                         "Studio, EIBs, Core Connectors, web services?")
        + _resource_card("👥", "Recruiting / Talent",
                         "https://hcmorbit.com/community",
                         "Candidate flow, requisitions, performance cycles?")
        + _resource_card("🚀", "Career growth",
                         "https://hcmorbit.com/career-hub",
                         "Making the next move into architecture, lead, or consulting?")
    )
    body = f"""
    <p style="font-size:16px;margin:0 0 14px 0;">{greeting}</p>

    <p style="margin:0 0 16px 0;">Quick one — <strong>what's your biggest Workday challenge right now?</strong></p>

    <p style="margin:0 0 8px 0;">I'd love to know where you're spending the most energy these days. Is it:</p>

    {cards}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-top:24px;background:#E1F5EE;border-radius:6px;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#0f5132;line-height:1.6;">
        <strong style="color:#0D9373;">Hit reply</strong> with whichever one (or two) resonates.
        Your answer helps me prioritize what to build next on HCMOrbit — and I'll point you to the
        resources, people, and articles that can help most.
      </td></tr>
    </table>

    <p style="margin-top:18px;color:#4b5563;">Looking forward to hearing from you.</p>
    """
    return "What's your biggest Workday challenge?", _wrap(body)


EMAIL_BUILDERS = {
    1: _email_1_html,
    2: _email_2_html,
    3: _email_3_html,
}


def render_welcome_html(step: int, full_name: str | None) -> tuple[str, str] | None:
    """Return (subject, html) for the given step, or None if step is invalid.
    Used by admin tools that need to render or send a specific welcome email
    without touching any user record."""
    builder = EMAIL_BUILDERS.get(step)
    if not builder:
        return None
    return builder(full_name)


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

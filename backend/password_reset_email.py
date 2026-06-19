"""Transactional emails — currently the password-reset email.

Shares the branded shell (header/footer/signature) with the welcome sequence
in `welcome_emails.py` to keep the visual language consistent.
"""
import asyncio
import logging
import os

log = logging.getLogger("password_reset_email")


# Import the shared visual primitives from welcome_emails so any branding
# update propagates automatically.
from welcome_emails import HEADER_HTML, SIGNATURE_HTML, _footer_html, _send_via_resend


def _wrap(body_html: str) -> str:
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


def render_password_reset_html(full_name: str | None, reset_url: str) -> tuple[str, str]:
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi there,"
    body = f"""
    <p style="font-size:16px;margin:0 0 14px 0;">{greeting}</p>

    <p style="margin:0 0 16px 0;">Someone (hopefully you) asked to reset the password for your HCMOrbit account.</p>

    <p style="margin:0 0 22px 0;">Click the button below to choose a new password. This link is valid for
       <strong>1 hour</strong>.</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px 0;">
      <tr><td align="center" style="border-radius:6px;background:#0D9373;">
        <a href="{reset_url}"
           style="display:inline-block;padding:12px 28px;border-radius:6px;background:#0D9373;color:#ffffff;
                  font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;">
          Reset my password
        </a>
      </td></tr>
    </table>

    <p style="margin:0 0 14px 0;font-size:13px;color:#475569;">
      Or paste this link into your browser:<br>
      <a href="{reset_url}" style="color:#0D9373;word-break:break-all;">{reset_url}</a>
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-top:22px;background:#E1F5EE;border-radius:6px;">
      <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;color:#0f5132;line-height:1.55;font-size:13px;">
        <strong style="color:#0D9373;">Didn't request this?</strong> You can safely ignore this email —
        your password won't change unless you click the link above.
      </td></tr>
    </table>
    """
    return "Reset your HCMOrbit password", _wrap(body)


async def send_password_reset_email(to_email: str, full_name: str | None, reset_url: str) -> bool:
    """Send a password-reset email. Returns True iff Resend accepted it.

    Failures are logged but never raise — registration/forgot-password flows
    rely on always-success behavior to prevent user enumeration.
    """
    if not os.environ.get("RESEND_API_KEY"):
        log.warning("RESEND_API_KEY not configured — skipping password reset email.")
        return False
    subject, html = render_password_reset_html(full_name, reset_url)
    return await _send_via_resend(to_email, subject, html)

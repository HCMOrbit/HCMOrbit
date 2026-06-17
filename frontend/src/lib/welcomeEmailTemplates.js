/**
 * Client-side port of `/app/backend/welcome_emails.py` template builders.
 * Used by `/admin/email-previews` to render each welcome email in an iframe
 * without round-tripping to the server. Keep this file in sync with the
 * Python templates when copy / branding changes.
 */

const HEADER_HTML = `
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
</table>`;

const SIGNATURE_HTML = `
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
</table>`;

const footerHtml = () => {
  const year = new Date().getUTCFullYear();
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background:#f3f4f6;border-radius:0 0 8px 8px;">
  <tr><td style="padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-align:center;line-height:1.5;">
    You received this because you joined HCMOrbit.<br>
    &copy; ${year} HCMOrbit. All rights reserved.
  </td></tr>
</table>`;
};

const wrap = (bodyHtml) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;
                    box-shadow:0 1px 2px rgba(15,23,42,0.06);">
        <tr><td>${HEADER_HTML}</td></tr>
        <tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;font-size:15px;">
          ${bodyHtml}
          ${SIGNATURE_HTML}
        </td></tr>
        <tr><td>${footerHtml()}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const resourceCard = (emoji, title, url, description) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="margin:10px 0;background:#f9fafb;border-left:4px solid #0D9373;border-radius:4px;">
  <tr><td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;">
    <a href="${url}" style="color:#1B3A6B;text-decoration:none;font-weight:700;font-size:16px;">
      <span style="margin-right:8px;">${emoji}</span>${title}
    </a>
    <div style="color:#4b5563;font-size:14px;line-height:1.55;margin-top:4px;">${description}</div>
  </td></tr>
</table>`;

const greet = (fullName) =>
  fullName && fullName.trim() ? `Hi ${fullName.trim().split(/\s+/)[0]},` : "Hi there,";

function email1(fullName) {
  const cards =
    resourceCard("📚", "Knowledge Base", "https://hcmorbit.com/knowledge-base",
      "Structured guides, references, and checklists across Workday modules.") +
    resourceCard("💬", "Community", "https://hcmorbit.com/community",
      "Ask questions, share success stories, and learn from practitioners.") +
    resourceCard("🚀", "Career Hub", "https://hcmorbit.com/career-hub",
      "Interview prep, learning paths, and career growth.");
  const body = `
    <p style="font-size:16px;margin:0 0 14px 0;">${greet(fullName)}</p>
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
    ${cards}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-top:24px;background:#E1F5EE;border-radius:6px;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#0f5132;line-height:1.6;">
        <strong style="color:#0D9373;">Quick ask:</strong> What brought you to HCMOrbit?
        Just hit reply and tell me your role, which Workday modules you work with, and what
        challenges you'd like to solve. I read every message.
      </td></tr>
    </table>`;
  return { subject: "Welcome to HCMOrbit", html: wrap(body) };
}

function email2(fullName) {
  const cards =
    resourceCard("📚", "Knowledge Base", "https://hcmorbit.com/knowledge-base",
      "Start here. Module-by-module guides covering HCM Core, Security, Reporting, Integrations, Payroll, Talent, Recruiting, and more.") +
    resourceCard("🛡️", "Governance & Security articles",
      "https://hcmorbit.com/knowledge-base?category=security-governance",
      "The most underrated skill in any Workday team. These guides will save you weeks of trial-and-error.") +
    resourceCard("🎯", "Interview prep in Career Hub", "https://hcmorbit.com/career-hub",
      "Real questions, scenario walk-throughs, and what hiring managers actually look for.") +
    resourceCard("💬", "Community discussions", "https://hcmorbit.com/community",
      "See what fellow practitioners are wrestling with right now. Jump in with an answer or ask your own.") +
    resourceCard("🚀", "Career Hub learning paths", "https://hcmorbit.com/career-hub",
      "Whether you're just starting or moving into architecture, there's a path mapped out for you.");
  const body = `
    <p style="font-size:16px;margin:0 0 14px 0;">${greet(fullName)}</p>
    <p style="margin:0 0 16px 0;">A few days in — here are the
       <strong>top 5 resources every Workday professional should know</strong> on HCMOrbit:</p>
    ${cards}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-top:24px;background:#E1F5EE;border-radius:6px;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#0f5132;line-height:1.6;">
        <strong style="color:#0D9373;">Pro tip:</strong> Bookmark anything that's useful —
        it'll show up under your profile so you can come back to it.
      </td></tr>
    </table>`;
  return { subject: "Top 5 resources every Workday professional should know", html: wrap(body) };
}

function email3(fullName) {
  const cards =
    resourceCard("🛡️", "Security", "https://hcmorbit.com/community",
      "Domains, roles, segmented security, audit pressure?") +
    resourceCard("📊", "Reporting", "https://hcmorbit.com/community",
      "Calc fields, composite reports, Prism, dashboards?") +
    resourceCard("🔗", "Integrations", "https://hcmorbit.com/community",
      "Studio, EIBs, Core Connectors, web services?") +
    resourceCard("👥", "Recruiting / Talent", "https://hcmorbit.com/community",
      "Candidate flow, requisitions, performance cycles?") +
    resourceCard("🚀", "Career growth", "https://hcmorbit.com/career-hub",
      "Making the next move into architecture, lead, or consulting?");
  const body = `
    <p style="font-size:16px;margin:0 0 14px 0;">${greet(fullName)}</p>
    <p style="margin:0 0 16px 0;">Quick one — <strong>what's your biggest Workday challenge right now?</strong></p>
    <p style="margin:0 0 8px 0;">I'd love to know where you're spending the most energy these days. Is it:</p>
    ${cards}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
           style="margin-top:24px;background:#E1F5EE;border-radius:6px;">
      <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;color:#0f5132;line-height:1.6;">
        <strong style="color:#0D9373;">Hit reply</strong> with whichever one (or two) resonates.
        Your answer helps me prioritize what to build next on HCMOrbit — and I'll point you to the
        resources, people, and articles that can help most.
      </td></tr>
    </table>
    <p style="margin-top:18px;color:#4b5563;">Looking forward to hearing from you.</p>`;
  return { subject: "What's your biggest Workday challenge?", html: wrap(body) };
}

export const WELCOME_EMAILS = {
  1: { label: "Email 1 — Welcome", build: email1 },
  2: { label: "Email 2 — Top 5 resources", build: email2 },
  3: { label: "Email 3 — Biggest challenge", build: email3 },
};

export function buildWelcomeEmail(step, fullName) {
  const entry = WELCOME_EMAILS[step];
  if (!entry) return { subject: "", html: "" };
  return entry.build(fullName);
}

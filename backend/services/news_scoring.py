"""Workday Relevance Scoring for Community News.

Pure functions — no I/O, no DB. Every crawled article is scored 0..100 based on
signals in its title, summary, source, and URL. Callers convert the score to a
publishing status via `status_for_score()`.

Thresholds (matches admin spec, Feb 2026):
    score >= 80  →  publish automatically
    60 <= score <= 79  →  send to Admin Review
    score < 60  →  reject
"""
from __future__ import annotations

import re
from urllib.parse import urlparse


# ── Signal dictionaries ───────────────────────────────────────────────────

# Workday-owned or Workday-controlled properties. Any article whose URL host
# matches (or ends in) one of these gets the max source boost — these are
# Workday's own voice.
WORKDAY_DOMAINS = {
    "workday.com",
    "blog.workday.com",
    "newsroom.workday.com",
    "community.workday.com",
}

# Workday Services Partners (Big 4, Global SIs, Workday Extend partners, etc.)
# Signal is weaker than Workday-owned domains and only fires if the article
# also mentions Workday somewhere — a Deloitte blog about SAP shouldn't score.
WORKDAY_PARTNER_DOMAINS = {
    "deloitte.com", "kainos.com", "accenture.com", "cognizant.com",
    "alight.com", "mercer.com", "pwc.com", "kpmg.com", "ibm.com",
    "collaborativesolutions.com", "invisors.com", "sierra-cedar.com",
    "hcltech.com", "capgemini.com", "dxc.com",
}

# Workday product modules + adjacent products (VNDLY, Peakon, Adaptive Planning
# were acquired and are now part of the suite).
WORKDAY_MODULES = [
    "payroll", "hcm", "recruiting", "extend", "prism", "security",
    "financials", "financial management", "learning", "talent",
    "adaptive planning", "adaptive insights", "vndly", "peakon",
    "compensation", "absence", "time tracking", "benefits", "expenses",
    "planning", "analytics", "reporting", "studio", "orchestrate",
]

# "This is a Workday story" verbs — go-live, customer win, partner
# announcements, product releases. Only counted when Workday context exists.
WORKDAY_CONTEXT_KEYWORDS = [
    "go-live", "go live", "goes live", "went live",
    "implementation", "deployment", "rollout",
    "customer", "partner", "reseller",
    "product update", "release", "launch", "announce",
    "certified", "certification",
]

# Generic HR / tech buzzwords. If Workday context is absent, each occurrence
# pushes the score down — this is where "AI is changing HR" style filler gets
# demoted.
GENERIC_TECH_KEYWORDS = [
    "artificial intelligence", "generative ai", "machine learning",
    "cloud computing", "enterprise resource planning", "digital transformation",
    "remote work", "hybrid work", "future of work",
    "cybersecurity", "data privacy",
    "diversity", "inclusion", "dei",
    "hr technology", "hr tech", "employee experience",
]

# Direct Workday competitors — if the article is *about* one of these products
# (mentioned in title), it's almost certainly not a Workday story.
COMPETITOR_KEYWORDS = [
    "successfactors", "sap hcm", "sap hr",
    "oracle hcm", "oracle cloud hcm", "oracle fusion",
    "ceridian", "dayforce",
    "ukg", "ultimate kronos", "kronos workforce",
    "adp workforce",
    "bamboohr", "namely", "gusto",
]

WORKDAY_RE = re.compile(r"\bworkday\b", re.IGNORECASE)


# ── Helpers ───────────────────────────────────────────────────────────────

def _host(url: str | None) -> str:
    if not url:
        return ""
    try:
        return (urlparse(url).hostname or "").lower().lstrip("www.")
    except Exception:  # noqa: BLE001
        return ""


def _host_in(host: str, domains: set[str]) -> bool:
    """True iff host is one of `domains` or a subdomain thereof."""
    if not host:
        return False
    for d in domains:
        if host == d or host.endswith("." + d):
            return True
    return False


def _count_matches(text: str, needles: list[str]) -> int:
    """Case-insensitive count of how many DISTINCT needles appear in text.
    We count distinct hits (not total occurrences) so an article obsessively
    repeating "AI" doesn't nuke the score."""
    if not text:
        return 0
    lower = text.lower()
    return sum(1 for n in needles if n in lower)


# ── Public API ────────────────────────────────────────────────────────────

def compute_workday_score(
    *,
    title: str = "",
    summary: str = "",
    url: str | None = None,
    source: str | None = None,  # feed name, unused today but kept for future signals
) -> tuple[int, dict]:
    """Return (score, breakdown) for one article.

    `score` is clamped to [0, 100]. `breakdown` is a JSON-serialisable dict
    of signal → integer delta, plus a "reasons" list of human-readable strings
    so admins can see WHY a particular score landed where it did.
    """
    title = title or ""
    summary = summary or ""
    full_text = f"{title}\n{summary}"
    host = _host(url)

    breakdown: dict[str, int] = {}
    reasons: list[str] = []

    # ── Workday name mentions ────────────────────────────────────────────
    title_has_workday = bool(WORKDAY_RE.search(title))
    summary_has_workday = bool(WORKDAY_RE.search(summary))
    workday_hits = len(WORKDAY_RE.findall(full_text))
    has_workday_mention = title_has_workday or summary_has_workday

    if title_has_workday:
        breakdown["title_workday"] = 50
        reasons.append('"Workday" appears in title (+50)')
    if summary_has_workday and workday_hits >= 2:
        breakdown["summary_workday_repeated"] = 15
        reasons.append(f'"Workday" mentioned {workday_hits}× in body (+15)')
    elif summary_has_workday:
        breakdown["summary_workday"] = 10
        reasons.append('"Workday" appears in body (+10)')

    # URL path (not host) containing "workday" is a weak-but-useful signal —
    # e.g. hrexecutive.com/workday-launches-... has the URL slug curated by
    # the publisher, so it's often a Workday-focused article on a generic feed.
    try:
        path = (urlparse(url or "").path or "").lower()
    except Exception:  # noqa: BLE001
        path = ""
    if "workday" in path and not _host_in(host, WORKDAY_DOMAINS):
        breakdown["workday_in_url_path"] = 15
        reasons.append('"workday" in URL slug (+15)')

    # ── Source domain trust ──────────────────────────────────────────────
    if _host_in(host, WORKDAY_DOMAINS):
        breakdown["workday_owned_source"] = 50
        reasons.append(f"Source is Workday-owned domain ({host}) (+50)")
    elif _host_in(host, WORKDAY_PARTNER_DOMAINS) and has_workday_mention:
        breakdown["partner_source"] = 25
        reasons.append(f"Approved Workday partner source ({host}) with Workday context (+25)")

    # ── Workday module mentions ──────────────────────────────────────────
    module_hits = _count_matches(full_text, WORKDAY_MODULES)
    if module_hits > 0 and has_workday_mention:
        module_pts = min(module_hits * 10, 30)
        breakdown["workday_modules"] = module_pts
        reasons.append(f"{module_hits} Workday module keyword(s) with Workday context (+{module_pts})")
    elif module_hits >= 2 and not has_workday_mention:
        # Modules like "payroll" / "recruiting" are ambiguous without Workday
        # context — give a small hint but not more.
        breakdown["workday_modules_ambiguous"] = 5
        reasons.append("HCM module keywords present but no explicit Workday mention (+5)")

    # ── Customer / implementation / launch verbs ─────────────────────────
    context_hits = _count_matches(full_text, WORKDAY_CONTEXT_KEYWORDS)
    if context_hits > 0 and has_workday_mention:
        ctx_pts = min(context_hits * 5, 15)
        breakdown["workday_context"] = ctx_pts
        reasons.append(f"{context_hits} implementation/customer keyword(s) with Workday context (+{ctx_pts})")

    # ── Generic tech noise (penalty) ─────────────────────────────────────
    generic_hits = _count_matches(full_text, GENERIC_TECH_KEYWORDS)
    if generic_hits > 0 and not has_workday_mention:
        pen = -min(generic_hits * 5, 20)
        breakdown["generic_tech_noise"] = pen
        reasons.append(f"{generic_hits} generic HR/tech keyword(s) without Workday focus ({pen})")

    # ── Competitor primary focus (penalty) ───────────────────────────────
    if _count_matches(title, COMPETITOR_KEYWORDS) > 0:
        breakdown["competitor_title"] = -15
        reasons.append("Competitor product named in title (-15)")
    elif _count_matches(full_text, COMPETITOR_KEYWORDS) > 0 and not has_workday_mention:
        breakdown["competitor_focus"] = -10
        reasons.append("Competitor product mentioned without Workday focus (-10)")

    # ── Aggregate + hard caps ────────────────────────────────────────────
    score = sum(breakdown.values())

    # Articles with zero Workday signal anywhere are capped hard — no matter
    # how many partner-domain / module hits sneak in, we won't publish them.
    if not has_workday_mention and not _host_in(host, WORKDAY_DOMAINS):
        score = min(score, 25)
        if "hard_cap_no_workday" not in breakdown:
            breakdown["hard_cap_no_workday"] = 0
            reasons.append("Cap: no explicit Workday mention → max 25")

    score = max(0, min(100, score))
    breakdown["_reasons"] = reasons
    return score, breakdown


def status_for_score(score: int) -> str:
    """Publishing status for a given relevance score."""
    if score >= 80:
        return "published"
    if score >= 60:
        return "pending_review"
    return "rejected"

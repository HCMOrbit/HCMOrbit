"""Industry Pulse — text parsing utilities.

Pure, no I/O. Fingerprinting, module keyword tagging, rate parsing,
Workday-mention filtering, remote/employment-type inference.
"""
from __future__ import annotations

import hashlib
import html as _html
import re
from typing import Iterable, Optional

# ── Module keyword vocabulary ───────────────────────────────────────────────
# Order matters — first match wins for the primary bucket, but we record ALL
# matches (per spec "Store all matches, not just the first").
MODULE_KEYWORDS: dict[str, list[str]] = {
    "Core HCM":      ["core hcm", "supervisory organization", "position management",
                      "job profile", "compensation grade"],
    "Payroll":       ["workday payroll", "gross-to-net", "gross to net",
                      "payroll processing", "us payroll", "uk payroll",
                      "canada payroll", "workday pay"],
    "Absence":       ["absence management", "workday absence", "time off plan",
                      "absence"],
    "Time Tracking": ["time tracking", "workday time", "time entry"],
    "Benefits":      ["workday benefits", "benefits administration",
                      "open enrollment", "benefit plan", "benefits"],
    "Recruiting":    ["workday recruiting", "recruiting", "job requisition",
                      "candidate pool"],
    "Talent":        ["workday talent", "performance review", "goal management",
                      "talent review", "succession planning", "talent"],
    "Security":      ["workday security", "security groups", "domain security",
                      "business process security", "role-based security",
                      "security"],
    "Integrations":  ["workday integration", "workday studio", "studio integration",
                      "eib ", "core connector", "peci", "picof", "ccw",
                      "cloud connect", "workday web services", "wwsapi"],
    "Reporting":     ["workday report", "advanced report", "calculated field",
                      "matrix report", "composite report", "birt",
                      "workday reporting", "prism report", "reporting"],
    "Financials":    ["workday financials", "workday finance", "ledger account",
                      "workday accounting", "financials"],
    "Prism":         ["workday prism", "prism analytics"],
    "Extend":        ["workday extend", "workday app builder"],
    "Adaptive":      ["adaptive planning", "workday adaptive", "adaptive insights"],
}

# Keywords that are ordinary English words. For these, a bare title match is
# NOT enough — the keyword must be adjacent to a capitalized "Workday" in the
# title (e.g. "Workday Security Lead"), or appear in the same sentence as
# a capitalized "Workday" in the description. This blocks postings like
# "Sr Security Engineer" from tagging Security via description boilerplate.
_GENERIC_ENGLISH_KEYWORDS: set[str] = {
    "recruiting", "benefits", "security", "talent",
    "reporting", "financials", "absence", "time tracking",
}

# Chars of context on either side of a generic-keyword title hit to look
# for a capitalized "Workday". ~30 chars ≈ 4-5 words, which covers phrases
# like "Sr Workday Security Lead" or "Payroll Analyst - Workday Cloud" but
# rejects "Head of Global HR, Workday Systems, and Security Compliance".
_GENERIC_TITLE_ADJACENCY_CHARS = 30

# Compile once. Word-boundary aware but lenient on spaces/hyphens.
# `_MODULE_PATTERNS[i] = (module, keyword_source_string, compiled_regex)`.
_MODULE_PATTERNS: list[tuple[str, str, re.Pattern]] = [
    (module, kw, re.compile(r"(?<![a-z0-9])" + re.escape(kw) + r"(?![a-z0-9])", re.IGNORECASE))
    for module, kws in MODULE_KEYWORDS.items()
    for kw in kws
]

# Capitalized "Workday" only — bare-word "workday" in "during the workday"
# is common English and must not trigger the relevance filter.
_WORKDAY_RE = re.compile(r"(?<![A-Za-z0-9])Workday(?![A-Za-z0-9])")

# Sentence splitter — cheap heuristic: split on `.`, `!`, `?` followed by
# whitespace, on line breaks, or on `;`. Job-ad descriptions have terrible
# punctuation, so this is intentionally lenient.
_SENTENCE_SPLIT_RE = re.compile(r"(?:[.!?]+\s+|\n+|;\s+)")

# ── Fingerprint ─────────────────────────────────────────────────────────────
_REQ_NUM_RE = re.compile(r"\b(?:req|jr|r|job|jobid|id)[-_ ]?[a-z]?[-_ ]?\d{4,}\b", re.IGNORECASE)
_PUNCT_RE = re.compile(r"[^a-z0-9\s]")
_WS_RE = re.compile(r"\s+")


def _normalize_for_fingerprint(text: str) -> str:
    if not text:
        return ""
    t = text.lower()
    t = _REQ_NUM_RE.sub(" ", t)     # strip req/jr numbers
    t = _PUNCT_RE.sub(" ", t)        # strip punctuation
    t = _WS_RE.sub(" ", t).strip()   # collapse whitespace
    return t


def fingerprint(employer_name: str, title_raw: str, location_raw: str) -> str:
    parts = [
        _normalize_for_fingerprint(employer_name),
        _normalize_for_fingerprint(title_raw),
        _normalize_for_fingerprint(location_raw),
    ]
    return hashlib.sha256("||".join(parts).encode("utf-8")).hexdigest()


# ── Description hygiene ─────────────────────────────────────────────────────
_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: Optional[str]) -> str:
    if not text:
        return ""
    return _html.unescape(_TAG_RE.sub(" ", text))


# ── Workday-mention filter ──────────────────────────────────────────────────
def is_workday_relevant(*, title: str, description: str) -> bool:
    """Keep a posting iff:
       (a) capitalized 'Workday' appears in the title, OR
       (b) capitalized 'Workday' appears 2+ times in the description AND
           `tag_modules()` returns at least one module.
    Case-insensitive 'workday' (as in "during the workday") is deliberately
    ignored — job-ad boilerplate uses the lowercase form.
    """
    if _WORKDAY_RE.search(title or ""):
        return True
    desc = description or ""
    if len(_WORKDAY_RE.findall(desc)) >= 2 and tag_modules(title=title, description=desc):
        return True
    return False


# ── Module tagging ──────────────────────────────────────────────────────────
def _workday_adjacent_in_title(title: str, kw_start: int, kw_end: int) -> bool:
    """Is a capitalized 'Workday' within ±N chars of the keyword's title span?"""
    a = max(0, kw_start - _GENERIC_TITLE_ADJACENCY_CHARS)
    b = min(len(title), kw_end + _GENERIC_TITLE_ADJACENCY_CHARS)
    return bool(_WORKDAY_RE.search(title[a:b]))


def tag_modules(*, title: str, description: str) -> list[str]:
    """Tag modules under two rules that both require Workday context:

      1. Title-match: any module keyword found in the title tags that
         module — EXCEPT for keywords in `_GENERIC_ENGLISH_KEYWORDS`,
         which additionally require a capitalized "Workday" within
         `_GENERIC_TITLE_ADJACENCY_CHARS` chars of the match. This blocks
         "Sr Security Engineer" from tagging Security while still catching
         "Workday Security Lead".

      2. Description-match: any keyword matched inside a sentence that
         ALSO contains a capitalized "Workday". Bare occurrences of a
         keyword anywhere else in the description do not count. This rule
         applies uniformly to generic and non-generic keywords.

    Sentences are split on `.`/`!`/`?`/`;`/newline.
    """
    hits: set[str] = set()
    t = title or ""
    d = description or ""

    # (1) title
    for module, kw, pat in _MODULE_PATTERNS:
        m = pat.search(t)
        if not m:
            continue
        if kw in _GENERIC_ENGLISH_KEYWORDS:
            if not _workday_adjacent_in_title(t, m.start(), m.end()):
                continue
        hits.add(module)

    # (2) description — same-sentence-as-Workday rule for ALL keywords
    if d:
        for sentence in _SENTENCE_SPLIT_RE.split(d):
            if not _WORKDAY_RE.search(sentence):
                continue
            for module, _kw, pat in _MODULE_PATTERNS:
                if pat.search(sentence):
                    hits.add(module)

    # Deterministic order matching MODULE_KEYWORDS insertion order
    return [m for m in MODULE_KEYWORDS if m in hits]


# ── Rate parsing ────────────────────────────────────────────────────────────
# Match rate ranges. Requires EITHER a `$` prefix on the low number OR an
# explicit unit suffix (hour/annual/year/…) so bare "4-8 years experience"
# doesn't get mis-parsed as a wage. This is deliberately conservative — we'd
# rather miss a rate than surface a wrong one.
_RATE_RE = re.compile(
    r"""(?ix)
    (?:                                                                 # ─ low bound ─
      \$\s?(?P<lo_d>\d{2,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d{1,3}(?:\.\d+)?) # $-prefixed
      |
      (?P<lo>\d{2,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d{2,3}(?:\.\d+)?)        # bare (2+ digits)
    )
    \s*(?P<lo_k>k)?
    \s*(?:-|–|—|to)\s*
    (?:\$\s?)?(?P<hi>\d{2,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d{1,3}(?:\.\d+)?)
    \s*(?P<hi_k>k)?
    \s*(?:per\s+|/)?(?P<unit>hour|hourly|hr|annual|annually|year|yr|annum)?
    """,
)


def parse_rate(text: str) -> tuple[Optional[float], Optional[float], Optional[str]]:
    """Return (rate_min, rate_max, rate_unit) — best-effort, conservative.

    Requires either a `$` prefix on the low number OR an explicit
    hour/annual unit somewhere in the match. Bare number ranges like
    "5 to 8 years experience" are ignored.
    """
    if not text:
        return None, None, None
    for m in _RATE_RE.finditer(text):
        dollar_prefixed = bool(m.group("lo_d"))
        unit_hint = (m.group("unit") or "").lower()
        # Discriminator: require $ OR an explicit unit.
        if not dollar_prefixed and not unit_hint:
            continue
        try:
            lo_raw = m.group("lo_d") or m.group("lo")
            lo = _parse_num(lo_raw) * (1000 if m.group("lo_k") else 1)
            hi = _parse_num(m.group("hi")) * (1000 if m.group("hi_k") else 1)
        except (ValueError, TypeError):
            continue
        if unit_hint.startswith("hour") or unit_hint in ("hr",):
            unit: Optional[str] = "hourly"
        elif unit_hint.startswith(("annual", "year", "yr")) or unit_hint == "annum":
            unit = "annual"
        elif hi >= 20_000:
            unit = "annual"
        elif 15 <= hi <= 500:
            unit = "hourly"
        else:
            continue  # ambiguous & no unit hint — skip rather than guess wrong
        if lo > hi:
            lo, hi = hi, lo
        # Sanity bounds by unit — reject implausible.
        if unit == "hourly" and (hi < 15 or hi > 5000 or lo < 5):
            continue
        if unit == "annual" and (hi < 20_000 or hi > 2_000_000):
            continue
        return lo, hi, unit
    return None, None, None


def _parse_num(s: str) -> float:
    return float(s.replace(",", "").replace(" ", ""))


# ── Remote / employment-type parsing ───────────────────────────────────────
_REMOTE_RE = re.compile(
    r"\b(remote|work[-\s]?from[-\s]?home|wfh|virtual|telecommute|distributed)\b",
    re.IGNORECASE,
)
_CONTRACT_RE = re.compile(
    r"\b(contract(?:or)?|c2c|corp[-\s]?to[-\s]?corp|w[-\s]?2|1099|freelance|"
    r"temp(?:orary)?|contract[-\s]?to[-\s]?hire)\b",
    re.IGNORECASE,
)
_FTE_RE = re.compile(
    r"\b(full[-\s]?time|permanent|fte|regular\s+full\s+time)\b",
    re.IGNORECASE,
)


def parse_is_remote(*, title: str, location: str, description: str = "") -> bool:
    return bool(
        _REMOTE_RE.search(title or "")
        or _REMOTE_RE.search(location or "")
        # For description, only count if it's in the first ~500 chars (avoid
        # boilerplate "we support remote work" mentions later in the ad).
        or _REMOTE_RE.search((description or "")[:500])
    )


def parse_employment_type(*, title: str, description: str) -> str:
    if _CONTRACT_RE.search(title or ""):
        return "contract"
    if _FTE_RE.search(title or ""):
        return "fte"
    # Weight description hits — early appearance means it's likely a header
    early = (description or "")[:800]
    if _CONTRACT_RE.search(early):
        return "contract"
    if _FTE_RE.search(early):
        return "fte"
    return "unknown"

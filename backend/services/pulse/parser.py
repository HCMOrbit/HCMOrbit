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
    "Absence":       ["absence management", "workday absence", "time off plan"],
    "Time Tracking": ["time tracking", "workday time", "time entry"],
    "Benefits":      ["workday benefits", "benefits administration",
                      "open enrollment", "benefit plan"],
    "Recruiting":    ["workday recruiting", "recruiting", "job requisition",
                      "candidate pool"],
    "Talent":        ["workday talent", "performance review", "goal management",
                      "talent review", "succession planning"],
    "Security":      ["workday security", "security groups", "domain security",
                      "business process security", "role-based security"],
    "Integrations":  ["workday integration", "workday studio", "studio integration",
                      "eib ", "core connector", "peci", "picof", "ccw",
                      "cloud connect", "workday web services", "wwsapi"],
    "Reporting":     ["workday report", "advanced report", "calculated field",
                      "matrix report", "composite report", "birt",
                      "workday reporting", "prism report"],
    "Financials":    ["workday financials", "workday finance", "ledger account",
                      "workday accounting"],
    "Prism":         ["workday prism", "prism analytics"],
    "Extend":        ["workday extend", "workday app builder"],
    "Adaptive":      ["adaptive planning", "workday adaptive", "adaptive insights"],
}

# Keywords that are ordinary English words — these count ONLY when they
# appear in the title. In a job-ad description "recruiting" nearly always
# refers to the hiring process, not the Workday Recruiting module, so
# bare-word matches in the description are always false positives.
_GENERIC_ENGLISH_KEYWORDS: set[str] = {"recruiting"}

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
def tag_modules(*, title: str, description: str) -> list[str]:
    """Tag modules per two rules:

      1. Title-match: any module keyword (case-insensitive) found in the
         title tags that module. This includes ordinary English words like
         "recruiting" — a title of "Recruiting Coordinator" is real signal.

      2. Description-match: a module keyword tags the module ONLY when it
         appears in the same sentence as a capitalized "Workday". Bare
         occurrences anywhere else in the description are ignored (they're
         almost always boilerplate).

    Additionally, keywords in `_GENERIC_ENGLISH_KEYWORDS` are TITLE-ONLY —
    they never count from the description, not even under the same-sentence
    rule, because they're common English words that co-occur with any
    Workday-mentioning ad.
    """
    hits: set[str] = set()
    t = title or ""
    d = description or ""

    # (1) title matches — all keywords eligible
    for module, _kw, pat in _MODULE_PATTERNS:
        if pat.search(t):
            hits.add(module)

    # (2) description matches — sentence-scoped, only when a capitalized
    # "Workday" sits in the same sentence. Generic English words excluded.
    if d:
        for sentence in _SENTENCE_SPLIT_RE.split(d):
            if not _WORKDAY_RE.search(sentence):
                continue
            for module, kw, pat in _MODULE_PATTERNS:
                if kw in _GENERIC_ENGLISH_KEYWORDS:
                    continue
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

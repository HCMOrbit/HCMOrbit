"""Shared recurrence inference for the Ecosystem scrapers.

Strict by design: we only flag an event as recurring when there is a clear
signal (Schema.org `eventSchedule` with `repeatFrequency`, or a strong text
pattern like "Multiple dates" / "every <weekday>"). When the signal is
ambiguous, both flags stay false and the event is stored as a one-off with
its first occurrence — i.e. preserves current behavior.
"""
from __future__ import annotations

import re
from typing import Any, Optional

# ISO-8601 duration → our internal rule name. Conservative — only weekly /
# monthly are inferred from `repeatFrequency`.
_REPEAT_TO_RULE = {
    "P1W": "weekly",
    "P7D": "weekly",
    "P1M": "monthly",
}

# "Multiple dates", "every tuesday", "weekly", "monthly meetup" etc.
_WEEKLY_RE  = re.compile(r"\b(weekly|every (mon|tues|wednes|thurs|fri|satur|sun)day)\b", re.I)
_MONTHLY_RE = re.compile(r"\b(monthly|every month|first \w+day of (the )?month|second \w+day of (the )?month|third \w+day of (the )?month|fourth \w+day of (the )?month)\b", re.I)
_MULTI_RE   = re.compile(r"\bmultiple dates\b", re.I)


def detect_recurrence(
    parsed: dict[str, Any] | None = None,
    text: Optional[str] = None,
) -> dict[str, Any]:
    """Return `{"is_recurring": bool, "recurrence_rule": Optional[str]}`.

    Both keys are always returned together so the caller can spread them into
    the event doc without conditional checks — and so they always agree with
    `_validate_event_temporal` (recurring => rule set, non-recurring => no rule).
    """
    parsed = parsed or {}

    # 1. Strong structured signal — Schema.org eventSchedule
    schedule = parsed.get("eventSchedule")
    if isinstance(schedule, list) and schedule:
        schedule = schedule[0]
    if isinstance(schedule, dict):
        freq = (schedule.get("repeatFrequency") or "").upper().strip()
        rule = _REPEAT_TO_RULE.get(freq)
        if rule:
            # `byDay` of the form ["1WE"] (1st Wednesday) is a clearer
            # nth-weekday signal than plain "monthly".
            by_day = schedule.get("byDay")
            if rule == "monthly" and isinstance(by_day, (list, str)):
                token = by_day[0] if isinstance(by_day, list) else by_day
                if isinstance(token, str) and re.match(r"^-?\d+[A-Z]{2}$", token.strip()):
                    rule = "monthly_nth_weekday"
            return {"is_recurring": True, "recurrence_rule": rule}

    # 2. Schema.org EventSeries — recurring but rule unknown → leave flags off
    #    (we only set the flag when we can also store a usable rule, since
    #    the backend validator requires both together).
    at_type = parsed.get("@type")
    if isinstance(at_type, str) and "Series" in at_type:
        # No rule we can pin down → fall through to text inference, then off.
        pass

    # 3. Text patterns in title / description / explicit `text` arg
    haystack_parts = [
        text or "",
        str(parsed.get("name") or parsed.get("title") or ""),
        str(parsed.get("description") or ""),
    ]
    haystack = " ".join(p for p in haystack_parts if p)
    if haystack:
        if _MONTHLY_RE.search(haystack):
            return {"is_recurring": True, "recurrence_rule": "monthly"}
        if _WEEKLY_RE.search(haystack):
            return {"is_recurring": True, "recurrence_rule": "weekly"}
        # "Multiple dates" alone — recurring but no rule → safer to leave off
        # so we don't fabricate a cadence.
        if _MULTI_RE.search(haystack):
            return {"is_recurring": False, "recurrence_rule": None}

    return {"is_recurring": False, "recurrence_rule": None}

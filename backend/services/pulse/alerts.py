"""Industry Pulse — failure alerting + weekly heartbeat.

Two email paths, both plain-text via the existing Resend setup:
  • send_anomaly_email — fires at most once per run, on any of 4 triggers
  • send_weekly_email  — Monday heartbeat, sent regardless of health

Guard rails per spec:
  • Never more than one anomaly email per run (enforced by the caller).
  • No suppression on repeat: if a break persists for 3+ runs, keep firing.
    (A persistent break is exactly what must never be silenced.)
  • Email failure must NEVER break the crawl — every call is wrapped in
    try/except at the call site in crawler.py.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from welcome_emails import _send_via_resend

log = logging.getLogger(__name__)

# Hardcoded thresholds per spec ("do not build a settings UI").
FAILED_EMPLOYERS_THRESHOLD_RATIO = 0.20
KNOWN_SOURCES = ("workday", "greenhouse", "lever")


def _alert_recipient() -> Optional[str]:
    """Admin address for pulse alerts. Falls back to the founder inbox already
    used by welcome emails; overridable via PULSE_ALERT_EMAIL for prod tuning."""
    return (os.environ.get("PULSE_ALERT_EMAIL")
            or os.environ.get("SENDER_EMAIL")
            or "suchi@hcmorbit.com")


# ── Anomaly evaluation ─────────────────────────────────────────────────────
async def evaluate_anomalies(db_: AsyncIOMotorDatabase, summary: dict) -> list[str]:
    """Return list of human-readable anomaly reasons. Empty ⇒ healthy run."""
    reasons: list[str] = []

    attempted = int(summary.get("employers_attempted") or 0)
    failed = int(summary.get("employers_failed") or 0)
    new = int(summary.get("postings_new") or 0)
    resighted = int(summary.get("postings_resighted") or 0)

    # (1) ≥20% employers failed
    if attempted > 0 and (failed / attempted) >= FAILED_EMPLOYERS_THRESHOLD_RATIO:
        pct = round(100 * failed / attempted, 1)
        reasons.append(
            f"{failed}/{attempted} employers failed ({pct}%) — threshold is "
            f"{int(FAILED_EMPLOYERS_THRESHOLD_RATIO * 100)}%."
        )

    # (2) run produced nothing at all
    if new == 0 and resighted == 0:
        reasons.append("Run produced 0 new AND 0 re-sighted postings — likely a broken adapter or network outage.")

    # (3) any source dropped to 0 postings this run but had 1+ on the previous
    # successful run (defined as any prior run with total > 0 in by_source_*)
    this_by_source = _totals_by_source(summary)
    prev = await _prev_successful_run(db_, summary.get("started_at"))
    if prev:
        prev_by_source = _totals_by_source(prev)
        for src in KNOWN_SOURCES:
            if this_by_source.get(src, 0) == 0 and prev_by_source.get(src, 0) > 0:
                reasons.append(
                    f"Source '{src}' returned 0 postings this run but "
                    f"{prev_by_source[src]} on the previous run ({prev.get('started_at')})."
                )
    return reasons


def _totals_by_source(run: dict) -> dict[str, int]:
    """Sum new + resighted per source for a run summary row."""
    new_by = run.get("by_source_new") or {}
    seen_by = run.get("by_source_resighted") or {}
    return {src: int(new_by.get(src, 0)) + int(seen_by.get(src, 0)) for src in KNOWN_SOURCES}


async def _prev_successful_run(db_: AsyncIOMotorDatabase, current_started: Optional[str]) -> Optional[dict]:
    """Most-recent prior run with any postings (new OR resighted > 0)."""
    q = {"$expr": {"$gt": [
        {"$add": [{"$ifNull": ["$postings_new", 0]}, {"$ifNull": ["$postings_resighted", 0]}]}, 0
    ]}}
    if current_started:
        q["started_at"] = {"$lt": current_started}
    return await db_.pulse_runs.find_one(q, sort=[("started_at", -1)])


# ── Email senders ──────────────────────────────────────────────────────────
async def send_anomaly_email(summary: dict, reasons: list[str]) -> bool:
    """Plain-text anomaly email. Body = reasons + full run JSON."""
    to = _alert_recipient()
    if not to or not reasons:
        return False
    date_str = _date_str(summary.get("started_at"))
    subject = f"Pulse crawl anomaly — {date_str}"
    body = _plain_anomaly_body(summary, reasons)
    return await _send_plain(to, subject, body)


async def send_weekly_email(db_: AsyncIOMotorDatabase, summary: dict) -> bool:
    """Monday heartbeat. Sent regardless of health.

    Body includes: postings added over last 7 days, total active, breakdown
    by employer_type / by module, and employers that failed EVERY run in the
    last 7 days.
    """
    to = _alert_recipient()
    if not to:
        return False
    date_str = _date_str(summary.get("started_at"))
    subject = f"Pulse weekly — {date_str}"

    now = datetime.now(timezone.utc)
    week_ago_iso = (now - timedelta(days=7)).isoformat()

    total_active = await db_.pulse_postings.count_documents({"is_active": True})
    added_7d = await db_.pulse_postings.count_documents({"first_seen_at": {"$gte": week_ago_iso}})

    by_type = await _agg_group(db_, "employer_type")
    by_module = await _agg_group_unwind(db_, "modules")

    # Employers that failed every run in the last 7 days.
    last_week_runs = await db_.pulse_runs.find(
        {"started_at": {"$gte": week_ago_iso}}, {"errors": 1, "started_at": 1}
    ).sort("started_at", -1).to_list(50)
    persistent_failures = _employers_failing_every_run(last_week_runs)

    body = (
        f"HCMOrbit Industry Pulse — weekly heartbeat\n"
        f"Run started at: {summary.get('started_at')}\n"
        f"----------------------------------------\n\n"
        f"Postings added in the last 7 days: {added_7d}\n"
        f"Total active postings:             {total_active}\n\n"
        f"By employer_type:\n{_fmt_kv(by_type)}\n\n"
        f"By module:\n{_fmt_kv(by_module)}\n\n"
        f"Employers that failed EVERY run in the last 7 days "
        f"({len(persistent_failures)}):\n"
        f"{_fmt_list(persistent_failures) if persistent_failures else '  (none — all employers succeeded at least once)'}\n\n"
        f"Current run summary:\n"
        f"{json.dumps({k: v for k, v in summary.items() if k != 'errors'}, indent=2, default=str)}\n"
    )
    return await _send_plain(to, subject, body)


# ── Helpers ────────────────────────────────────────────────────────────────
def _plain_anomaly_body(summary: dict, reasons: list[str]) -> str:
    return (
        f"HCMOrbit Industry Pulse — anomaly detected\n"
        f"Run started at: {summary.get('started_at')}\n"
        f"Run finished at: {summary.get('finished_at')}\n"
        f"----------------------------------------\n\n"
        f"Reasons ({len(reasons)}):\n"
        f"{_fmt_list(reasons)}\n\n"
        f"Full run summary JSON:\n"
        f"{json.dumps(summary, indent=2, default=str)}\n"
    )


def _fmt_kv(rows: list[dict]) -> str:
    if not rows:
        return "  (no data)"
    return "\n".join(f"  {r['key']:<20} {r['count']}" for r in rows)


def _fmt_list(items: list[str]) -> str:
    return "\n".join(f"  - {x}" for x in items) if items else "  (none)"


def _date_str(iso_or_none: Optional[str]) -> str:
    try:
        if iso_or_none:
            return datetime.fromisoformat(iso_or_none).date().isoformat()
    except (ValueError, TypeError):
        pass
    return datetime.now(timezone.utc).date().isoformat()


async def _agg_group(db_: AsyncIOMotorDatabase, field: str) -> list[dict]:
    rows = []
    pipeline = [
        {"$match": {"is_active": True}},
        {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    async for r in db_.pulse_postings.aggregate(pipeline):
        rows.append({"key": r.get("_id") or "(none)", "count": r["count"]})
    return rows


async def _agg_group_unwind(db_: AsyncIOMotorDatabase, field: str) -> list[dict]:
    rows = []
    pipeline = [
        {"$match": {"is_active": True}},
        {"$unwind": f"${field}"},
        {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    async for r in db_.pulse_postings.aggregate(pipeline):
        rows.append({"key": r["_id"], "count": r["count"]})
    return rows


def _employers_failing_every_run(runs: list[dict]) -> list[str]:
    if not runs:
        return []
    per_run_failed: list[set] = []
    for r in runs:
        failed_names = {e.get("employer") for e in (r.get("errors") or []) if e.get("employer")}
        per_run_failed.append(failed_names)
    if not per_run_failed:
        return []
    persistent = set.intersection(*per_run_failed) if per_run_failed else set()
    return sorted(x for x in persistent if x)


async def _send_plain(to_email: str, subject: str, text_body: str) -> bool:
    """Send plain-text email via the existing Resend helper.

    Resend's API accepts an `html` field; we submit our plain text wrapped in
    a minimal <pre> block so line breaks and JSON indentation survive intact.
    """
    html = f"<pre style=\"font-family: ui-monospace, Menlo, Consolas, monospace; white-space: pre-wrap;\">{_html_escape(text_body)}</pre>"
    try:
        return await _send_via_resend(to_email, subject, html)
    except Exception as e:  # noqa: BLE001 — email failure must not propagate
        log.warning("pulse: alert email send failed: %s", e)
        return False


def _html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
    )

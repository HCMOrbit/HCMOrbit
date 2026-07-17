"""Industry Pulse — nightly crawler orchestrator.

Public entry: `run_crawl()`. Called by APScheduler in server.py.

Contract (per spec):
- Iterate the seed list (backend/data/pulse_employers.json).
- Per-employer try/except — one bad employer must not kill the run.
- Apply the Workday-mention filter (see parser.is_workday_relevant).
- Fingerprint each posting; upsert:
    * new  → insert with first_seen_at = last_seen_at = now, is_active=true
    * seen → update last_seen_at only (never overwrite first_seen_at)
- After the run, mark postings not seen in the last 3 SUCCESSFUL runs
  for their employer as is_active=false.
- Write a run summary row to pulse_runs.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from core import db
from services.pulse import parser as p
from services.pulse.sources import SOURCE_ADAPTERS, SourceListError, build_client

log = logging.getLogger(__name__)

SEED_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "pulse_employers.json"
INACTIVE_MISS_WINDOW = 3  # postings unseen for N successful employer-runs → inactive
ZERO_YIELD_STREAK_THRESHOLD = 3  # HTTP 200 + 0 raw postings for N runs → suspicious


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _load_seed() -> list[dict]:
    if not SEED_PATH.exists():
        log.error("pulse: seed file missing at %s", SEED_PATH)
        return []
    with open(SEED_PATH, "r", encoding="utf-8") as f:
        seed = json.load(f)
    ok: list[dict] = []
    for e in seed:
        if not all(k in e for k in ("name", "source", "identifier", "industry", "employer_type")):
            log.warning("pulse: malformed seed row (skipped): %r", e)
            continue
        if e["source"] not in SOURCE_ADAPTERS:
            log.warning("pulse: unknown source %r for %s (skipped)", e["source"], e["name"])
            continue
        ok.append(e)
    return ok


async def _upsert_posting(db_: AsyncIOMotorDatabase, posting: dict) -> str:
    """Return 'new' or 'resighted'.

    `$setOnInsert` MUST NOT reference any field that also appears in `$set` —
    MongoDB rejects that as a path conflict. So we keep insert-only fields
    (first_seen_at, miss_streak init) tight, and put everything else — including
    the identity fields like fingerprint / employer_name — in `$set`. Those
    fields are effectively immutable in practice, so re-setting them is a no-op.
    """
    fp = posting["fingerprint"]
    now = _now_iso()
    result = await db_.pulse_postings.update_one(
        {"fingerprint": fp},
        {
            "$setOnInsert": {"first_seen_at": now},
            "$set": {
                **posting,           # fingerprint / source / employer_* / industry / all volatile fields
                "last_seen_at": now,
                "is_active": True,
                # Re-sight resets any accumulating miss streak.
                "miss_streak": 0,
            },
        },
        upsert=True,
    )
    return "new" if result.upserted_id is not None else "resighted"


async def _crawl_employer(client: httpx.AsyncClient, employer: dict) -> dict:
    """Return {'new': N, 'resighted': N, 'raw_yield': N, 'seen_fps': [...]}.

    `raw_yield` counts every posting the adapter yielded before the
    Workday-relevance filter — used by the zero-yield streak detector.
    """
    adapter = SOURCE_ADAPTERS[employer["source"]]
    stats = {"new": 0, "resighted": 0, "raw_yield": 0, "seen_fps": []}
    async for raw in adapter(client, employer):
        stats["raw_yield"] += 1
        title = raw["title_raw"]
        desc = raw["description_raw"]
        if not p.is_workday_relevant(title=title, description=desc):
            continue
        fp = p.fingerprint(employer["name"], title, raw["location_raw"])
        rate_min, rate_max, rate_unit = p.parse_rate(desc)
        posting = {
            "fingerprint": fp,
            "source": raw["source"],
            "employer_name": employer["name"],
            "employer_slug": raw["employer_slug"],
            "employer_type": employer["employer_type"],
            "industry": employer["industry"],
            "title_raw": title,
            "location_raw": raw["location_raw"],
            "is_remote": p.parse_is_remote(title=title, location=raw["location_raw"], description=desc),
            "employment_type": p.parse_employment_type(title=title, description=desc),
            "rate_min": rate_min,
            "rate_max": rate_max,
            "rate_unit": rate_unit,
            "modules": p.tag_modules(title=title, description=desc),
            "description_raw": desc,
            "posted_at": _coerce_posted_at(raw["posted_at_raw"], raw["source"]),
            "external_url": raw["external_url"],
            "raw_payload": raw["raw_payload"],
        }
        state = await _upsert_posting(db, posting)
        stats[state] += 1
        stats["seen_fps"].append(fp)
    return stats


def _coerce_posted_at(raw: Any, source: str) -> str | None:
    if raw is None:
        return None
    if source == "lever" and isinstance(raw, (int, float)):
        try:
            return datetime.fromtimestamp(raw / 1000, tz=timezone.utc).isoformat()
        except (ValueError, OSError):
            return None
    if isinstance(raw, str):
        # Keep raw strings ("Posted Today", ISO date, etc.) as-is.
        return raw
    return None


async def _mark_inactive_misses(db_: AsyncIOMotorDatabase, employer_name: str, seen_fps: list[str]) -> int:
    """Bump miss_streak for postings from this employer that we didn't re-see
    this run; flip is_active=false once miss_streak >= INACTIVE_MISS_WINDOW.

    Returns number of postings newly flipped to inactive.
    """
    seen_set = set(seen_fps)
    cursor = db_.pulse_postings.find(
        {"employer_name": employer_name, "is_active": True},
        {"fingerprint": 1, "miss_streak": 1},
    )
    flipped = 0
    async for doc in cursor:
        if doc["fingerprint"] in seen_set:
            continue
        new_streak = int(doc.get("miss_streak") or 0) + 1
        update = {"miss_streak": new_streak}
        if new_streak >= INACTIVE_MISS_WINDOW:
            update["is_active"] = False
            flipped += 1
        await db_.pulse_postings.update_one({"_id": doc["_id"]}, {"$set": update})
    return flipped


def _employer_state_key(employer: dict) -> dict:
    return {
        "employer_name": employer["name"],
        "source": employer["source"],
        "identifier": employer["identifier"],
    }


async def _record_zero_yield(db_: AsyncIOMotorDatabase, employer: dict, raw_yield: int) -> int:
    """Track consecutive HTTP-200-but-empty runs per employer.

    Returns the current streak AFTER this run's update. Called only for
    employers that did NOT raise SourceListError.
    """
    key = _employer_state_key(employer)
    if raw_yield > 0:
        await db_.pulse_employer_state.update_one(
            key,
            {"$set": {**key, "zero_yield_streak": 0, "last_updated": _now_iso()}},
            upsert=True,
        )
        return 0
    result = await db_.pulse_employer_state.find_one_and_update(
        key,
        {
            "$setOnInsert": {**key},
            "$inc": {"zero_yield_streak": 1},
            "$set": {"last_updated": _now_iso()},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    ) or {}
    return int(result.get("zero_yield_streak") or 0)


async def run_crawl() -> dict:
    """Full nightly run. Returns the summary dict (also persisted to `pulse_runs`)."""
    started = _now_iso()
    seed = _load_seed()
    summary: dict = {
        "started_at": started,
        "finished_at": None,
        "employers_attempted": 0,
        "employers_ok": 0,
        "employers_failed": 0,
        "postings_new": 0,
        "postings_resighted": 0,
        "postings_marked_inactive": 0,
        # Per-source rollups — needed by the alert evaluator to detect a
        # source that silently returns zero postings.
        "by_source_new": {"workday": 0, "greenhouse": 0, "lever": 0},
        "by_source_resighted": {"workday": 0, "greenhouse": 0, "lever": 0},
        "alert_sent": False,
        "alert_reasons": [],
        "weekly_sent": False,
        "errors": [],
        # Employers that returned HTTP 200 but yielded 0 raw postings for
        # ZERO_YIELD_STREAK_THRESHOLD consecutive runs — usually wrong slug.
        "suspicious_employers": [],
    }
    log.info("pulse: run starting — %d employers seeded", len(seed))
    try:
        async with build_client() as client:
            for employer in seed:
                summary["employers_attempted"] += 1
                src = employer["source"]
                try:
                    stats = await _crawl_employer(client, employer)
                    inactive_flipped = await _mark_inactive_misses(db, employer["name"], stats["seen_fps"])
                    streak = await _record_zero_yield(db, employer, stats["raw_yield"])
                    summary["employers_ok"] += 1
                    summary["postings_new"] += stats["new"]
                    summary["postings_resighted"] += stats["resighted"]
                    summary["by_source_new"][src] = summary["by_source_new"].get(src, 0) + stats["new"]
                    summary["by_source_resighted"][src] = summary["by_source_resighted"].get(src, 0) + stats["resighted"]
                    summary["postings_marked_inactive"] += inactive_flipped
                    if streak >= ZERO_YIELD_STREAK_THRESHOLD:
                        summary["suspicious_employers"].append({
                            "employer": employer["name"],
                            "source": src,
                            "identifier": employer["identifier"],
                            "zero_yield_streak": streak,
                            "message": (
                                f"HTTP 200 but 0 postings yielded for {streak} consecutive runs "
                                f"— likely wrong site slug."
                            ),
                        })
                    log.info("pulse: %s — new=%d resighted=%d raw=%d inactive+=%d streak=%d",
                             employer["name"], stats["new"], stats["resighted"],
                             stats["raw_yield"], inactive_flipped, streak)
                except SourceListError as sle:
                    summary["employers_failed"] += 1
                    summary["errors"].append({
                        "employer": employer["name"],
                        "source": sle.source,
                        "identifier": employer["identifier"],
                        "http_status": sle.http_status,
                        "url": sle.url,
                        "message": sle.message[:400],
                    })
                    log.warning(
                        "pulse: employer failed (list endpoint) %s src=%s http=%s: %s",
                        employer["name"], sle.source, sle.http_status, sle.message,
                    )
                except Exception as e:  # noqa: BLE001 — one bad employer must not kill the run
                    summary["employers_failed"] += 1
                    summary["errors"].append({
                        "employer": employer["name"],
                        "source": employer["source"],
                        "identifier": employer["identifier"],
                        "http_status": None,
                        "url": None,
                        "message": f"{type(e).__name__}: {e}"[:400],
                    })
                    log.exception("pulse: employer failed %s", employer["name"])
    except Exception as fatal:  # noqa: BLE001 — anomaly trigger (4): unhandled exception
        summary["finished_at"] = _now_iso()
        summary["errors"].append({
            "employer": "__run__",
            "source": "__run__",
            "identifier": "__run__",
            "http_status": None,
            "url": None,
            "message": f"UNHANDLED {type(fatal).__name__}: {fatal}"[:600],
        })
        summary["alert_sent"] = True
        summary["alert_reasons"] = [f"Unhandled exception in run_crawl: {type(fatal).__name__}: {fatal}"[:400]]
        # Fire the alert email BEFORE re-raising (per spec).
        try:
            from services.pulse.alerts import send_anomaly_email
            await send_anomaly_email(summary, summary["alert_reasons"])
        except Exception:
            log.exception("pulse: failed to send fatal-exception alert")
        try:
            await db.pulse_runs.insert_one({**summary, "_created_at": summary["started_at"]})
        except Exception:
            log.exception("pulse: failed to persist crashed run summary")
        raise

    summary["finished_at"] = _now_iso()

    # ─── Anomaly evaluation + email (guarded) ────────────────────────────
    try:
        from services.pulse.alerts import evaluate_anomalies, send_anomaly_email
        reasons = await evaluate_anomalies(db, summary)
        if reasons:
            summary["alert_reasons"] = reasons
            sent = await send_anomaly_email(summary, reasons)
            summary["alert_sent"] = bool(sent)
            log.warning("pulse: %d anomaly reason(s) — email_sent=%s", len(reasons), summary["alert_sent"])
    except Exception:
        log.exception("pulse: anomaly evaluation/send failed (crawl continues)")

    # ─── Weekly heartbeat on Mondays (regardless of health) ──────────────
    try:
        if datetime.now(timezone.utc).weekday() == 0:  # Mon = 0
            from services.pulse.alerts import send_weekly_email
            sent = await send_weekly_email(db, summary)
            summary["weekly_sent"] = bool(sent)
            log.info("pulse: weekly heartbeat email_sent=%s", summary["weekly_sent"])
    except Exception:
        log.exception("pulse: weekly-email send failed (crawl continues)")

    try:
        await db.pulse_runs.insert_one({**summary, "_created_at": summary["started_at"]})
    except Exception:
        log.exception("pulse: failed to persist run summary")
    log.info("pulse: run finished — %s", {k: v for k, v in summary.items() if k not in ("errors", "by_source_new", "by_source_resighted")})
    return summary


# ── One-off runner for manual testing / cron override ─────────────────────
if __name__ == "__main__":  # pragma: no cover
    import asyncio
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
    asyncio.run(run_crawl())

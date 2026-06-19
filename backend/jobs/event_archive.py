"""Daily auto-archive job for ecosystem events.

Finds events that are still marked `is_published=True` but whose `date` is more
than 90 days in the past, and flips them to `is_published=False`. The events
remain in the collection (admin can still see + re-publish them via the
`/admin/ecosystem-events` page) — they just stop appearing on the public
`/ecosystem` page.

Audit trail: each archive run writes an `ecosystem_event_auto_archive` entry
into `admin_logs` via `log_admin_action`, attributed to a synthetic
`system:scheduler` admin identity so it's distinguishable from human edits.
"""
import logging
from datetime import datetime, timedelta, timezone

from core import db
from dependencies import log_admin_action

log = logging.getLogger("event_archive")

ARCHIVE_AFTER_DAYS = 90
SYSTEM_ACTOR = {"user_id": "system:scheduler", "username": "system:scheduler"}


async def archive_stale_events() -> dict:
    """Archive ecosystem events older than ARCHIVE_AFTER_DAYS.

    Returns a stats dict with the cutoff date and the count archived.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ARCHIVE_AFTER_DAYS)).date().isoformat()
    selector = {"is_published": True, "date": {"$lt": cutoff}}
    archived = await db.ecosystem_events.count_documents(selector)
    if archived:
        await db.ecosystem_events.update_many(
            selector,
            {"$set": {"is_published": False, "auto_archived_at": datetime.now(timezone.utc).isoformat()}},
        )
    await log_admin_action(
        SYSTEM_ACTOR,
        "ecosystem_event_auto_archive",
        note=f"cutoff={cutoff} archived={archived}",
    )
    log.info(f"Event auto-archive complete — cutoff={cutoff} archived={archived}")
    return {"cutoff": cutoff, "archived": archived}

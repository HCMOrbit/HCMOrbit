"""RSS fetch jobs for the Ecosystem feed.

Currently fetches Workday's official blog feed; can be extended to more sources later
by adding entries to `FEEDS`. All entries are stored in MongoDB collection
`ecosystem_news`, keyed by `url` (unique). On every fetch we upsert new entries
and prune the collection to the 50 most-recent items so the feed never grows
unbounded.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone
from html import unescape

import feedparser

from core import db

log = logging.getLogger("rss_fetch")

# Source feeds — add more here as needed.
# Note: Workday's official blog does not currently expose an RSS feed at the
# canonical path. We keep the slot for when they do, and use Google News as
# a reliable always-on source in the meantime.
FEEDS = [
    {"name": "Workday Blog",
     "url": "https://blog.workday.com/en-us/feed.xml"},
    {"name": "Workday News",
     "url": "https://news.google.com/rss/search?q=Workday+HCM&hl=en-US&gl=US&ceid=US:en"},
]

KEEP_RECENT = 50
SUMMARY_MAX_CHARS = 120


def _to_iso(struct_time) -> str | None:
    """Convert feedparser's published_parsed time-struct to ISO timestamp string."""
    if not struct_time:
        return None
    try:
        # struct_time from feedparser is naïve UTC; convert via calendar/timegm
        epoch = time.mktime(struct_time)
        return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
    except Exception:
        return None


def _truncate(text: str | None, max_chars: int = SUMMARY_MAX_CHARS) -> str:
    if not text:
        return ""
    cleaned = unescape(text).strip()
    # Strip simple HTML tags without pulling in a dependency
    import re
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[: max_chars - 1].rstrip() + "…"


def _extract_image_url(entry) -> str | None:
    """Pull the best available image URL from a feedparser entry.

    Checks (in priority order): media:content, media:thumbnail, enclosures,
    links[rel=enclosure], then an <img> tag inside the summary HTML.
    """
    # 1. <media:content url="..." medium="image">
    for mc in entry.get("media_content") or []:
        url = mc.get("url")
        if url and (mc.get("medium", "image") == "image" or url.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))):
            return url
    # 2. <media:thumbnail url="...">
    for mt in entry.get("media_thumbnail") or []:
        url = mt.get("url")
        if url:
            return url
    # 3. <enclosure type="image/*" url="...">
    for enc in entry.get("enclosures") or []:
        url = enc.get("href") or enc.get("url")
        mime = (enc.get("type") or "").lower()
        if url and mime.startswith("image/"):
            return url
    # 4. Inline <img src="..."> inside the summary/description HTML
    summary_html = entry.get("summary") or entry.get("description") or ""
    if summary_html:
        import re
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary_html, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _parse_feed_sync(url: str):
    """Run feedparser.parse in a thread because it's blocking I/O."""
    return feedparser.parse(url, request_headers={"User-Agent": "HCMOrbit-RSS/1.0"})


async def fetch_workday_news() -> dict:
    """Fetch all configured RSS feeds, upsert into ecosystem_news, prune to top N.

    Returns a stats dict for logging / monitoring.
    """
    total_new = 0
    total_seen = 0
    total_skipped_stale = 0
    failures: list[str] = []

    # If we already have KEEP_RECENT items, only consider entries at least as new
    # as the current 50th-newest in DB. This prevents the natural churn of
    # re-fetching+re-pruning the same older items every cycle.
    threshold: str | None = None
    if await db.ecosystem_news.count_documents({}) >= KEEP_RECENT:
        boundary = await (
            db.ecosystem_news
            .find({}, {"_id": 0, "published_at": 1})
            .sort("published_at", -1)
            .skip(KEEP_RECENT - 1)
            .limit(1)
            .to_list(1)
        )
        if boundary:
            threshold = boundary[0]["published_at"]

    for feed_cfg in FEEDS:
        try:
            parsed = await asyncio.to_thread(_parse_feed_sync, feed_cfg["url"])
            if parsed.bozo and not parsed.entries:
                failures.append(feed_cfg["name"])
                log.warning(f"RSS feed unreadable: {feed_cfg['name']} ({parsed.bozo_exception})")
                continue
            for entry in parsed.entries:
                url = (entry.get("link") or "").strip()
                title = (entry.get("title") or "").strip()
                if not url or not title:
                    continue
                published_at = (
                    _to_iso(entry.get("published_parsed"))
                    or _to_iso(entry.get("updated_parsed"))
                    or datetime.now(timezone.utc).isoformat()
                )
                # Skip older items once we've filled our window
                if threshold is not None and published_at < threshold:
                    total_skipped_stale += 1
                    continue
                summary = _truncate(entry.get("summary") or entry.get("description"))
                image_url = _extract_image_url(entry)
                doc = {
                    "title": title,
                    "url": url,
                    "published_at": published_at,
                    "summary": summary,
                    "source": feed_cfg["name"],
                    "image_url": image_url,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
                result = await db.ecosystem_news.update_one(
                    {"url": url},
                    {
                        "$setOnInsert": {"first_seen_at": doc["fetched_at"]},
                        "$set": {k: v for k, v in doc.items() if k != "fetched_at"},
                        "$currentDate": {"updated_at": True},
                    },
                    upsert=True,
                )
                total_seen += 1
                if result.upserted_id is not None:
                    total_new += 1
        except Exception as e:  # noqa: BLE001
            failures.append(feed_cfg["name"])
            log.warning(f"RSS fetch failed for {feed_cfg['name']}: {e}")

    # Prune: keep only KEEP_RECENT most-recent items
    pruned = 0
    cursor = db.ecosystem_news.find({}, {"_id": 1, "published_at": 1}).sort("published_at", -1).skip(KEEP_RECENT)
    stale_ids = [d["_id"] async for d in cursor]
    if stale_ids:
        result = await db.ecosystem_news.delete_many({"_id": {"$in": stale_ids}})
        pruned = result.deleted_count

    log.info(
        f"RSS fetch complete — seen={total_seen} new={total_new} pruned={pruned} "
        f"skipped_stale={total_skipped_stale} failures={failures or 'none'}"
    )
    return {"seen": total_seen, "new": total_new, "pruned": pruned,
            "skipped_stale": total_skipped_stale, "failures": failures}

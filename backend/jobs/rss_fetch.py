"""RSS fetch jobs for the Ecosystem feed.

Currently fetches Workday's official blog feed; can be extended to more sources later
by adding entries to `FEEDS`. All entries are stored in MongoDB collection
`ecosystem_news`, keyed by `url` (unique). On every fetch we upsert new entries
and prune the collection to the 50 most-recent items so the feed never grows
unbounded.
"""
import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from html import unescape

import feedparser
import httpx

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
    {"name": "UC Today",
     "url": "https://uctoday.com/feed/"},
    {"name": "HR Executive",
     "url": "https://hrexecutive.com/feed/"},
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
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary_html, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


# Regex pair handles either ordering of og:image's `property` and `content` attrs.
_OG_RE_A = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_OG_RE_B = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
    re.IGNORECASE,
)


async def _scrape_og_image(url: str, timeout_s: float = 3.0) -> str | None:
    """Best-effort GET of `url`, parse `<meta property="og:image">`.

    Returns the image URL on success, None on any failure (timeout, non-2xx,
    no og:image tag, network error). Caller must treat None as "we tried,
    article has no usable og:image" and never retry.
    """
    try:
        async with httpx.AsyncClient(
            timeout=timeout_s,
            follow_redirects=True,
            headers={"User-Agent": "HCMOrbit-RSS/1.0"},
        ) as client:
            r = await client.get(url)
        if r.status_code != 200:
            return None
        html = r.text
        m = _OG_RE_A.search(html) or _OG_RE_B.search(html)
        if m:
            candidate = m.group(1).strip()
            if candidate.startswith(("http://", "https://")):
                return candidate
    except Exception as e:  # noqa: BLE001
        log.debug(f"og:image scrape failed for {url}: {e}")
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
    total_scraped = 0
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
                fetched_at = datetime.now(timezone.utc).isoformat()
                # `image_url` + `image_resolved_at` go in $setOnInsert so they
                # are written exactly once per article and never overwritten on
                # subsequent RSS runs — gives us a permanent cache per the spec
                # ("only fetch once per article, never re-fetch").
                result = await db.ecosystem_news.update_one(
                    {"url": url},
                    {
                        "$setOnInsert": {
                            "first_seen_at": fetched_at,
                            "image_url": image_url,
                            "image_resolved_at": fetched_at,
                        },
                        "$set": {
                            "title": title,
                            "url": url,
                            "published_at": published_at,
                            "summary": summary,
                            "source": feed_cfg["name"],
                        },
                        "$currentDate": {"updated_at": True},
                    },
                    upsert=True,
                )
                total_seen += 1
                if result.upserted_id is not None:
                    total_new += 1
                    # Best-effort og:image scrape — only on freshly-inserted
                    # docs that didn't get an image from RSS media fields.
                    if image_url is None:
                        scraped = await _scrape_og_image(url)
                        if scraped:
                            await db.ecosystem_news.update_one(
                                {"_id": result.upserted_id},
                                {"$set": {"image_url": scraped}},
                            )
                            total_scraped += 1
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
        f"RSS fetch complete — seen={total_seen} new={total_new} scraped_og={total_scraped} "
        f"pruned={pruned} skipped_stale={total_skipped_stale} failures={failures or 'none'}"
    )
    return {"seen": total_seen, "new": total_new, "scraped_og": total_scraped,
            "pruned": pruned, "skipped_stale": total_skipped_stale, "failures": failures}

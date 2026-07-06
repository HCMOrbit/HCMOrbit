"""One-off full-index script — chunk + embed + upsert every KB article.

Usage:
    cd /app/backend
    VOYAGE_API_KEY=… python -m scripts.reindex_all_kb            # published only (recommended)
    VOYAGE_API_KEY=… python -m scripts.reindex_all_kb --all      # include drafts too

Prints a JSON report to stdout at the end, matching the shape of
`GET /api/admin/kb/index-stats`. Malformed docs are listed so the content
team knows which articles didn't split into the expected 15 sections.

Rate-limit safe — the embedder handles Voyage's 128/batch limit and
exponential backoff on 429s automatically.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

from services.kb_indexing.indexer import reindex_all


async def main() -> int:
    parser = argparse.ArgumentParser(description="Full KB re-index for Ask Orbit.")
    parser.add_argument(
        "--all",
        dest="include_drafts",
        action="store_true",
        help="Include unpublished articles (drafts). Default: published only.",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    report = await reindex_all(published_only=not args.include_drafts)
    print(json.dumps(report.as_dict(), indent=2))
    # Non-zero exit if we processed articles but wrote zero chunks — CI signal.
    if report.articles_processed > 0 and report.embeddings_written == 0:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

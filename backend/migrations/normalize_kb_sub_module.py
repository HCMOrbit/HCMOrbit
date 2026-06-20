"""One-shot data normalization — trim whitespace from `sub_module` and
convert empty strings to None. Safe to run repeatedly.

Usage (preview):
    cd /app/backend && python migrations/normalize_kb_sub_module.py

Usage (production Atlas):
    MONGO_URL=<atlas-url> DB_NAME=<prod-db> python migrations/normalize_kb_sub_module.py

Why: the KB sidebar groups by exact `sub_module` value, while admin upload
paths and earlier inserts didn't trim whitespace. Any trailing/leading space
or empty-string value causes mismatches between admin counts and public
sidebar / category counts. This script is idempotent — running it twice is
a no-op.
"""
import asyncio
import os
import sys
from pathlib import Path

# Make the script runnable from anywhere
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL and DB_NAME must be set")
    db = AsyncIOMotorClient(mongo_url)[db_name]

    trimmed = 0
    emptied = 0
    async for d in db.kb_docs.find(
        {"sub_module": {"$exists": True, "$ne": None}},
        {"_id": 0, "id": 1, "sub_module": 1},
    ):
        raw = d.get("sub_module") or ""
        clean = raw.strip()
        if clean == raw and raw != "":
            continue
        new_val = clean or None
        await db.kb_docs.update_one({"id": d["id"]}, {"$set": {"sub_module": new_val}})
        if new_val is None:
            emptied += 1
        else:
            trimmed += 1

    # Belt-and-braces: any remaining empty strings → None
    extra = await db.kb_docs.update_many(
        {"sub_module": ""}, {"$set": {"sub_module": None}}
    )

    print(f"Trimmed (kept value): {trimmed}")
    print(f"Empty / whitespace-only -> None: {emptied + extra.modified_count}")


if __name__ == "__main__":
    asyncio.run(main())

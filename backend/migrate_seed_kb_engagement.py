"""One-time migration: seed engagement counts + back-dated created_at on
existing KB docs that have empty/zero counts.

What it updates (per doc):
  - helpful_count       → random.randint(34, 74)
  - not_helpful_count   → random.randint(1, 6)
  - view_count          → random.randrange(101, 1004, 2)   # odd integer
  - created_at          → (now_utc - timedelta(days=random.randint(7, 90))).isoformat()

Target docs (selection criteria):
  helpful_count is either 0 OR missing/null.

Safety:
  - Reads MONGO_URL + DB_NAME from /app/backend/.env (or override via CLI env).
  - Prints a confirmation prompt with the host + DB name before mutating.
  - Skip with --yes for non-interactive runs.
  - Prints a per-doc summary on completion.

Usage:
  # Against local pod DB (validate the script first):
  cd /app/backend && python migrate_seed_kb_engagement.py

  # Against production Atlas (run yourself with the prod URL):
  MONGO_URL="mongodb+srv://USER:PASS@CLUSTER.mongodb.net" \\
  DB_NAME="hcmorbit_prod" \\
  python migrate_seed_kb_engagement.py --yes
"""
import asyncio
import os
import random
import sys
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorClient

# Load .env from the backend directory (where the script lives) if present —
# matches how the FastAPI app reads its config. Operators can override via
# real env vars (e.g. when targeting production Atlas).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    pass


def _redact(uri: str) -> str:
    """Hide username/password when echoing the URI back to the operator."""
    if "@" not in uri:
        return uri
    try:
        scheme, rest = uri.split("://", 1)
        creds, host = rest.split("@", 1)
        return f"{scheme}://****:****@{host}"
    except Exception:
        return "[unparseable uri]"


async def main(auto_confirm: bool) -> int:
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL and DB_NAME must be set.", file=sys.stderr)
        return 2

    print("KB engagement seeding migration")
    print("================================")
    print(f"  MongoDB URI : {_redact(mongo_url)}")
    print(f"  Database    : {db_name}")
    print(f"  Collection  : kb_docs")
    print(f"  Selector    : helpful_count is 0 OR missing OR null")
    print()

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    selector = {
        "$or": [
            {"helpful_count": {"$exists": False}},
            {"helpful_count": None},
            {"helpful_count": 0},
        ]
    }
    candidate_count = await db.kb_docs.count_documents(selector)
    total_docs = await db.kb_docs.count_documents({})
    print(f"  Candidates  : {candidate_count} of {total_docs} total kb_docs")

    if candidate_count == 0:
        print("\nNothing to do. Exiting.")
        client.close()
        return 0

    if not auto_confirm:
        try:
            ans = input("\nProceed? (type 'yes' to confirm): ").strip().lower()
        except EOFError:
            ans = ""
        if ans != "yes":
            print("Aborted.")
            client.close()
            return 1

    print("\nMigrating...")
    updated = 0
    now_utc = datetime.now(timezone.utc)
    cursor = db.kb_docs.find(selector, {"_id": 0, "id": 1, "title": 1})
    async for doc in cursor:
        days_back = random.randint(7, 90)
        new_values = {
            "helpful_count": random.randint(34, 74),
            "not_helpful_count": random.randint(1, 6),
            "view_count": random.randrange(101, 1004, 2),
            "created_at": (now_utc - timedelta(days=days_back)).isoformat(),
        }
        result = await db.kb_docs.update_one({"id": doc["id"]}, {"$set": new_values})
        if result.modified_count:
            updated += 1
            title = (doc.get("title") or "")[:60]
            h = new_values["helpful_count"]
            n = new_values["not_helpful_count"]
            pct = round(h * 100 / (h + n))
            print(f"  ✓ {doc['id'][:8]}…  views={new_values['view_count']:>4}  "
                  f"{h:>2}/{n}={pct}%  {days_back:>2}d back  {title}")

    print()
    print(f"DONE. Updated {updated} of {candidate_count} candidate docs.")
    client.close()
    return 0


if __name__ == "__main__":
    auto = "--yes" in sys.argv or os.environ.get("MIGRATE_YES") == "1"
    sys.exit(asyncio.run(main(auto_confirm=auto)))

"""One-off: re-parse every posting in `pulse_postings` under the new
Workday-relevance + module-tagging rules, and REPORT what would change.

Default behavior is READ-ONLY — it prints a diff report to stdout and
writes nothing. Pass `--commit` to apply the changes:
  * postings that would fail the new relevance filter → marked
    `is_active=false` AND `filtered_out_by_reparse=true` (audit trail).
    They stay in the collection — this script never deletes.
  * postings whose module tags change → `modules` field overwritten.
  * postings whose Workday-Inc employer_type became "vendor" via the seed
    update → employer_type field synced (postings are re-tagged by seed).

Usage:
    cd /app/backend
    python -m scripts.backfill_pulse_reparse                # dry run
    python -m scripts.backfill_pulse_reparse --commit       # apply
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter
from pathlib import Path

from core import db
from services.pulse import parser as p


SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "pulse_employers.json"


def _load_seed_employer_types() -> dict[str, str]:
    """{ employer_name: employer_type } from the seed file — used to sync
    any employer whose type changed (e.g. Workday → vendor)."""
    if not SEED_PATH.exists():
        return {}
    with open(SEED_PATH, "r", encoding="utf-8") as f:
        seed = json.load(f)
    return {e["name"]: e["employer_type"] for e in seed if e.get("name")}


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true",
                    help="Actually write the changes (default is dry-run).")
    ap.add_argument("--sample", type=int, default=20,
                    help="Print up to N dropped/re-tagged samples.")
    args = ap.parse_args()

    seed_types = _load_seed_employer_types()
    print(f"Seed file: {SEED_PATH}")
    print(f"Seed rows: {len(seed_types)}  (Workday → {seed_types.get('Workday')!r})")

    total = await db.pulse_postings.count_documents({})
    active = await db.pulse_postings.count_documents({"is_active": True})
    print(f"pulse_postings: total={total}  active={active}")
    print(f"Mode: {'COMMIT (writing)' if args.commit else 'DRY-RUN (no writes)'}\n")

    dropped: list[dict] = []
    modules_removed: list[dict] = []
    modules_added: list[dict] = []
    modules_unchanged = 0
    module_tag_delta: Counter = Counter()
    employer_type_synced: list[dict] = []

    cur = db.pulse_postings.find({}, {
        "_id": 1, "fingerprint": 1, "employer_name": 1, "employer_type": 1,
        "title_raw": 1, "description_raw": 1, "modules": 1, "is_active": 1,
    })
    n = 0
    async for doc in cur:
        n += 1
        title = doc.get("title_raw") or ""
        desc = doc.get("description_raw") or ""
        old_modules = list(doc.get("modules") or [])

        new_relevant = p.is_workday_relevant(title=title, description=desc)
        new_modules = p.tag_modules(title=title, description=desc)

        set_updates: dict = {}
        if not new_relevant and doc.get("is_active"):
            dropped.append({
                "employer": doc.get("employer_name"),
                "title": title,
                "old_modules": old_modules,
            })
            set_updates["is_active"] = False
            set_updates["filtered_out_by_reparse"] = True

        removed = sorted(set(old_modules) - set(new_modules))
        added = sorted(set(new_modules) - set(old_modules))
        if removed:
            modules_removed.append({
                "employer": doc.get("employer_name"),
                "title": title,
                "removed": removed,
                "kept": new_modules,
            })
            for m in removed:
                module_tag_delta[m] -= 1
        if added:
            modules_added.append({
                "employer": doc.get("employer_name"),
                "title": title,
                "added": added,
            })
            for m in added:
                module_tag_delta[m] += 1
        if not removed and not added:
            modules_unchanged += 1
        if removed or added:
            set_updates["modules"] = new_modules

        # Sync employer_type from seed if it changed (Workday → vendor).
        seed_type = seed_types.get(doc.get("employer_name") or "")
        if seed_type and seed_type != doc.get("employer_type"):
            employer_type_synced.append({
                "employer": doc.get("employer_name"),
                "old": doc.get("employer_type"),
                "new": seed_type,
            })
            set_updates["employer_type"] = seed_type

        if args.commit and set_updates:
            await db.pulse_postings.update_one({"_id": doc["_id"]}, {"$set": set_updates})

    # ── REPORT ────────────────────────────────────────────────────────────
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  postings scanned:              {n}")
    print(f"  would be marked inactive:      {len(dropped)}"
          f"  (of {active} currently active)")
    print(f"  postings with module tags removed: {len(modules_removed)}")
    print(f"  postings with module tags added:   {len(modules_added)}")
    print(f"  postings with no module change:    {modules_unchanged}")
    print(f"  employer_type synced from seed:    {len(employer_type_synced)}")

    print("\nModule tag delta (new_count - old_count across all postings):")
    for mod, delta in sorted(module_tag_delta.items(), key=lambda kv: kv[1]):
        sign = "+" if delta > 0 else ""
        print(f"  {mod:<15} {sign}{delta}")

    print(f"\nSample of postings that would be DROPPED (up to {args.sample}):")
    for d in dropped[: args.sample]:
        print(f"  - [{d['employer']}] {d['title']!r}  old_modules={d['old_modules']}")

    print(f"\nSample of postings with module tags REMOVED (up to {args.sample}):")
    for d in modules_removed[: args.sample]:
        print(f"  - [{d['employer']}] {d['title']!r}  removed={d['removed']}  kept={d['kept']}")

    if employer_type_synced:
        print(f"\nEmployer type sync (from seed):")
        # Group by employer for compact output
        by_emp: dict = {}
        for e in employer_type_synced:
            by_emp[(e["employer"], e["old"], e["new"])] = by_emp.get((e["employer"], e["old"], e["new"]), 0) + 1
        for (emp, old, new), c in by_emp.items():
            print(f"  - {emp}: {old!r} → {new!r}  ({c} postings)")

    if args.commit:
        print("\nApplied. `is_active=false` was set on dropped postings "
              "(also `filtered_out_by_reparse=true` for audit).")
    else:
        print("\nDRY RUN — no writes. Re-run with --commit to apply.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

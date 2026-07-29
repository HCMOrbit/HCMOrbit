"""One-off: trim `sub_module` (and `module` if present) on `kb_docs`.

READ-ONLY by default. Pass `--commit` to apply.

Behavior:
  * Reports every row where a normalized field differs from its stored value.
    Normalization: `.strip()`, and empty → None (collapses to removing the
    field with `$unset`). Matches the Pydantic validator on write.
  * If trimming would create a value that is already used by other docs
    inside the same collection, the trimmed value merges into that
    existing canonical value — no duplicate distinct spellings survive.
  * The `module` field isn't part of the current KB Pydantic model but is
    checked defensively in case legacy docs carry it.

Usage:
    cd /app/backend
    python -m scripts.trim_kb_sub_module               # dry-run
    python -m scripts.trim_kb_sub_module --commit      # apply
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from collections import defaultdict

from core import db

FIELDS = ("sub_module", "module")


def _norm(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="Apply the trims (default is dry-run).")
    args = ap.parse_args()

    # Per-field: known canonical (already-trimmed) values, and dirty-value groups.
    canonical: dict[str, set] = {f: set() for f in FIELDS}
    dirty: dict[str, list[dict]] = {f: [] for f in FIELDS}

    projection = {"_id": 0, "id": 1, "reference_id": 1, "title": 1, **{f: 1 for f in FIELDS}}
    async for d in db.kb_docs.find({}, projection):
        for field in FIELDS:
            if field not in d:
                continue
            raw = d[field]
            new = _norm(raw)
            if raw == new:
                if isinstance(new, str):
                    canonical[field].add(new)
                continue
            dirty[field].append({
                "id": d.get("id"),
                "reference_id": d.get("reference_id"),
                "title": (d.get("title") or "")[:80],
                "old": raw,
                "new": new,
            })

    total_dirty = sum(len(v) for v in dirty.values())
    print(f"=== KB sub_module / module whitespace audit ({'COMMIT' if args.commit else 'DRY-RUN'}) ===")
    print(f"  docs scanned:               {await db.kb_docs.count_documents({})}")
    print(f"  rows requiring normalization: {total_dirty}")

    for field in FIELDS:
        rows = dirty[field]
        if not rows and not canonical[field]:
            continue
        print(f"\n-- field: {field!r} --")
        print(f"  canonical (already clean) distinct values: {len(canonical[field])}")

        # Detect merges: trimmed value collides with an existing canonical spelling.
        merges: dict[str, list[dict]] = defaultdict(list)
        rewrites: list[dict] = []
        for r in rows:
            new = r["new"]
            if isinstance(new, str) and new in canonical[field]:
                merges[new].append(r)
            else:
                rewrites.append(r)

        if merges:
            print(f"  merges (trimmed → matches existing canonical value):")
            for canon, items in sorted(merges.items()):
                print(f"    {canon!r} ← {len(items)} row(s):")
                for r in items:
                    print(f"      - id={r['id']} ref={r['reference_id']!r}  {r['old']!r} → {r['new']!r}  {r['title']!r}")

        if rewrites:
            print(f"  rewrites (trimmed value new to canonical set):")
            for r in rewrites:
                print(f"    - id={r['id']} ref={r['reference_id']!r}  {r['old']!r} → {r['new']!r}  {r['title']!r}")

        if args.commit:
            applied = 0
            for r in rows:
                new = r["new"]
                update = {"$set": {field: new}} if new is not None else {"$unset": {field: ""}}
                res = await db.kb_docs.update_one({"id": r["id"]}, update)
                applied += res.modified_count
            print(f"  applied: {applied} update(s) to {field!r}")

    if not args.commit:
        print("\nDRY-RUN — no writes. Re-run with --commit to apply.")
    else:
        print("\nApplied.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

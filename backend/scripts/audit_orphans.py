"""One-off read-only audit — reports orphaned content, dead links, and thin modules.

Usage:
    cd /app/backend
    python -m scripts.audit_orphans                       # default thin-threshold=3
    python -m scripts.audit_orphans --thin-threshold 5

Emits plain text to stdout. Never writes to Mongo. Never mutates files.

Reachability model
------------------
Two independent methods determine whether a piece of content is "reachable"
from the frontend. Each item lists BOTH results so a whitelist that silently
declares something reachable can be spotted:

  [scan]      — the item's identifier (reference_id, category slug, space
                slug, module id, track id, industry id) appears as a string
                literal somewhere under `/app/frontend/src/**/*.{js,jsx}`.

  [curated]   — the item is reachable through a generic listing endpoint
                that the frontend renders (e.g. any published KB doc is
                reachable via `/knowledge-base/:slug` + search; any active
                space is reachable via `/community`; any published ecosystem
                item is reachable via its section index page).

An item flagged as ORPHANED CONTENT has NEITHER signal. Items reachable
only via [curated] are technically reachable through generic navigation but
are worth reviewing — they're the ones you might have forgotten exist.
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys
from collections import defaultdict
from pathlib import Path

from core import db  # noqa: E402  (import after path/env is set up by core)


FRONTEND_SRC = Path(__file__).resolve().parents[2] / "frontend" / "src"


# ---------- static scan ----------

# Any of these token shapes are considered "identifier-ish". We scan the
# frontend once and stash every quoted string that matches, so lookup is O(1).
_IDENT_RE = re.compile(r"""['"]([A-Za-z0-9][A-Za-z0-9_\-/]{1,80})['"]""")


def _load_frontend_literals() -> set[str]:
    """Return every quoted string literal found in `/app/frontend/src`."""
    literals: set[str] = set()
    if not FRONTEND_SRC.exists():
        return literals
    for path in FRONTEND_SRC.rglob("*"):
        if path.suffix not in (".js", ".jsx", ".ts", ".tsx"):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for m in _IDENT_RE.finditer(text):
            literals.add(m.group(1))
    return literals


# ---------- helpers ----------

def _hdr(text: str) -> str:
    bar = "=" * len(text)
    return f"\n{bar}\n{text}\n{bar}"


def _sub(text: str) -> str:
    return f"\n--- {text} ---"


def _fmt_reach(scan_hit: bool, curated_hit: bool) -> str:
    a = "scan" if scan_hit else "----"
    b = "curated" if curated_hit else "-------"
    return f"[{a}|{b}]"


# ---------- audits ----------

async def audit_kb_docs(literals: set[str]) -> tuple[list[str], list[str]]:
    """Return (orphaned_lines, dead_link_lines) for KB documents."""
    orphaned: list[str] = []
    dead: list[str] = []

    # Load categories once — a doc is curated-reachable only if its
    # category_slug matches a real category AND the doc is published.
    cats = await db.kb_categories.find({}, {"_id": 0, "slug": 1}).to_list(1000)
    valid_slugs = {c["slug"] for c in cats}

    projection = {
        "_id": 0, "id": 1, "reference_id": 1, "title": 1,
        "category_slug": 1, "is_published": 1, "sub_module": 1,
    }
    docs = await db.kb_docs.find({}, projection).to_list(5000)
    for d in docs:
        ref = d.get("reference_id") or ""
        title = d.get("title") or "(untitled)"
        slug = d.get("category_slug") or ""
        published = bool(d.get("is_published"))

        # Dead link: doc points at a category slug that doesn't exist.
        if slug and slug not in valid_slugs:
            dead.append(
                f"  kb_docs[{ref or d.get('id')}] category_slug={slug!r} "
                f"has no matching row in kb_categories — {title!r}"
            )

        scan_hit = bool(ref) and ref in literals
        curated_hit = published and slug in valid_slugs
        if not scan_hit and not curated_hit:
            status = "unpublished" if not published else "orphaned"
            orphaned.append(
                f"  {_fmt_reach(scan_hit, curated_hit)} kb_docs[{ref or d.get('id')}] "
                f"({status}, slug={slug!r}) — {title!r}"
            )

    return orphaned, dead


async def audit_kb_categories(literals: set[str]) -> list[str]:
    """Categories are always curated-reachable via `/knowledge-base`."""
    out: list[str] = []
    cats = await db.kb_categories.find({}, {"_id": 0}).to_list(200)
    for c in cats:
        slug = c.get("slug") or ""
        name = c.get("name") or "(unnamed)"
        scan_hit = slug in literals
        # Categories are always listed by /knowledge-base → curated=true
        curated_hit = True
        out.append(f"  {_fmt_reach(scan_hit, curated_hit)} kb_categories[{slug}] — {name!r}")
    return out


async def audit_spaces(literals: set[str]) -> list[str]:
    out: list[str] = []
    cur = db.spaces.find({}, {"_id": 0})
    async for s in cur:
        slug = s.get("slug") or ""
        name = s.get("name") or "(unnamed)"
        hidden = bool(s.get("is_hidden"))
        scan_hit = slug in literals
        curated_hit = not hidden  # community listing surfaces non-hidden spaces
        if not scan_hit and not curated_hit:
            out.append(
                f"  {_fmt_reach(scan_hit, curated_hit)} spaces[{slug}] "
                f"(hidden) — {name!r}"
            )
    return out


async def audit_ecosystem(literals: set[str]) -> list[str]:
    """Reports items in ecosystem_* collections that aren't published/active."""
    out: list[str] = []
    surface_configs = [
        ("ecosystem_events", "title", {"is_archived": {"$ne": True}}),
        ("ecosystem_news", "title", {"status": "published"}),
        ("ecosystem_certifications", "name", {"is_archived": {"$ne": True}}),
    ]
    for coll_name, title_field, live_filter in surface_configs:
        coll = db[coll_name]
        total = await coll.count_documents({})
        live = await coll.count_documents(live_filter)
        dead_count = total - live
        if dead_count <= 0:
            continue
        out.append(f"  {coll_name}: {dead_count}/{total} rows not surfaced (filter={live_filter})")
        # Sample up to 10 non-surfaced rows.
        rows = await coll.find(
            {"$nor": [live_filter]}, {title_field: 1, "id": 1},
        ).limit(10).to_list(10)
        for r in rows:
            rid = r.get("id") or str(r.get("_id"))
            out.append(f"    - {coll_name}[{rid}] — {r.get(title_field)!r}")
    return out


async def audit_intel(literals: set[str]) -> list[str]:
    """Reports sample_data rows in intel_* that were never approved."""
    out: list[str] = []
    intel_colls = [
        "intel_go_lives", "intel_hiring_signals", "intel_trends",
        "intel_events", "intel_sources",
    ]
    for coll_name in intel_colls:
        coll = db[coll_name]
        total = await coll.count_documents({})
        sample = await coll.count_documents({"status": "sample_data"})
        if sample > 0:
            out.append(
                f"  {coll_name}: {sample}/{total} rows still status='sample_data' "
                f"(never promoted to 'approved')"
            )
    return out


async def audit_pulse(literals: set[str]) -> list[str]:
    out: list[str] = []
    total = await db.pulse_postings.count_documents({})
    inactive = await db.pulse_postings.count_documents({"is_active": False})
    if total:
        out.append(f"  pulse_postings: {inactive}/{total} inactive (stale from last crawl)")
    return out


async def audit_career_hub_data(literals: set[str]) -> tuple[list[str], list[str]]:
    """Cross-check `careerNavigator/data.js` references against the DB."""
    dead: list[str] = []
    orphaned: list[str] = []
    data_path = FRONTEND_SRC / "careerNavigator" / "data.js"
    if not data_path.exists():
        return orphaned, dead
    text = data_path.read_text(encoding="utf-8", errors="ignore")

    # Grab every docId:"..." string reference.
    doc_ids = re.findall(r"""docId\s*:\s*['"]([^'"]+)['"]""", text)
    if not doc_ids:
        return orphaned, dead

    # Lookup which of those exist as reference_id in kb_docs.
    existing = await db.kb_docs.find(
        {"reference_id": {"$in": doc_ids}},
        {"_id": 0, "reference_id": 1, "is_published": 1},
    ).to_list(2000)
    existing_map = {d["reference_id"]: bool(d.get("is_published")) for d in existing}
    for did in sorted(set(doc_ids)):
        if did not in existing_map:
            dead.append(f"  career-hub data.js docId={did!r} — no matching kb_docs.reference_id")
        elif not existing_map[did]:
            dead.append(f"  career-hub data.js docId={did!r} — points at UNPUBLISHED doc")

    # Track ids referenced by matchTrackId that don't exist as a TRACK id.
    track_ids = re.findall(r"""id\s*:\s*['"]([a-z\-]+)['"]""", text)
    match_track_ids = re.findall(
        r"""matchTrackId\s*:\s*['"]([a-z\-]+)['"]""", text
    )
    unknown = sorted(set(match_track_ids) - set(track_ids))
    for tid in unknown:
        dead.append(f"  career-hub data.js matchTrackId={tid!r} — no matching TRACKS[].id")

    return orphaned, dead


async def audit_thin_modules(threshold: int) -> tuple[list[str], list[str]]:
    """Return (all_module_counts, thin_lines).

    Modules are gathered from three sources:
      * `careerNavigator/data.js` TRACKS[].id  (canonical career-hub set)
      * kb_docs.sub_module distinct values
      * user profiles' workday_modules distinct values
    """
    modules: set[str] = set()
    data_path = FRONTEND_SRC / "careerNavigator" / "data.js"
    if data_path.exists():
        text = data_path.read_text(encoding="utf-8", errors="ignore")
        # Only the TRACKS array's `id:"..."` entries — heuristic: first block.
        tracks_block = re.search(
            r"export\s+const\s+TRACKS\s*=\s*\[(.+?)\];", text, re.DOTALL,
        )
        if tracks_block:
            for m in re.finditer(r"""id\s*:\s*['"]([a-z\-]+)['"]""", tracks_block.group(1)):
                modules.add(m.group(1))

    kb_sub_modules = await db.kb_docs.distinct("sub_module", {"is_published": True})
    for sm in kb_sub_modules:
        if sm:
            modules.add(str(sm).strip().lower().replace(" ", "-"))

    user_mods = await db.users.distinct("workday_modules")
    for um in user_mods:
        if um:
            modules.add(str(um).strip().lower().replace(" ", "-"))

    # Count published kb_docs per module (match either sub_module or
    # category_slug — both are used in the codebase).
    counts: dict[str, int] = {}
    for mod in sorted(modules):
        variants = {mod, mod.replace("-", " "), mod.title(), mod.upper()}
        n = await db.kb_docs.count_documents({
            "is_published": True,
            "$or": [
                {"sub_module": {"$in": list(variants)}},
                {"category_slug": mod},
            ],
        })
        counts[mod] = n

    lines_all = [
        f"  {mod:<24} {n:>4} published kb_docs"
        for mod, n in sorted(counts.items(), key=lambda kv: (kv[1], kv[0]))
    ]
    lines_thin = [
        f"  THIN  {mod:<24} {n:>4}  (< {threshold})"
        for mod, n in sorted(counts.items(), key=lambda kv: (kv[1], kv[0]))
        if n < threshold
    ]
    return lines_all, lines_thin


async def audit_frontend_ref_dead_links(literals: set[str]) -> list[str]:
    """String literals in frontend that LOOK like KB reference_ids but resolve to nothing.

    Heuristic: uppercase-ish tokens matching KB reference patterns
    (e.g. WDPAY-001, PAYROLL-WDPAY-KB-001, TA-ONB-KB-001).
    """
    out: list[str] = []
    ref_like = {
        s for s in literals
        if re.fullmatch(r"[A-Z][A-Z0-9]{1,20}(-[A-Z0-9]{1,20}){1,5}", s)
    }
    if not ref_like:
        return out
    existing = await db.kb_docs.find(
        {"reference_id": {"$in": list(ref_like)}},
        {"_id": 0, "reference_id": 1},
    ).to_list(5000)
    have = {d["reference_id"] for d in existing}
    missing = sorted(ref_like - have)
    for m in missing:
        out.append(f"  frontend literal {m!r} looks like a kb_docs reference_id — no match in DB")
    return out


# ---------- main ----------

async def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only content-reachability audit.")
    parser.add_argument("--thin-threshold", type=int, default=3,
                        help="Modules with fewer than N published kb_docs are flagged as thin (default: 3).")
    args = parser.parse_args()

    print(_hdr("HCMOrbit content-reachability audit"))
    print(f"DB: {db.name}   thin-threshold: {args.thin_threshold}")
    print("Reachability tag format: [scan|curated]  (--- = not reached that way)")

    literals = _load_frontend_literals()
    print(f"Frontend string literals scanned: {len(literals):,}")

    # ORPHANED CONTENT ------------------------------------------------------
    print(_hdr("ORPHANED CONTENT"))
    orphaned_kb, dead_kb = await audit_kb_docs(literals)
    print(_sub(f"kb_docs — {len(orphaned_kb)} items with no static reference AND not curated-reachable"))
    for line in orphaned_kb or ["  (none)"]:
        print(line)

    print(_sub("kb_categories (all should be reachable via /knowledge-base)"))
    for line in await audit_kb_categories(literals):
        print(line)

    space_lines = await audit_spaces(literals)
    print(_sub(f"spaces — {len(space_lines)} hidden or off-grid"))
    for line in space_lines or ["  (none)"]:
        print(line)

    eco_lines = await audit_ecosystem(literals)
    print(_sub("ecosystem_* — rows that live in the DB but aren't currently surfaced"))
    for line in eco_lines or ["  (none)"]:
        print(line)

    intel_lines = await audit_intel(literals)
    print(_sub("intel_* — seeded sample rows never promoted"))
    for line in intel_lines or ["  (none)"]:
        print(line)

    pulse_lines = await audit_pulse(literals)
    print(_sub("pulse_postings — inactive after last crawl"))
    for line in pulse_lines or ["  (none)"]:
        print(line)

    # DEAD LINKS ------------------------------------------------------------
    print(_hdr("DEAD LINKS"))
    orphaned_ch, dead_ch = await audit_career_hub_data(literals)
    dead_fe = await audit_frontend_ref_dead_links(literals)

    print(_sub(f"kb_docs → kb_categories orphans ({len(dead_kb)})"))
    for line in dead_kb or ["  (none)"]:
        print(line)

    print(_sub(f"careerNavigator/data.js docId + matchTrackId references ({len(dead_ch)})"))
    for line in dead_ch or ["  (none)"]:
        print(line)

    print(_sub(f"frontend reference_id-shaped literals with no DB match ({len(dead_fe)})"))
    for line in dead_fe or ["  (none)"]:
        print(line)

    # THIN MODULES ----------------------------------------------------------
    print(_hdr(f"THIN MODULES (threshold < {args.thin_threshold})"))
    all_counts, thin = await audit_thin_modules(args.thin_threshold)
    print(_sub("All modules — published kb_docs count, ascending"))
    for line in all_counts or ["  (no modules detected)"]:
        print(line)
    print(_sub(f"Thin modules ({len(thin)})"))
    for line in thin or ["  (none)"]:
        print(line)

    # METHODOLOGY -----------------------------------------------------------
    print(_hdr("METHODOLOGY"))
    print(f"""\
Two reachability signals were computed for every content row:

  [scan]     A string literal matching the row's identifier
             (reference_id / slug / id / module name) was found under
             {FRONTEND_SRC}
             by naive regex over every .js/.jsx/.ts/.tsx file.
             Total literals scanned: {len(literals):,}.

  [curated]  The row is reachable through a generic listing endpoint the
             frontend already renders:
               * kb_docs         — published AND category_slug exists in
                                   kb_categories → reachable via
                                   /knowledge-base/:slug + search
               * kb_categories   — always reachable via /knowledge-base
               * spaces          — not is_hidden → reachable via /community
               * ecosystem_*     — published/non-archived → reachable via
                                   /ecosystem/(news|events|certifications)

ORPHANED CONTENT lists rows where BOTH signals are false — i.e. no static
reference AND not currently surfaced through a listing page.

DEAD LINKS lists references that resolve to nothing:
  * kb_docs pointing at a non-existent category_slug
  * career-hub data.js docIds pointing at missing / unpublished kb_docs
  * career-hub matchTrackIds pointing at missing TRACKS[].id
  * frontend string literals that LOOK like a kb reference_id
    (uppercase, hyphen-segmented) but have no row in kb_docs

THIN MODULES lists the distribution of published kb_docs per module.
Modules are the union of:
  * TRACKS[].id from careerNavigator/data.js
  * distinct sub_module values on published kb_docs
  * distinct workday_modules on user profiles
Counts include both sub_module matches and category_slug matches — either
one is treated as coverage. All modules are printed (not just those under
the threshold) so the distribution is visible.

This script is READ-ONLY: no collection is written, no file is modified.
""")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

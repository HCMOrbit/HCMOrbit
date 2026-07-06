"""Admin routes for the Ask Orbit KB indexing pipeline.

Behind `require_admin`. Endpoints:
    POST /admin/kb/reindex/{reference_id}   — re-index one article
    POST /admin/kb/reindex-all              — full rebuild (all published articles)
    GET  /admin/kb/index-stats              — chunk collection health check
    GET  /admin/kb/health                   — live Voyage ping / env sanity check
"""
from __future__ import annotations

import os
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from core import db
from dependencies import log_admin_action, require_admin
from services.kb_indexing.chunker import _H1_RE, chunk_article
from services.kb_indexing.embedder import (
    EMBEDDING_DIM, EMBEDDING_MODEL, VOYAGE_API_URL,
)
from services.kb_indexing.indexer import reindex_all, reindex_article

router = APIRouter()


@router.post("/admin/kb/reindex/{reference_id}")
async def admin_reindex_article(
    reference_id: str,
    admin: dict = Depends(require_admin),
):
    """Rebuild chunks + embeddings for a single article. Idempotent —
    re-running deletes and replaces the article's chunks, never duplicates.

    On failure returns HTTP 500 with the actual exception details in
    `detail.errors` — callers should not need to consult deploy logs to
    understand why an indexing call failed.
    """
    report = await reindex_article(reference_id)
    if report.errors and report.articles_indexed == 0:
        # Article not found → 404. Any other error → 500 WITH the report so
        # callers can see the exception type + traceback tail.
        if any("not found" in e for e in report.errors):
            raise HTTPException(404, report.errors[0])
        raise HTTPException(500, {"message": "reindex failed", "report": report.as_dict()})
    await log_admin_action(
        admin, "kb_reindex_article",
        note=f"{reference_id} → {report.chunks_created} chunks",
    )
    return report.as_dict()


@router.post("/admin/kb/reindex-all")
async def admin_reindex_all(
    published_only: bool = Query(True, description="Only index published articles"),
    admin: dict = Depends(require_admin),
):
    """Rebuild chunks + embeddings for every article. Long-running — expect
    ~1s per article at Voyage's rate limits, so ~1000 articles ≈ 15–20 min.
    Returned report includes the malformed-parse list so you know which
    articles failed to split into the expected 15 sections."""
    report = await reindex_all(published_only=published_only)
    await log_admin_action(
        admin, "kb_reindex_all",
        note=f"{report.articles_indexed}/{report.articles_processed} → {report.chunks_created} chunks, {len(report.malformed)} malformed",
    )
    return report.as_dict()


@router.get("/admin/kb/index-stats")
async def admin_index_stats(
    verify_vectors: bool = Query(
        False,
        description="If true, also samples one random chunk and returns its "
                    "embedding dim + first 5 dims — cheap live sanity check "
                    "that Voyage-issued vectors landed in kb_chunks correctly.",
    ),
    admin: dict = Depends(require_admin),
):
    """Sanity check for the vector store — how many chunks, how many unique
    articles indexed, average chunks/article, embedding model in use.

    Set `?verify_vectors=true` to also pull one sample chunk's embedding
    metadata into the response so you can validate the pipeline end-to-end
    with a single curl (no shell/DB access needed)."""
    total_chunks = await db.kb_chunks.count_documents({})
    # Distinct reference_ids indexed
    distinct = await db.kb_chunks.distinct("reference_id")
    articles_indexed = len(distinct)
    # Average chunks per article — cheap read since we already have the count
    avg = round(total_chunks / articles_indexed, 1) if articles_indexed else 0.0
    # Confirm all chunks agree on model + dim (drift check)
    models = await db.kb_chunks.distinct("embedding_model")
    dims = await db.kb_chunks.distinct("embedding_dim")
    result = {
        "total_chunks": total_chunks,
        "articles_indexed": articles_indexed,
        "avg_chunks_per_article": avg,
        "embedding_model_config": EMBEDDING_MODEL,
        "embedding_dim_config": EMBEDDING_DIM,
        "embedding_models_in_collection": models,
        "embedding_dims_in_collection": dims,
    }
    if verify_vectors and total_chunks > 0:
        # Pick a small deterministic sample so repeat calls return the same doc
        # (avoids the "was that a fresh embed?" confusion when re-checking).
        # We use $sample for random pick — one chunk is enough for shape check.
        pipeline = [
            {"$sample": {"size": 1}},
            {"$project": {
                "_id": 0, "chunk_id": 1, "reference_id": 1,
                "section_number": 1, "section_title": 1,
                "embedding_model": 1, "embedding_dim": 1,
                "embedding": 1, "indexed_at": 1,
            }},
        ]
        docs = await db.kb_chunks.aggregate(pipeline).to_list(1)
        if docs:
            c = docs[0]
            vec = c.get("embedding") or []
            result["sample_chunk"] = {
                "chunk_id": c.get("chunk_id"),
                "reference_id": c.get("reference_id"),
                "section_number": c.get("section_number"),
                "section_title": c.get("section_title"),
                "embedding_model": c.get("embedding_model"),
                "embedding_dim_recorded": c.get("embedding_dim"),
                "vector_length_actual": len(vec),
                "vector_first_5_dims": vec[:5],
                "indexed_at": c.get("indexed_at"),
            }
    return result



@router.get("/admin/kb/health")
async def admin_kb_health(admin: dict = Depends(require_admin)):
    """Live diagnostic for the indexing pipeline.

    Reports:
      • Whether VOYAGE_API_KEY is readable at runtime (bool + length; no key echoed)
      • Whether api.voyageai.com is reachable and returns a valid vector for a
        one-token test input
      • The exact upstream HTTP status + response body tail on any failure
        so you don't need deploy logs to diagnose a 500 elsewhere

    Safe to call anytime — spends one Voyage call (a few tokens).
    """
    key = os.environ.get("VOYAGE_API_KEY", "")
    key_present = bool(key)
    result: dict = {
        "voyage_key_present": key_present,
        "voyage_key_length": len(key),
        "voyage_model_configured": EMBEDDING_MODEL,
        "voyage_expected_dim": EMBEDDING_DIM,
        "voyage_api_url": VOYAGE_API_URL,
        "voyage_test_call": None,
    }
    if not key_present:
        result["voyage_test_call"] = {
            "ok": False,
            "reason": "VOYAGE_API_KEY env var is empty or unset in this environment",
        }
        return result

    payload = {"input": ["ping"], "model": EMBEDDING_MODEL, "input_type": "query"}
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(VOYAGE_API_URL, json=payload, headers=headers)
        latency_ms = round((time.monotonic() - started) * 1000, 1)
        info = {
            "ok": resp.status_code == 200,
            "http_status": resp.status_code,
            "latency_ms": latency_ms,
        }
        if resp.status_code == 200:
            data = resp.json()
            vec = data.get("data", [{}])[0].get("embedding", [])
            info["vector_length"] = len(vec)
            info["vector_first_5_dims"] = vec[:5]
            info["voyage_model_returned"] = data.get("model")
        else:
            # Include short body so caller sees whether it's 401 (bad key),
            # 429 (rate-limited), 400 (payload issue), etc.
            info["response_body_tail"] = resp.text[:400]
        result["voyage_test_call"] = info
    except httpx.HTTPError as e:
        result["voyage_test_call"] = {
            "ok": False,
            "exception_type": type(e).__name__,
            "exception_message": str(e),
        }
    return result


# ── Section-parse diagnostic ─────────────────────────────────────────────
import re as _re  # local alias to avoid touching imports at top of file


# Broad candidate scan — catches heading-like lines the current regex might
# miss. Used ONLY for diagnostics; never for indexing.
_HEADING_CANDIDATE_RE = _re.compile(
    r"^\s*(?:#{0,4}\s*)?(?:\*{0,2}\s*)?"  # optional hashes + bold
    r"(?:Section\s+)?"                    # optional "Section " prefix
    r"([IVXLCDM]+|\d{1,3})"               # roman OR arabic number
    r"\s*[\.\)\:]\s+"                     # separator: . ) or :
    r"(.+?)\s*\*{0,2}\s*$",
    _re.MULTILINE | _re.IGNORECASE,
)


@router.get("/admin/kb/section-diagnostic/{reference_id}")
async def admin_section_diagnostic(
    reference_id: str,
    admin: dict = Depends(require_admin),
):
    """Show what the section chunker caught vs missed on a specific article.

    Returned shape:
        {
          "reference_id": "...",
          "title": "...",
          "body_length": 42079,
          "current_regex_pattern": "<pattern>",
          "current_regex_matches": [{"line_no", "text"}],
          "candidate_headings":    [{"line_no", "text", "matched_by_current_regex": bool}],
          "missed_lines":          [{"line_no", "text"}],
          "section_count_detected": 13,
          "diagnosis": "..."
        }

    The `missed_lines` array is the actionable output — if 55 articles all show
    the same shape of missed line (e.g. `## 5) Foo` with a paren separator),
    the regex fix is trivial. If missed_lines is empty and detected < 15, the
    article is genuinely authored short (content backlog).
    """
    doc = await db.kb_docs.find_one(
        {"reference_id": reference_id},
        {"_id": 0, "reference_id": 1, "title": 1, "body": 1},
    )
    if not doc:
        raise HTTPException(404, f"article not found: reference_id={reference_id}")
    body = doc.get("body") or ""

    # What the CURRENT chunker regex matches (single source of truth — same
    # object the real indexer uses).
    strict_matches = set()
    strict_details: list[dict] = []
    for m in _H1_RE.finditer(body):
        line_no = body.count("\n", 0, m.start())
        line_text = body[m.start():m.end()].strip()
        strict_matches.add(line_text)
        strict_details.append({"line_no": line_no, "text": line_text})

    # Broad candidate scan — everything that could plausibly be a section
    # heading. Delta = what the strict regex missed.
    candidates: list[dict] = []
    missed: list[dict] = []
    for m in _HEADING_CANDIDATE_RE.finditer(body):
        line_no = body.count("\n", 0, m.start())
        line_text = body[m.start():m.end()].strip()
        matched = line_text in strict_matches
        entry = {"line_no": line_no, "text": line_text, "matched_by_current_regex": matched}
        candidates.append(entry)
        if not matched:
            missed.append({"line_no": line_no, "text": line_text})

    diagnosis = (
        f"Regex caught {len(strict_matches)} headings; broad scan found "
        f"{len(candidates)} candidates. "
    )
    if len(strict_matches) == 15:
        diagnosis += "Article parses cleanly to 15 sections — no fix needed."
    elif missed:
        diagnosis += (
            f"{len(missed)} candidate heading(s) MISSED by current regex — "
            f"likely a heading-format variant. Share `missed_lines` to fix."
        )
    else:
        diagnosis += (
            "No additional headings detected by broad scan — article appears "
            "to be genuinely authored with fewer sections (content backlog)."
        )

    return {
        "reference_id": reference_id,
        "title": doc.get("title", ""),
        "body_length": len(body),
        "current_regex_pattern": _H1_RE.pattern,
        "section_count_detected": len(strict_matches),
        "current_regex_matches": strict_details,
        "candidate_headings": candidates,
        "missed_lines": missed,
        "diagnosis": diagnosis,
    }

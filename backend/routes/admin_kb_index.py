"""Admin routes for the Ask Orbit KB indexing pipeline.

Behind `require_admin`. Endpoints:
    POST /admin/kb/reindex/{reference_id}   — re-index one article
    POST /admin/kb/reindex-all              — full rebuild (all published articles)
    GET  /admin/kb/index-stats              — chunk collection health check
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from core import db
from dependencies import log_admin_action, require_admin
from services.kb_indexing.embedder import EMBEDDING_DIM, EMBEDDING_MODEL
from services.kb_indexing.indexer import reindex_all, reindex_article

router = APIRouter()


@router.post("/admin/kb/reindex/{reference_id}")
async def admin_reindex_article(
    reference_id: str,
    admin: dict = Depends(require_admin),
):
    """Rebuild chunks + embeddings for a single article. Idempotent —
    re-running deletes and replaces the article's chunks, never duplicates."""
    report = await reindex_article(reference_id)
    if report.errors and report.articles_indexed == 0:
        # Article not found → 404. Any other error → 500.
        if any("not found" in e for e in report.errors):
            raise HTTPException(404, report.errors[0])
        raise HTTPException(500, "; ".join(report.errors))
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

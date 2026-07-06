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
async def admin_index_stats(admin: dict = Depends(require_admin)):
    """Sanity check for the vector store — how many chunks, how many unique
    articles indexed, average chunks/article, embedding model in use."""
    total_chunks = await db.kb_chunks.count_documents({})
    # Distinct reference_ids indexed
    distinct = await db.kb_chunks.distinct("reference_id")
    articles_indexed = len(distinct)
    # Average chunks per article — cheap read since we already have the count
    avg = round(total_chunks / articles_indexed, 1) if articles_indexed else 0.0
    # Confirm all chunks agree on model + dim (drift check)
    models = await db.kb_chunks.distinct("embedding_model")
    dims = await db.kb_chunks.distinct("embedding_dim")
    return {
        "total_chunks": total_chunks,
        "articles_indexed": articles_indexed,
        "avg_chunks_per_article": avg,
        "embedding_model_config": EMBEDDING_MODEL,
        "embedding_dim_config": EMBEDDING_DIM,
        "embedding_models_in_collection": models,
        "embedding_dims_in_collection": dims,
    }

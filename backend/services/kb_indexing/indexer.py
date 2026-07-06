"""KB indexing orchestrator — chunk → embed → write to `kb_chunks`.

Idempotent by design:
    reindex_article(reference_id) deletes existing chunks for that article
    THEN writes fresh ones — so re-running never duplicates.

Both operations return an `IndexReport` for logging and admin UI display.
"""
from __future__ import annotations

import logging
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from core import db
from services.kb_indexing.chunker import chunk_article
from services.kb_indexing.embedder import EMBEDDING_DIM, EMBEDDING_MODEL, embed_texts

log = logging.getLogger(__name__)


@dataclass
class MalformedDoc:
    reference_id: str
    doc_title: str
    reason: str
    section_count: int


@dataclass
class IndexReport:
    articles_processed: int = 0
    articles_indexed: int = 0
    articles_skipped: int = 0
    chunks_created: int = 0
    embeddings_written: int = 0
    embedding_model: str = EMBEDDING_MODEL
    embedding_dim: int = EMBEDDING_DIM
    malformed: list[MalformedDoc] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    started_at: str = ""
    finished_at: str = ""

    def as_dict(self) -> dict:
        return {
            "articles_processed": self.articles_processed,
            "articles_indexed": self.articles_indexed,
            "articles_skipped": self.articles_skipped,
            "chunks_created": self.chunks_created,
            "embeddings_written": self.embeddings_written,
            "embedding_model": self.embedding_model,
            "embedding_dim": self.embedding_dim,
            "malformed_count": len(self.malformed),
            "malformed": [m.__dict__ for m in self.malformed],
            "errors": self.errors,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


async def _load_article(reference_id: str) -> Optional[dict]:
    """Find an article by reference_id first, id fallback."""
    doc = await db.kb_docs.find_one(
        {"reference_id": reference_id},
        {"_id": 0, "id": 1, "reference_id": 1, "title": 1, "body": 1, "published": 1},
    )
    if doc:
        return doc
    return await db.kb_docs.find_one(
        {"id": reference_id},
        {"_id": 0, "id": 1, "reference_id": 1, "title": 1, "body": 1, "published": 1},
    )


def _match_key(article: dict) -> str:
    """The stable key we index chunks under — reference_id if set, else id.
    kb_docs migrations mean older articles may only have `id`."""
    return article.get("reference_id") or article.get("id") or ""


async def _delete_existing(reference_id: str) -> int:
    """Idempotency guard — delete any chunks previously indexed for this article."""
    result = await db.kb_chunks.delete_many({"reference_id": reference_id})
    return result.deleted_count


async def _index_one_article(article: dict, report: IndexReport) -> None:
    """Chunk + embed + write a single article. Mutates `report` in place."""
    ref = _match_key(article)
    if not ref:
        report.articles_skipped += 1
        report.errors.append(f"article without reference_id/id (title={article.get('title', '?')[:40]!r})")
        return

    chunk_result = chunk_article(
        reference_id=ref,
        doc_title=article.get("title", ""),
        body=article.get("body", ""),
    )
    if chunk_result.is_malformed:
        report.malformed.append(MalformedDoc(
            reference_id=ref,
            doc_title=chunk_result.doc_title,
            reason=chunk_result.malformed_reason,
            section_count=chunk_result.section_count,
        ))

    if not chunk_result.chunks:
        report.articles_skipped += 1
        return

    # Delete existing chunks BEFORE writing new — idempotent.
    await _delete_existing(ref)

    texts = [c.text for c in chunk_result.chunks]
    try:
        vectors = await embed_texts(texts, input_type="document")
    except Exception as e:
        report.errors.append(f"{ref}: embedding failed: {e}")
        return

    now = datetime.now(timezone.utc).isoformat()
    records = []
    for chunk, vec in zip(chunk_result.chunks, vectors):
        record = chunk.as_dict()
        record["embedding"] = vec
        record["embedding_model"] = EMBEDDING_MODEL
        record["embedding_dim"] = EMBEDDING_DIM
        record["indexed_at"] = now
        records.append(record)

    await db.kb_chunks.insert_many(records)
    report.articles_indexed += 1
    report.chunks_created += len(chunk_result.chunks)
    report.embeddings_written += len(records)


async def reindex_article(reference_id: str) -> IndexReport:
    """Rebuild chunks + embeddings for one article. Idempotent.

    Captures ANY exception (Voyage HTTP, Mongo insert, chunker bugs) into
    `report.errors` with the full type + message + traceback tail. The
    admin route reflects that into its HTTP 500 body so callers can debug
    without shell access to the deploy environment.
    """
    report = IndexReport(started_at=datetime.now(timezone.utc).isoformat())
    article = await _load_article(reference_id)
    if not article:
        report.errors.append(f"article not found: reference_id={reference_id}")
        report.finished_at = datetime.now(timezone.utc).isoformat()
        return report
    report.articles_processed = 1
    try:
        await _index_one_article(article, report)
    except Exception as e:  # noqa: BLE001 — surface any bug into the report
        log.exception("reindex_article failed for %s", reference_id)
        tb_tail = "\n".join(traceback.format_exception(type(e), e, e.__traceback__))[-1200:]
        report.errors.append(f"{reference_id}: {type(e).__name__}: {e}\n{tb_tail}")
    report.finished_at = datetime.now(timezone.utc).isoformat()
    log.info(f"Re-indexed article {reference_id}: {report.as_dict()}")
    return report


async def reindex_all(*, published_only: bool = True) -> IndexReport:
    """Rebuild chunks + embeddings for every KB article. Idempotent.

    Default `published_only=True` matches production intent — we don't want
    drafts leaking into Ask Orbit answers.
    """
    report = IndexReport(started_at=datetime.now(timezone.utc).isoformat())
    query: dict = {"published": True} if published_only else {}
    cursor = db.kb_docs.find(
        query,
        {"_id": 0, "id": 1, "reference_id": 1, "title": 1, "body": 1},
    )
    async for article in cursor:
        report.articles_processed += 1
        try:
            await _index_one_article(article, report)
        except Exception as e:  # noqa: BLE001 — one bad article shouldn't kill the batch
            log.exception("index failed for one article")
            report.errors.append(f"{_match_key(article) or '?'}: {e}")
    report.finished_at = datetime.now(timezone.utc).isoformat()
    log.info(
        "Full re-index complete: %d articles, %d chunks, %d embeddings, %d malformed",
        report.articles_indexed, report.chunks_created,
        report.embeddings_written, len(report.malformed),
    )
    return report

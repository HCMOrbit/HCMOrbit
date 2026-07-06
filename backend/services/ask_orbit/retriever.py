"""Vector retriever for Ask Orbit.

Thin wrapper around Atlas `$vectorSearch` against the `kb_chunks` collection.
Query text → Voyage query embedding (input_type="query") → top-K chunks with
score. The scope gate lives here — if the top-1 score falls below
`RELEVANCE_THRESHOLD` we tell the service layer "out of scope" so Claude
is never asked to answer from general knowledge.

The Atlas index name (`kb_chunks_vector_index`) must match
`atlas-index-definition.json` at the repo root.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

from core import db
from services.kb_indexing.embedder import EMBEDDING_MODEL, embed_texts

log = logging.getLogger(__name__)

ATLAS_INDEX_NAME = os.environ.get("ASK_ORBIT_VECTOR_INDEX", "kb_chunks_vector_index")
TOP_K = int(os.environ.get("ASK_ORBIT_TOP_K", "6"))
NUM_CANDIDATES = int(os.environ.get("ASK_ORBIT_NUM_CANDIDATES", "100"))
# Cosine similarity score threshold below which we treat the question as
# out-of-scope. Voyage voyage-3 scores tend to sit in 0.55–0.85 range for
# real matches on typical Workday questions; 0.50 is a conservative floor.
RELEVANCE_THRESHOLD = float(os.environ.get("ASK_ORBIT_RELEVANCE_THRESHOLD", "0.50"))


@dataclass
class RetrievedChunk:
    chunk_id: str
    reference_id: str
    doc_title: str
    section_number: int
    section_title: str
    subsection: Optional[str]
    text: str
    score: float

    def as_dict(self) -> dict:
        return self.__dict__


@dataclass
class RetrievalResult:
    chunks: list[RetrievedChunk]
    top_score: float
    in_scope: bool
    error: Optional[str] = None  # populated if $vectorSearch failed (Atlas missing/misconfigured)


async def retrieve(question: str) -> RetrievalResult:
    """Embed `question` and return the top-K matching KB chunks + scope verdict."""
    q = (question or "").strip()
    if not q:
        return RetrievalResult(chunks=[], top_score=0.0, in_scope=False,
                               error="empty question")

    # Voyage models are asymmetric — MUST use input_type="query" for retrieval
    # or you get an accuracy hit vs the "document" embeddings written at index time.
    try:
        vectors = await embed_texts([q], input_type="query")
    except Exception as e:  # noqa: BLE001
        log.exception("query embedding failed")
        return RetrievalResult(chunks=[], top_score=0.0, in_scope=False,
                               error=f"embedding failed: {type(e).__name__}: {e}")

    pipeline = [
        {"$vectorSearch": {
            "index": ATLAS_INDEX_NAME,
            "path": "embedding",
            "queryVector": vectors[0],
            "numCandidates": NUM_CANDIDATES,
            "limit": TOP_K,
            # Filter: only the currently-configured embedding model. Prevents
            # cross-model contamination during a re-embed migration.
            "filter": {"embedding_model": {"$eq": EMBEDDING_MODEL}},
        }},
        {"$project": {
            "_id": 0,
            "chunk_id": 1, "reference_id": 1, "doc_title": 1,
            "section_number": 1, "section_title": 1, "subsection": 1,
            "text": 1,
            "score": {"$meta": "vectorSearchScore"},
        }},
    ]
    try:
        docs = await db.kb_chunks.aggregate(pipeline).to_list(TOP_K)
    except Exception as e:  # noqa: BLE001
        # Most likely on a fresh deploy: "$vectorSearch is not allowed" (M0 tier
        # without Vector Search enabled) or the index doesn't exist yet.
        # Surface a clean message so the /api/ask response is diagnosable.
        log.exception("vectorSearch failed")
        return RetrievalResult(chunks=[], top_score=0.0, in_scope=False,
                               error=f"vector search failed: {type(e).__name__}: {e}")

    chunks = [RetrievedChunk(
        chunk_id=d["chunk_id"],
        reference_id=d["reference_id"],
        doc_title=d.get("doc_title", ""),
        section_number=d.get("section_number", 0),
        section_title=d.get("section_title", ""),
        subsection=d.get("subsection"),
        text=d.get("text", ""),
        score=float(d.get("score", 0.0)),
    ) for d in docs]

    top_score = chunks[0].score if chunks else 0.0
    in_scope = top_score >= RELEVANCE_THRESHOLD and bool(chunks)
    return RetrievalResult(chunks=chunks, top_score=top_score, in_scope=in_scope)

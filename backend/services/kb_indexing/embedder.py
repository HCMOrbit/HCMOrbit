"""Embedding client for the KB indexing pipeline.

Provider: Voyage AI. Model: `voyage-3` (1024-dim, cosine similarity).
Locked by product owner Feb 2026 — no `emergentintegrations` or `litellm`
dependencies (CI guard). Uses `httpx` (already in requirements) directly.

Public API:
    embed_texts(texts) -> list[list[float]]
        Batched embedding call. Handles Voyage's 128-input batch limit and
        retries with exponential backoff on 429/5xx.
    EMBEDDING_MODEL: str  — the model name currently in use
    EMBEDDING_DIM: int    — the vector dimension for the current model
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

import httpx

log = logging.getLogger(__name__)

# Provider config (env-driven so we can switch to voyage-3-large without a code
# change). Kept intentionally simple — no runtime provider dispatch yet;
# spec locked Voyage as the single provider. If you later add OpenAI, this is
# the module that grows a dispatch.
VOYAGE_MODEL = os.environ.get("VOYAGE_MODEL", "voyage-3")
VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
VOYAGE_BATCH_SIZE = 128           # Voyage hard limit per request
VOYAGE_MAX_TOKENS_PER_BATCH = 120_000  # soft ceiling — see Voyage docs

# Vector dim by model. Extend here when new Voyage models are added.
_MODEL_DIMS = {
    "voyage-3": 1024,
    "voyage-3-large": 1024,
    "voyage-3-lite": 512,
    "voyage-code-3": 1024,
}

EMBEDDING_MODEL = VOYAGE_MODEL
EMBEDDING_DIM = _MODEL_DIMS.get(VOYAGE_MODEL, 1024)

_RETRY_BACKOFF_SECONDS = [1, 2, 5, 10, 30]


class EmbeddingError(RuntimeError):
    """Raised when embedding fails after all retries."""


def _api_key() -> str:
    key = os.environ.get("VOYAGE_API_KEY")
    if not key:
        raise EmbeddingError(
            "VOYAGE_API_KEY is not set. Add it to backend/.env (local) or the "
            "Railway environment (deployed) before running the indexer."
        )
    return key


async def _embed_batch(client: httpx.AsyncClient, texts: list[str], input_type: str) -> list[list[float]]:
    """Embed one batch (≤128 texts) with retry/backoff on 429/5xx."""
    payload = {
        "input": texts,
        "model": VOYAGE_MODEL,
        "input_type": input_type,  # "document" for indexing, "query" at retrieval
    }
    headers = {"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"}
    last_err: Optional[Exception] = None
    for attempt, backoff in enumerate([0, *_RETRY_BACKOFF_SECONDS]):
        if backoff:
            log.warning(f"Voyage retry {attempt}/{len(_RETRY_BACKOFF_SECONDS)} after {backoff}s")
            await asyncio.sleep(backoff)
        try:
            resp = await client.post(VOYAGE_API_URL, json=payload, headers=headers, timeout=60)
            if resp.status_code == 429 or resp.status_code >= 500:
                # Retryable — will loop with next backoff. Break early on last try.
                last_err = EmbeddingError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                continue
            resp.raise_for_status()
            data = resp.json()
            # Voyage returns `{"data": [{"embedding": [...]}], "model": "…", "usage": {…}}`
            embeddings = [row["embedding"] for row in data["data"]]
            if len(embeddings) != len(texts):
                raise EmbeddingError(f"Voyage returned {len(embeddings)} vectors for {len(texts)} inputs")
            return embeddings
        except httpx.HTTPError as e:
            last_err = e
    raise EmbeddingError(f"Voyage batch failed after {len(_RETRY_BACKOFF_SECONDS)} retries: {last_err}")


async def embed_texts(texts: list[str], *, input_type: str = "document") -> list[list[float]]:
    """Embed a list of texts. Automatically batches to Voyage's 128 limit.

    Args:
        texts: List of strings to embed.
        input_type: `"document"` for indexing (default), `"query"` for retrieval
            at question time — Voyage models are asymmetric and this matters.

    Returns list of embedding vectors in the same order as `texts`.
    """
    if not texts:
        return []
    out: list[list[float]] = []
    async with httpx.AsyncClient() as client:
        for i in range(0, len(texts), VOYAGE_BATCH_SIZE):
            batch = texts[i : i + VOYAGE_BATCH_SIZE]
            log.info(f"Embedding batch {i // VOYAGE_BATCH_SIZE + 1} ({len(batch)} chunks)")
            vectors = await _embed_batch(client, batch, input_type=input_type)
            out.extend(vectors)
    return out

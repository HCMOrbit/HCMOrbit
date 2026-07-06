"""Ask Orbit service — orchestrator glueing retrieval + generation together.

Public API:
    ask(question, history) -> dict  # matches the /api/ask response contract
"""
from __future__ import annotations

import logging

from services.ask_orbit.generator import (
    GenerationError, generate_answer, out_of_scope_answer,
)
from services.ask_orbit.retriever import retrieve

log = logging.getLogger(__name__)


def _build_sources(retrieved_chunks, sources_used_ref_ids: list[str]) -> list[dict]:
    """Map the reference_ids the model cited back to structured source cards.

    De-dupes by reference_id (a chunk-level list would repeat when the model
    grounded on multiple sections of the same article) — the widget renders
    one chip per article so this matches UX intent.
    """
    used = {r for r in sources_used_ref_ids if r}
    seen: set[str] = set()
    sources: list[dict] = []
    for c in retrieved_chunks:
        if c.reference_id not in used:
            continue
        # Prefer the FIRST occurrence of a reference_id (best-ranked chunk),
        # since retrieved_chunks is already sorted by score desc.
        if c.reference_id in seen:
            continue
        seen.add(c.reference_id)
        sources.append({
            "reference_id": c.reference_id,
            "doc_title": c.doc_title,
            "section_title": c.section_title,
        })
    # If the model cited a reference_id that wasn't in the retrieved set
    # (hallucinated citation), we silently drop it — spec says "cite what you
    # grounded on", so a citation without a chunk is not a valid source.
    return sources


async def ask(*, question: str, history: list[dict] | None = None) -> dict:
    """Run the full ask pipeline and return the /api/ask response body.

    Never raises — errors are surfaced through `answer` and are logged.
    """
    retrieval = await retrieve(question)

    if retrieval.error:
        # Retrieval infra broken (Voyage down, Atlas index missing, etc.) —
        # give the user a clean message and put diagnostics in the log.
        log.error("retrieval failed: %s", retrieval.error)
        return {
            "answer": (
                "I couldn't reach the KB search index right now. Try again in "
                "a moment, or post your question in the community."
            ),
            "tenant_check": None,
            "sources": [],
            "in_scope": False,
        }

    if not retrieval.in_scope:
        # Scope gate: refuse to answer from general knowledge.
        ooc = out_of_scope_answer()
        return {
            "answer": ooc.answer,
            "tenant_check": None,
            "sources": [],
            "in_scope": False,
        }

    try:
        gen = await generate_answer(
            question=question,
            chunks=retrieval.chunks,
            history=history or [],
        )
    except GenerationError as e:
        log.exception("Anthropic generation failed")
        return {
            "answer": (
                "I found relevant KB content but hit an error generating the "
                "answer. Try again in a moment, or open the referenced article "
                "directly."
            ),
            "tenant_check": None,
            # Even on generation failure, we can surface which articles matched
            # so the user isn't left empty-handed.
            "sources": [{
                "reference_id": c.reference_id,
                "doc_title": c.doc_title,
                "section_title": c.section_title,
            } for c in retrieval.chunks[:3]],
            "in_scope": True,
            "_error": str(e),
        }

    tenant_check_dict = gen.tenant_check.as_dict() if gen.tenant_check else None
    sources = _build_sources(retrieval.chunks, gen.sources_used)
    # Fallback: if the model didn't emit any source citations (rare — the
    # prompt requires it), fall back to the top-3 retrieved chunks so the
    # widget always has something to render.
    if not sources:
        sources = [{
            "reference_id": c.reference_id,
            "doc_title": c.doc_title,
            "section_title": c.section_title,
        } for c in retrieval.chunks[:3]]

    return {
        "answer": gen.answer,
        "tenant_check": tenant_check_dict,
        "sources": sources,
        "in_scope": True,
    }

"""Tests for the Ask Orbit orchestrator.

We stub out the retriever and generator so these tests are pure unit tests —
no Atlas, no Voyage, no Anthropic keys required.
"""
from __future__ import annotations

import pytest

from services.ask_orbit import service as svc
from services.ask_orbit.generator import AskOrbitAnswer, GenerationError, TenantCheck
from services.ask_orbit.retriever import RetrievalResult, RetrievedChunk


def _chunk(ref_id: str, section_num: int, title: str, score: float, text: str = "body text") -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=f"{ref_id}#s{section_num:02d}",
        reference_id=ref_id,
        doc_title=f"Doc for {ref_id}",
        section_number=section_num,
        section_title=title,
        subsection=None,
        text=text,
        score=score,
    )


class TestOutOfScopeGate:
    """Top score below threshold → refuse, in_scope=false, no sources."""

    @pytest.mark.asyncio
    async def test_low_score_refuses_without_calling_claude(self, monkeypatch):
        async def fake_retrieve(q):
            return RetrievalResult(chunks=[_chunk("KB-1", 1, "Foo", 0.35)], top_score=0.35, in_scope=False)

        # Sentinel: generator MUST NOT be called when out of scope.
        async def boom(**kw):
            raise AssertionError("generator called on out-of-scope question")

        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        monkeypatch.setattr(svc, "generate_answer", boom)
        r = await svc.ask(question="off-topic thing?")
        assert r["in_scope"] is False
        assert r["sources"] == []
        assert r["tenant_check"] is None
        assert "community" in r["answer"].lower()

    @pytest.mark.asyncio
    async def test_no_chunks_at_all_treated_as_out_of_scope(self, monkeypatch):
        async def fake_retrieve(q):
            return RetrievalResult(chunks=[], top_score=0.0, in_scope=False)
        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        r = await svc.ask(question="anything")
        assert r["in_scope"] is False
        assert r["sources"] == []


class TestHappyPath:
    """In-scope retrieval + successful generation → full answer + sources."""

    @pytest.mark.asyncio
    async def test_answer_and_sources_populated(self, monkeypatch):
        chunks = [
            _chunk("KB-1", 4, "Configuration Guidance", 0.82),
            _chunk("KB-2", 8, "Failure Patterns", 0.71),
            _chunk("KB-1", 11, "Common Workday Reports", 0.68),
        ]

        async def fake_retrieve(q):
            return RetrievalResult(chunks=chunks, top_score=0.82, in_scope=True)

        async def fake_generate(*, question, chunks, history):
            return AskOrbitAnswer(
                answer="Direct answer here.",
                tenant_check=None,
                sources_used=["KB-1", "KB-2"],
                raw_model_response="",
            )

        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        monkeypatch.setattr(svc, "generate_answer", fake_generate)
        r = await svc.ask(question="how do I fix X?")
        assert r["in_scope"] is True
        assert r["answer"] == "Direct answer here."
        # Sources include exactly the ref_ids the model cited, de-duped
        assert [s["reference_id"] for s in r["sources"]] == ["KB-1", "KB-2"]
        # First appearance of a ref_id wins (best-ranked chunk)
        assert r["sources"][0]["section_title"] == "Configuration Guidance"

    @pytest.mark.asyncio
    async def test_tenant_check_populates_when_model_returns_it(self, monkeypatch):
        chunks = [_chunk("KB-1", 9, "Common Workday Reports", 0.82)]

        async def fake_retrieve(q):
            return RetrievalResult(chunks=chunks, top_score=0.82, in_scope=True)

        async def fake_generate(**kw):
            return AskOrbitAnswer(
                answer="Check View Security Groups.",
                tenant_check=TenantCheck(
                    report="View Security Groups Assigned to User",
                    filter="target user + user-based groups",
                    healthy="only the expected groups are listed",
                ),
                sources_used=["KB-1"],
            )

        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        monkeypatch.setattr(svc, "generate_answer", fake_generate)
        r = await svc.ask(question="how do I check security assignments?")
        tc = r["tenant_check"]
        assert tc is not None
        assert tc["report"].startswith("View Security Groups")
        assert tc["filter"] and tc["healthy"]

    @pytest.mark.asyncio
    async def test_model_citing_unknown_ref_id_is_dropped_silently(self, monkeypatch):
        chunks = [_chunk("KB-1", 4, "Foo", 0.82)]

        async def fake_retrieve(q):
            return RetrievalResult(chunks=chunks, top_score=0.82, in_scope=True)

        async def fake_generate(**kw):
            return AskOrbitAnswer(
                answer="ok",
                tenant_check=None,
                sources_used=["KB-1", "KB-HALLUCINATED"],
            )

        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        monkeypatch.setattr(svc, "generate_answer", fake_generate)
        r = await svc.ask(question="q")
        assert [s["reference_id"] for s in r["sources"]] == ["KB-1"]

    @pytest.mark.asyncio
    async def test_no_model_citations_falls_back_to_top_retrieved(self, monkeypatch):
        chunks = [_chunk("KB-1", 4, "Foo", 0.82), _chunk("KB-2", 4, "Bar", 0.75)]

        async def fake_retrieve(q):
            return RetrievalResult(chunks=chunks, top_score=0.82, in_scope=True)

        async def fake_generate(**kw):
            return AskOrbitAnswer(answer="ok", tenant_check=None, sources_used=[])

        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        monkeypatch.setattr(svc, "generate_answer", fake_generate)
        r = await svc.ask(question="q")
        # Fallback path — top-3 retrieved chunks surfaced as sources
        assert [s["reference_id"] for s in r["sources"]] == ["KB-1", "KB-2"]


class TestErrorPaths:
    @pytest.mark.asyncio
    async def test_retrieval_error_returns_graceful_message(self, monkeypatch):
        async def fake_retrieve(q):
            return RetrievalResult(chunks=[], top_score=0.0, in_scope=False,
                                   error="vector search failed: OperationFailure: index missing")

        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        r = await svc.ask(question="anything")
        assert r["in_scope"] is False
        assert "search index" in r["answer"].lower() or "community" in r["answer"].lower()

    @pytest.mark.asyncio
    async def test_generation_error_still_returns_retrieved_sources(self, monkeypatch):
        chunks = [_chunk("KB-1", 4, "Foo", 0.82), _chunk("KB-2", 4, "Bar", 0.75)]

        async def fake_retrieve(q):
            return RetrievalResult(chunks=chunks, top_score=0.82, in_scope=True)

        async def failing_generate(**kw):
            raise GenerationError("Anthropic HTTP 429: rate limit")

        monkeypatch.setattr(svc, "retrieve", fake_retrieve)
        monkeypatch.setattr(svc, "generate_answer", failing_generate)
        r = await svc.ask(question="q")
        # in_scope stays true — user still gets the source chips even if
        # the model call failed
        assert r["in_scope"] is True
        assert len(r["sources"]) >= 1
        assert "_error" in r

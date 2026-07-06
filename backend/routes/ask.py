"""POST /api/ask — Ask Orbit retrieval + generation endpoint.

Public — no auth (per spec: "Do not gate it yet. Every user can open it —
we test answer quality before adding any paywall").

Contract (locked with product owner, Feb 2026):
    {
      "answer": str,
      "tenant_check": {"report": str, "filter": str, "healthy": str} | null,
      "sources": [{"reference_id": str, "doc_title": str, "section_title": str}],
      "in_scope": bool
    }
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from services.ask_orbit.service import ask as ask_service

router = APIRouter()


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=20)


@router.post("/ask")
async def ask(body: AskRequest):
    """Ask Orbit — grounded Workday assistant.

    Retrieves top KB chunks from Atlas Vector Search, then generates a tight
    practitioner answer with Claude constrained to the retrieved context.
    Refuses gracefully if nothing in the KB clears the relevance threshold.
    """
    try:
        result = await ask_service(
            question=body.question.strip(),
            history=[h.model_dump() for h in body.history],
        )
    except Exception as e:  # noqa: BLE001 — the service catches its own errors;
        # this handles truly unexpected bugs (import errors etc.)
        raise HTTPException(500, f"ask pipeline crashed: {type(e).__name__}: {e}")
    return result

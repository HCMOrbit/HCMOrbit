"""Anthropic Claude client for Ask Orbit.

Direct REST via httpx — no `anthropic` SDK, no `emergentintegrations`,
no `litellm` (CI guard). Model ID is env-driven so you can move between
Claude Sonnet 4.5 / 4.6 without a code change.

Public API:
    generate_answer(question, chunks, history) -> AskOrbitAnswer

The system prompt is the VERBATIM Ask Orbit grounded prompt from the spec.
Do not edit it in this file — treat it as a locked constant.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

import httpx

from services.ask_orbit.retriever import RetrievedChunk

log = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
ANTHROPIC_MAX_TOKENS = int(os.environ.get("ANTHROPIC_MAX_TOKENS", "1024"))
ANTHROPIC_API_VERSION = "2023-06-01"

# LOCKED — the Ask Orbit grounded system prompt from the /api/ask spec.
# Do not add word-count minimums, version-flagging, or menu-path guidance.
# Any relaxation of this prompt must land as a spec change, not a code tweak.
ASK_ORBIT_SYSTEM_PROMPT = (
    "You are Ask Orbit, a Workday assistant for experienced practitioners "
    "(assume 2+ years). Answer ONLY from the KB context provided in this "
    "request. If the context does not cover the question, say so plainly "
    "and route the user to the community — never answer from general "
    "knowledge, never guess.\n\n"
    "Scope: Answer only the user's current question. Do not restate, "
    "revisit, or attempt to answer any earlier question — even if prior "
    "turns appear in this conversation, they are context, not tasks.\n\n"
    "Partial-coverage rule: If the retrieved context covers a related "
    "aspect of the topic (a neighboring workflow, an upstream/downstream "
    "concern, a specific sub-case of the question), state what you CAN "
    "address from it and offer that content first, then briefly note "
    "what falls outside your coverage. A refusal that cites three "
    "relevant articles should offer their content, not decline the "
    "topic. Only issue a flat refusal when the retrieved context is "
    "genuinely off-topic.\n\n"
    "Voice: a Workday architect who has fixed broken production tenants, "
    "talking to a peer. Lead with the direct answer, then the root cause. "
    "Be tight and specific — a few sentences, not an essay. There is no "
    "minimum length; brevity is correct.\n\n"
    "Hard rules: Use task-based references (\"Related Task: Create "
    "Company\"), never absolute menu paths. Never make version-specific "
    "claims (\"as of 2024R2…\"); if something is release-dependent, say "
    "\"verify in your release notes.\" Name only the Workday reports, "
    "tasks, security groups, and domains that appear in the provided "
    "context — never invent them. When the context contains a report plus "
    "a fail condition, surface it as a concrete \"check your tenant\" "
    "step. Cite the reference_id of every KB chunk you used. If you are "
    "unsure, say so — confident wrongness is the one thing you must never "
    "do.\n\n"
    # Response-shape rider — kept separate from the prompt body so a future
    # spec change to the shape doesn't require editing the locked voice
    # paragraphs above.
    "RESPONSE FORMAT — you MUST return a single JSON object matching this "
    "schema exactly, and nothing else (no prose before or after):\n"
    "{\n"
    "  \"answer\": string,                     // the tight practitioner answer\n"
    "  \"tenant_check\": {                     // populate ONLY if the retrieved chunks include a Workday report AND a concrete fail condition; otherwise null\n"
    "    \"report\": string,                   // e.g. \"View Security Groups Assigned to User\"\n"
    "    \"filter\": string,                   // e.g. \"filter by target user + user-based security groups\"\n"
    "    \"healthy\": string                   // what a healthy result looks like\n"
    "  } | null,\n"
    "  \"sources_used\": [string]              // list of reference_id values you actually grounded on\n"
    "}\n"
)

OUT_OF_SCOPE_ANSWER = (
    "This isn't covered in the HCMOrbit knowledge base yet. I only answer "
    "from indexed KB articles, and none of them cleanly match your question. "
    "Post it in the community — a practitioner who's hit this before can "
    "usually point you at the right report or task."
)


class GenerationError(RuntimeError):
    """Raised when Anthropic returns a non-2xx or an unparseable response."""


@dataclass
class TenantCheck:
    report: str
    filter: str
    healthy: str

    def as_dict(self) -> dict:
        return self.__dict__


@dataclass
class AskOrbitAnswer:
    answer: str
    tenant_check: Optional[TenantCheck]
    sources_used: list[str]  # reference_ids the model grounded on
    raw_model_response: str = ""  # kept for diagnostics; not returned to client
    errors: list[str] = field(default_factory=list)


def _api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise GenerationError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env (local) or "
            "Railway env (deployed) before calling /api/ask."
        )
    return key


def _format_context(chunks: list[RetrievedChunk]) -> str:
    """Render retrieved chunks as a numbered, cite-friendly block for the model."""
    if not chunks:
        return "(no context available)"
    parts = []
    for i, c in enumerate(chunks, start=1):
        header = f"[#{i}] reference_id={c.reference_id} | doc={c.doc_title!r} | section={c.section_number}. {c.section_title}"
        if c.subsection:
            header += f" | subsection={c.subsection!r}"
        parts.append(f"{header}\n{c.text}")
    return "\n\n---\n\n".join(parts)


def _build_user_message(question: str, chunks: list[RetrievedChunk]) -> str:
    return (
        f"KB CONTEXT (the ONLY source you are allowed to use):\n\n"
        f"{_format_context(chunks)}\n\n"
        f"---\n\n"
        f"USER QUESTION: {question}\n\n"
        f"Respond with the JSON object described in the system instructions."
    )


def _parse_model_output(raw: str) -> AskOrbitAnswer:
    """Extract the JSON contract from Claude's response.

    Anthropic occasionally wraps JSON in a code fence. Be forgiving.
    """
    text = (raw or "").strip()
    if text.startswith("```"):
        # Strip a leading ```json fence and trailing ```
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise GenerationError(f"model returned non-JSON output: {e} | raw={text[:400]!r}") from e

    tc = data.get("tenant_check")
    tenant_check = None
    if isinstance(tc, dict) and tc.get("report"):
        tenant_check = TenantCheck(
            report=str(tc.get("report", "")).strip(),
            filter=str(tc.get("filter", "")).strip(),
            healthy=str(tc.get("healthy", "")).strip(),
        )

    return AskOrbitAnswer(
        answer=str(data.get("answer", "")).strip(),
        tenant_check=tenant_check,
        sources_used=[str(x) for x in (data.get("sources_used") or [])],
        raw_model_response=raw,
    )


async def generate_answer(
    *,
    question: str,
    chunks: list[RetrievedChunk],
    history: Optional[list[dict]] = None,
) -> AskOrbitAnswer:
    """Call Claude with the grounded system prompt and return the parsed answer."""
    messages: list[dict] = []
    for h in (history or []):
        role = h.get("role")
        content = h.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": _build_user_message(question, chunks)})

    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": ANTHROPIC_MAX_TOKENS,
        "system": ASK_ORBIT_SYSTEM_PROMPT,
        "messages": messages,
    }
    headers = {
        "x-api-key": _api_key(),
        "anthropic-version": ANTHROPIC_API_VERSION,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)
    if resp.status_code != 200:
        raise GenerationError(
            f"Anthropic HTTP {resp.status_code}: {resp.text[:400]}"
        )
    data = resp.json()
    # Anthropic Messages API returns content as a list of content blocks.
    text = "".join(
        block.get("text", "")
        for block in (data.get("content") or [])
        if block.get("type") == "text"
    )
    if not text:
        raise GenerationError(f"Anthropic returned no text content: {data}")
    return _parse_model_output(text)


def out_of_scope_answer() -> AskOrbitAnswer:
    """Canned response for the scope-gate path (retrieval below threshold)."""
    return AskOrbitAnswer(
        answer=OUT_OF_SCOPE_ANSWER,
        tenant_check=None,
        sources_used=[],
        raw_model_response="",
    )

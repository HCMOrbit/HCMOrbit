"""Anthropic client for Docwright.

Reuses the same direct-httpx pattern as `services/ask_orbit/generator.py`
(no SDKs, no litellm, no emergentintegrations — CI guard). Produces a
sectioned JSON document from the consultant's raw notes.

Public API:
    generate_document(...) -> dict          # section_key -> markdown content
    regenerate_section(...) -> str          # markdown content for one section
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import httpx

log = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = os.environ.get("DOCWRIGHT_MODEL", os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"))
ANTHROPIC_MAX_TOKENS = int(os.environ.get("DOCWRIGHT_MAX_TOKENS", "6000"))
ANTHROPIC_API_VERSION = "2023-06-01"

# Section keys are the contract with the frontend. Order matters — the UI
# renders them in this order both in the preview sidebar and in downloads.
SECTION_KEYS: list[tuple[str, str]] = [
    ("document_control",        "Document Control"),
    ("purpose_scope",           "Purpose & Scope"),
    ("business_requirements",   "Business Requirements Addressed"),
    ("design_decisions",        "Design Decisions"),
    ("configuration_detail",    "Configuration Detail"),
    ("assumptions_dependencies","Assumptions & Dependencies"),
    ("open_items",              "Open Items / Parking Lot"),
    ("testing_considerations",  "Testing Considerations"),
    ("approvals",               "Approvals"),
]
SECTION_KEY_TO_LABEL = dict(SECTION_KEYS)
SECTION_ORDER = [k for k, _ in SECTION_KEYS]

MODULE_SPECIFIC_HINT = {
    "Security": "For Configuration Detail: sub-headings for Security Groups, Domain Security Policies, Business Process Security Policies.",
    "Integrations": "For Configuration Detail: sub-headings for Integration System, Field Mapping (as a markdown table), Schedule, Error Handling.",
    "Payroll": "For Configuration Detail: sub-headings for Pay Groups, Earnings, Deductions, Pay Component Groups, Tax Setup, Costing.",
    "Absence": "For Configuration Detail: sub-headings for Time Off Plans, Accrual Rules, Eligibility, Absence Business Process.",
    "Time Tracking": "For Configuration Detail: sub-headings for Time Entry Templates, Calculations, Time Off Types, Time Clock Setup.",
    "Benefits": "For Configuration Detail: sub-headings for Benefit Plans, Eligibility Rules, Open Enrollment, Cost Calculations.",
    "Core HCM": "For Configuration Detail: sub-headings for Supervisory Organizations, Positions, Job Profiles, Compensation Grades.",
    "Recruiting": "For Configuration Detail: sub-headings for Job Requisitions, Recruiting Stages, Candidate Pools, Offer Templates.",
    "Talent": "For Configuration Detail: sub-headings for Performance Templates, Review Cycles, Goal Setting, Talent Reviews.",
    "Reporting": "For Configuration Detail: sub-headings for Custom Report, Data Source, Fields, Filters, Business Object, Delivery.",
    "Financials": "For Configuration Detail: sub-headings for Company Setup, Journal Sources, Ledger Accounts, Cost Centers, Custom Worktags.",
}

DOCWRIGHT_SYSTEM_PROMPT = (
    "You are a senior Workday solution architect producing a formal configuration "
    "design document for a client engagement.\n\n"
    "HARD RULES — non-negotiable:\n"
    "• Never invent Workday task names, report names, security domains, business "
    "process definitions, integration names, or configuration values that are not "
    "present in the notes provided by the consultant.\n"
    "• Where a required detail is missing, insert an inline placeholder of the "
    "form `**OPEN ITEM:** <what is missing>` — do NOT fabricate a plausible-looking "
    "value.\n"
    "• Preserve every decision, value, constraint, name, date, and identifier "
    "found in the consultant notes. Do not paraphrase them away.\n"
    "• Write in third person, past tense for decisions already made, present "
    "tense for standing configurations. Formal client-facing register — no "
    "chatty language, no marketing language, no first person.\n"
    "• Design Decisions and Open Items MUST be rendered as GitHub-flavoured "
    "markdown tables with the exact column headers specified in the section "
    "instructions.\n"
    "• Every section must have substance from the notes — an empty section is "
    "acceptable only if the notes contain nothing relevant, in which case the "
    "section body is exactly `**OPEN ITEM:** <what is missing>`.\n\n"
    "OUTPUT CONTRACT — you MUST return a single JSON object matching this schema "
    "exactly, and nothing else (no prose before or after, no code fence):\n"
    "{\n"
    "  \"document_control\":         string (markdown),\n"
    "  \"purpose_scope\":            string (markdown),\n"
    "  \"business_requirements\":    string (markdown),\n"
    "  \"design_decisions\":         string (markdown table: ID | Decision | Rationale | Decided By | Date),\n"
    "  \"configuration_detail\":     string (markdown, module-appropriate sub-headings),\n"
    "  \"assumptions_dependencies\": string (markdown),\n"
    "  \"open_items\":               string (markdown table: ID | Item | Owner | Target Date),\n"
    "  \"testing_considerations\":   string (markdown),\n"
    "  \"approvals\":                string (markdown table: Name | Role | Signature | Date)\n"
    "}\n"
)


class GenerationError(RuntimeError):
    """Raised when Anthropic returns a non-2xx or an unparseable response."""


def _api_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise GenerationError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env (local) or "
            "the Railway environment (deployed) before calling /api/docwright/generate."
        )
    return key


def _build_context_block(*, client_name: str, module: str, doc_type: str, phase: str,
                          author_name: str, raw_notes: str) -> str:
    """Assemble the user message that carries all inputs for the model."""
    module_hint = MODULE_SPECIFIC_HINT.get(module, "")
    return (
        f"DOCUMENT METADATA\n"
        f"• Client name: {client_name}\n"
        f"• Workday module: {module}\n"
        f"• Document type: {doc_type}\n"
        f"• Project phase: {phase}\n"
        f"• Author (consultant): {author_name}\n\n"
        f"MODULE-SPECIFIC GUIDANCE\n{module_hint or '(none)'}\n\n"
        f"CONSULTANT NOTES (the ONLY factual source you may use):\n"
        f"---\n{raw_notes}\n---\n\n"
        f"Produce the sectioned JSON per the system schema. Every section is "
        f"required. Use OPEN ITEM: placeholders wherever the notes do not "
        f"provide the detail."
    )


def _strip_code_fence(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        # Drop first fence line and trailing fence
        t = t.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    return t


async def _post_anthropic(messages: list[dict], *, max_tokens: int) -> str:
    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "system": DOCWRIGHT_SYSTEM_PROMPT,
        "messages": messages,
    }
    headers = {
        "x-api-key": _api_key(),
        "anthropic-version": ANTHROPIC_API_VERSION,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(ANTHROPIC_API_URL, json=payload, headers=headers)
    if resp.status_code != 200:
        raise GenerationError(f"Anthropic HTTP {resp.status_code}: {resp.text[:500]}")
    data = resp.json()
    text = "".join(
        block.get("text", "")
        for block in (data.get("content") or [])
        if block.get("type") == "text"
    )
    if not text:
        raise GenerationError(f"Anthropic returned no text content: {data}")
    return text


async def generate_document(
    *,
    client_name: str,
    module: str,
    doc_type: str,
    phase: str,
    author_name: str,
    raw_notes: str,
) -> dict:
    """Return dict of section_key -> markdown content.

    Guarantees every SECTION_KEYS key is present; missing keys are filled with
    an OPEN ITEM placeholder so the UI never renders a blank section.
    """
    user_message = _build_context_block(
        client_name=client_name, module=module, doc_type=doc_type,
        phase=phase, author_name=author_name, raw_notes=raw_notes,
    )
    raw = await _post_anthropic(
        [{"role": "user", "content": user_message}],
        max_tokens=ANTHROPIC_MAX_TOKENS,
    )
    text = _strip_code_fence(raw)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise GenerationError(f"model returned non-JSON: {e} | tail={text[-400:]!r}") from e
    if not isinstance(data, dict):
        raise GenerationError(f"model returned non-object JSON: {type(data).__name__}")
    out: dict = {}
    for key in SECTION_ORDER:
        v = data.get(key)
        if isinstance(v, str) and v.strip():
            out[key] = v.strip()
        else:
            out[key] = f"**OPEN ITEM:** {SECTION_KEY_TO_LABEL[key]} — no content provided."
    return out


async def regenerate_section(
    *,
    section_key: str,
    section_label: str,
    client_name: str,
    module: str,
    doc_type: str,
    phase: str,
    author_name: str,
    raw_notes: str,
    existing_sections: Optional[dict] = None,
) -> str:
    """Regenerate a single section only, returning its markdown."""
    if section_key not in SECTION_KEY_TO_LABEL:
        raise GenerationError(f"unknown section_key: {section_key}")
    context_block = _build_context_block(
        client_name=client_name, module=module, doc_type=doc_type,
        phase=phase, author_name=author_name, raw_notes=raw_notes,
    )
    other_sections = ""
    if existing_sections:
        others = [f"### {SECTION_KEY_TO_LABEL.get(k,k)}\n{v}"
                  for k, v in existing_sections.items() if k != section_key and v]
        if others:
            other_sections = "\n\nEXISTING OTHER SECTIONS (for reference — do NOT include in output):\n" + "\n\n".join(others[:4])
    user_message = (
        f"{context_block}{other_sections}\n\n"
        f"REGENERATE ONLY THIS SECTION: {section_label} ({section_key}).\n"
        f"Return a single JSON object with one key: {{\"{section_key}\": \"<markdown>\"}}. "
        f"Nothing else. All the hard rules from the system prompt still apply."
    )
    raw = await _post_anthropic(
        [{"role": "user", "content": user_message}],
        max_tokens=min(ANTHROPIC_MAX_TOKENS, 2500),
    )
    text = _strip_code_fence(raw)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise GenerationError(f"model returned non-JSON: {e} | tail={text[-400:]!r}") from e
    v = data.get(section_key) if isinstance(data, dict) else None
    if not isinstance(v, str) or not v.strip():
        raise GenerationError(f"regenerated section '{section_key}' was empty or wrong shape")
    return v.strip()

"""Docwright — API routes.

All endpoints require authentication (existing `get_current_user` dep).
Signed-out users can see the /docwright landing form on the frontend, but
the `Generate document` button triggers the shared AuthPrompt component;
this router never returns 200 to an anonymous request.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core import db
from dependencies import get_current_user
from services.docwright.file_parser import FileParseError, parse_upload
from services.docwright.generator import (
    SECTION_KEY_TO_LABEL, GenerationError,
    generate_document, regenerate_section,
)
from services.docwright.renderer import render_docx, render_pdf

log = logging.getLogger(__name__)
router = APIRouter()

# ── constants shared with frontend ──────────────────────────────────────────
MODULES: list[str] = [
    "Core HCM", "Payroll", "Absence", "Time Tracking", "Benefits",
    "Recruiting", "Talent", "Security", "Integrations", "Reporting", "Financials",
]
DOC_TYPES: list[str] = [
    "Configuration Design Document", "Design Decision Log",
    "Tenant Configuration Summary",
]
PHASES: list[str] = ["Architect", "Configure & Prototype", "Test", "Deploy"]

MAX_NOTES_LEN = 60_000  # ~15k words — plenty for one design doc


# ── models ─────────────────────────────────────────────────────────────────
class GenerateIn(BaseModel):
    client_name: str = Field(..., min_length=1, max_length=200)
    module: Literal[
        "Core HCM", "Payroll", "Absence", "Time Tracking", "Benefits",
        "Recruiting", "Talent", "Security", "Integrations", "Reporting", "Financials",
    ]
    doc_type: Literal[
        "Configuration Design Document", "Design Decision Log",
        "Tenant Configuration Summary",
    ]
    phase: Literal["Architect", "Configure & Prototype", "Test", "Deploy"]
    raw_notes: str = Field(..., min_length=1, max_length=MAX_NOTES_LEN)


class UpdateSectionsIn(BaseModel):
    generated_sections: dict


class RegenerateSectionIn(BaseModel):
    section_key: str = Field(..., min_length=1)


class DocumentOut(BaseModel):
    id: str
    client_name: str
    module: str
    doc_type: str
    phase: str
    raw_notes: str
    generated_sections: dict
    created_at: str
    updated_at: str


# ── helpers ────────────────────────────────────────────────────────────────

_UNSAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(*, client: str, doc_type: str, ext: str) -> str:
    stem = f"{client}-{doc_type}"
    stem = _UNSAFE_FILENAME_RE.sub("_", stem).strip("_")
    return f"{(stem or 'docwright')[:80]}.{ext}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_out(doc: dict) -> dict:
    """Map a Mongo doc → the flat DocumentOut shape (no `_id`)."""
    return {
        "id": doc["id"],
        "client_name": doc.get("client_name", ""),
        "module": doc.get("module", ""),
        "doc_type": doc.get("doc_type", ""),
        "phase": doc.get("phase", ""),
        "raw_notes": doc.get("raw_notes", ""),
        "generated_sections": doc.get("generated_sections", {}),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


async def _load_owned(doc_id: str, user_id: str) -> dict:
    doc = await db.docwright_documents.find_one({"id": doc_id, "user_id": user_id})
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


# ── routes ─────────────────────────────────────────────────────────────────
@router.get("/docwright/config")
async def docwright_config():
    """Public — the dropdown option lists for the landing form."""
    return {"modules": MODULES, "doc_types": DOC_TYPES, "phases": PHASES}


@router.post("/docwright/parse-file")
async def docwright_parse_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Extract plain text from an uploaded .docx / .txt / .md."""
    blob = await file.read()
    try:
        text = parse_upload(file.filename or "", blob)
    except FileParseError as e:
        raise HTTPException(400, str(e))
    return {"text": text, "filename": file.filename, "bytes": len(blob)}


@router.post("/docwright/generate", response_model=DocumentOut)
async def docwright_generate(body: GenerateIn, user: dict = Depends(get_current_user)):
    """Call Anthropic to produce the sectioned doc, persist, return."""
    author_name = user.get("full_name") or user.get("username") or "HCMOrbit Consultant"
    try:
        sections = await generate_document(
            client_name=body.client_name.strip(),
            module=body.module,
            doc_type=body.doc_type,
            phase=body.phase,
            author_name=author_name,
            raw_notes=body.raw_notes.strip(),
        )
    except GenerationError as e:
        log.exception("docwright generation failed")
        raise HTTPException(502, f"Generation failed: {e}")

    now = _now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "client_name": body.client_name.strip(),
        "module": body.module,
        "doc_type": body.doc_type,
        "phase": body.phase,
        "raw_notes": body.raw_notes.strip(),
        "generated_sections": sections,
        "created_at": now,
        "updated_at": now,
    }
    await db.docwright_documents.insert_one(doc)
    return _doc_out(doc)


@router.get("/docwright/documents")
async def docwright_list_documents(user: dict = Depends(get_current_user)):
    """List the caller's documents, newest first."""
    cur = db.docwright_documents.find(
        {"user_id": user["user_id"]},
        # Never leak raw notes in the list view — result page fetches them individually.
        {"_id": 0, "id": 1, "client_name": 1, "module": 1, "doc_type": 1,
         "phase": 1, "created_at": 1, "updated_at": 1},
    ).sort("created_at", -1).limit(200)
    docs = await cur.to_list(200)
    return {"documents": docs}


@router.get("/docwright/documents/{doc_id}", response_model=DocumentOut)
async def docwright_get_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await _load_owned(doc_id, user["user_id"])
    return _doc_out(doc)


@router.patch("/docwright/documents/{doc_id}", response_model=DocumentOut)
async def docwright_update_document(
    doc_id: str, body: UpdateSectionsIn, user: dict = Depends(get_current_user),
):
    """Persist inline edits from the result page."""
    doc = await _load_owned(doc_id, user["user_id"])
    if not isinstance(body.generated_sections, dict):
        raise HTTPException(400, "generated_sections must be an object")
    # Only accept keys we know about — extras would silently persist forever.
    cleaned = {
        k: str(v) for k, v in body.generated_sections.items()
        if k in SECTION_KEY_TO_LABEL and isinstance(v, str)
    }
    if not cleaned:
        raise HTTPException(400, "no valid sections in payload")
    now = _now_iso()
    await db.docwright_documents.update_one(
        {"id": doc_id, "user_id": user["user_id"]},
        {"$set": {"generated_sections": {**doc.get("generated_sections", {}), **cleaned},
                  "updated_at": now}},
    )
    doc = await _load_owned(doc_id, user["user_id"])
    return _doc_out(doc)


@router.post("/docwright/documents/{doc_id}/regenerate-section", response_model=DocumentOut)
async def docwright_regenerate_section(
    doc_id: str, body: RegenerateSectionIn, user: dict = Depends(get_current_user),
):
    doc = await _load_owned(doc_id, user["user_id"])
    section_key = body.section_key
    label = SECTION_KEY_TO_LABEL.get(section_key)
    if not label:
        raise HTTPException(400, f"unknown section_key: {section_key}")
    author_name = user.get("full_name") or user.get("username") or "HCMOrbit Consultant"
    try:
        new_md = await regenerate_section(
            section_key=section_key,
            section_label=label,
            client_name=doc["client_name"],
            module=doc["module"],
            doc_type=doc["doc_type"],
            phase=doc["phase"],
            author_name=author_name,
            raw_notes=doc["raw_notes"],
            existing_sections=doc.get("generated_sections", {}),
        )
    except GenerationError as e:
        log.exception("regenerate section failed")
        raise HTTPException(502, f"Regeneration failed: {e}")
    now = _now_iso()
    await db.docwright_documents.update_one(
        {"id": doc_id, "user_id": user["user_id"]},
        {"$set": {f"generated_sections.{section_key}": new_md, "updated_at": now}},
    )
    doc = await _load_owned(doc_id, user["user_id"])
    return _doc_out(doc)


@router.delete("/docwright/documents/{doc_id}")
async def docwright_delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    result = await db.docwright_documents.delete_one({"id": doc_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "Document not found")
    return {"deleted": True}


def _meta_of(doc: dict) -> dict:
    return {
        "client_name": doc.get("client_name", ""),
        "module": doc.get("module", ""),
        "doc_type": doc.get("doc_type", ""),
        "phase": doc.get("phase", ""),
    }


@router.get("/docwright/documents/{doc_id}/download.docx")
async def docwright_download_docx(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await _load_owned(doc_id, user["user_id"])
    blob = render_docx(meta=_meta_of(doc), sections=doc.get("generated_sections", {}))
    filename = _safe_filename(client=doc["client_name"], doc_type=doc["doc_type"], ext="docx")
    return Response(
        content=blob,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/docwright/documents/{doc_id}/download.pdf")
async def docwright_download_pdf(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await _load_owned(doc_id, user["user_id"])
    blob = render_pdf(meta=_meta_of(doc), sections=doc.get("generated_sections", {}))
    filename = _safe_filename(client=doc["client_name"], doc_type=doc["doc_type"], ext="pdf")
    return Response(
        content=blob,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

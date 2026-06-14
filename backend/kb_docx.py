"""Parse uploaded .docx Knowledge Base articles.

Convention (per HCMOrbit KB upload spec):
- The first table in the document carries the 11-row metadata block:
    Document ID, Title, Module, Sub-Module, Artifact Type, Difficulty,
    Estimated Read Time, Tags, Category, Author, Platform
- Every body element AFTER that first table is the article body and is
  converted to Markdown.

Returns a dict ready for the review screen — nothing is persisted here.
"""
from __future__ import annotations

import io
import re
from typing import Optional

from docx import Document
from docx.oxml.ns import qn


# --- canonical maps used to flag unknown values ----------------------------

# Module label -> existing category slug
KNOWN_MODULE_TO_CATEGORY = {
    "core hcm": "core-hcm",
    "integrations": "integrations",
    "security & roles": "security-roles",
    "security and roles": "security-roles",
    "security": "security-roles",
    "reporting & analytics": "reporting-analytics",
    "reporting and analytics": "reporting-analytics",
    "reporting": "reporting-analytics",
}

# Category-cell label -> existing doc_type enum
KNOWN_CATEGORY_TO_TYPE = {
    "fix guide": "fix_guide",
    "fix": "fix_guide",
    "how-to": "how_to",
    "how to": "how_to",
    "learning bite": "learning_bite",
    "reference": "reference",
    "checklist": "checklist",
}

DIFFICULTY_MAP = {
    "beginner": "beginner",
    "intermediate": "intermediate",
    "advanced": "advanced",
    "expert": "advanced",
}


# --- helpers ---------------------------------------------------------------

def _runs_to_markdown(paragraph) -> str:
    """Walk the runs of a paragraph and inline-format bold/italic/code."""
    out = []
    for run in paragraph.runs:
        text = run.text or ""
        if not text:
            continue
        # Escape markdown specials minimally — most KB content is plain prose
        text = text.replace("\\", "\\\\")
        bold = bool(run.bold)
        italic = bool(run.italic)
        if bold and italic:
            out.append(f"***{text}***")
        elif bold:
            out.append(f"**{text}**")
        elif italic:
            out.append(f"*{text}*")
        else:
            out.append(text)
    return "".join(out)


def _paragraph_to_markdown(paragraph) -> str:
    style = (paragraph.style.name or "").strip() if paragraph.style else ""
    text = _runs_to_markdown(paragraph).rstrip()
    if not text:
        return ""
    if style == "Title":
        return f"# {text}"
    if style == "Heading 1":
        return f"## {text}"
    if style == "Heading 2":
        return f"### {text}"
    if style == "Heading 3":
        return f"#### {text}"
    if style == "Heading 4":
        return f"##### {text}"
    if "List Bullet" in style or "List Paragraph" in style:
        return f"- {text}"
    if "List Number" in style:
        return f"1. {text}"
    if style == "Quote" or style == "Intense Quote":
        return f"> {text}"
    if "Code" in style:
        return f"`{text}`"
    return text


def _table_to_markdown(table) -> str:
    rows = []
    for r in table.rows:
        cells = [c.text.replace("\n", " ").strip() for c in r.cells]
        rows.append("| " + " | ".join(cells) + " |")
    if not rows:
        return ""
    header_sep = "| " + " | ".join(["---"] * len(table.rows[0].cells)) + " |"
    return "\n".join([rows[0], header_sep, *rows[1:]])


def _read_metadata_table(table) -> dict[str, str]:
    """First table is `label | value` rows. Returns case-normalised dict."""
    md: dict[str, str] = {}
    for row in table.rows:
        if len(row.cells) < 2:
            continue
        label = row.cells[0].text.strip()
        value = row.cells[1].text.strip()
        if label:
            md[label] = value
    return md


def _split_tags(raw: str) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[,;\n]", raw)
    return [p.strip().lower() for p in parts if p.strip()][:8]


def _normalise_difficulty(raw: str) -> str:
    if not raw:
        return "intermediate"
    key = raw.strip().lower()
    return DIFFICULTY_MAP.get(key, "intermediate")


def _normalise_read_time(raw: str) -> Optional[str]:
    if not raw:
        return None
    # Normalise the en-dash and the spelled-out "minutes" to a tighter form
    cleaned = raw.replace("—", "-").replace("–", "-").strip()
    cleaned = re.sub(r"\s+minutes?\b", " min", cleaned, flags=re.I)
    return cleaned or None


# --- main entry point ------------------------------------------------------

def parse_kb_docx(file_bytes: bytes) -> dict:
    doc = Document(io.BytesIO(file_bytes))
    if not doc.tables:
        raise ValueError("Document does not contain a metadata table at the top.")
    meta = _read_metadata_table(doc.tables[0])
    meta_table_el = doc.tables[0]._element

    # Walk top-level body elements after the metadata table
    body_lines: list[str] = []
    seen_meta = False
    for child in doc.element.body.iterchildren():
        if child is meta_table_el:
            seen_meta = True
            continue
        if not seen_meta:
            continue
        tag = child.tag.split("}")[-1]
        if tag == "p":
            # Wrap with python-docx Paragraph for style/runs access
            from docx.text.paragraph import Paragraph
            para = Paragraph(child, doc.tables[0]._parent if False else doc)  # noqa
            md_line = _paragraph_to_markdown(para)
            body_lines.append(md_line)
        elif tag == "tbl":
            from docx.table import Table
            tbl = Table(child, doc.tables[0]._parent if False else doc)  # noqa
            body_lines.append("")
            body_lines.append(_table_to_markdown(tbl))
            body_lines.append("")

    # Collapse 3+ blank lines into 2
    body_md = "\n".join(body_lines).strip()
    body_md = re.sub(r"\n{3,}", "\n\n", body_md)

    # --- field mapping ---
    module_raw = meta.get("Module", "")
    category_slug = KNOWN_MODULE_TO_CATEGORY.get(module_raw.strip().lower())
    category_flag = None
    if module_raw and not category_slug:
        category_flag = f"Module '{module_raw}' is not a recognised category — pick or create one."

    cat_raw = meta.get("Category", "")
    doc_type = KNOWN_CATEGORY_TO_TYPE.get(cat_raw.strip().lower())
    type_flag = None
    if cat_raw and not doc_type:
        type_flag = f"Artifact category '{cat_raw}' isn't a known doc type — pick the closest match."

    parsed = {
        "title": meta.get("Title", "").strip(),
        "summary": _build_default_summary(body_md),
        "body": body_md,
        "category_slug": category_slug or "",
        "category_label_raw": module_raw,
        "doc_type": doc_type or "reference",
        "doc_type_label_raw": cat_raw,
        "difficulty": _normalise_difficulty(meta.get("Difficulty", "")),
        "tags": _split_tags(meta.get("Tags", "")),
        "reference_id": meta.get("Document ID", "").strip() or None,
        "sub_module": meta.get("Sub-Module", "").strip() or None,
        "read_time": _normalise_read_time(meta.get("Estimated Read Time", "")),
        "platform": meta.get("Platform", "").strip() or "Workday",
        "author_raw": meta.get("Author", "").strip() or None,
        "artifact_type_raw": meta.get("Artifact Type", "").strip() or None,
        "target_groups": ["aspirant", "practitioner", "employer"],
        "flags": [f for f in (category_flag, type_flag) if f],
        "raw_metadata": meta,
    }
    return parsed


def _build_default_summary(body_md: str) -> str:
    """First non-heading paragraph, truncated to ~280 chars, as a default summary."""
    for line in body_md.splitlines():
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("-") or s.startswith(">"):
            continue
        # Strip simple inline markdown
        plain = re.sub(r"[*_`]", "", s)
        if len(plain) > 280:
            return plain[:277].rstrip() + "..."
        return plain
    return ""

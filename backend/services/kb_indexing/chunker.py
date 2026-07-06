"""Section-level chunker for HCMOrbit KB articles.

HCMOrbit articles follow a fixed 15-section structure with numbered H1 headings
(e.g. "1. Executive Summary", "8. Failure Patterns", "15. Related Articles").
The chunker splits on those numbered H1 boundaries so each chunk is one
coherent section — precise for citation, precise for retrieval.

Rules (locked with product owner, Feb 2026):
    1. Split on `^\\s*(#\\s*)?\\d+\\.\\s+` — the leading number, NOT the title text.
    2. Sub-split long sections on H2 boundaries (e.g. `## 4.1 …`, `## Failure 1: …`)
       so a single failure scenario is independently retrievable.
    3. Expect exactly 15 top-level sections per article; fewer → flag as
       malformed but still index whatever DID parse.
    4. Strip the title-page metadata block (before section 1) and the footer
       horizontal rule (`---` after section 15) — they're not sections.
    5. Skip empty heading-only matches (headings with no body content).

Chunk record shape emitted:
    {
        "chunk_id":       "<reference_id>#s08" or "<reference_id>#s08.2",
        "reference_id":   "<parent article reference_id>",
        "doc_title":      "<parent article title>",
        "section_number": 8,
        "section_title":  "Failure Patterns",
        "subsection":     None | "8.2 Retro Pay Miscalculation",
        "text":           "<full section or subsection body>",
        "word_count":     412,
    }
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable, Optional

# H1 numbered section boundary. Matches:
#   "8. Failure Patterns"
#   "# 8. Failure Patterns"
#   "  8.  Failure Patterns"
_H1_RE = re.compile(r"^\s*#{0,2}\s*(\d{1,2})\.\s+(.+?)\s*$", re.MULTILINE)

# H2 subheading — for splitting long sections. Matches:
#   "## 8.2 Retro pay miscalculation"
#   "## Failure 1: Late arrivals"
#   "### 4.1 Something"
_H2_RE = re.compile(r"^\s{0,3}#{2,3}\s+(.+?)\s*$", re.MULTILINE)

# Section length above which we sub-split on H2s. Chunks aim for 200–800 words.
_SUBSPLIT_THRESHOLD_WORDS = 800
_MIN_CHUNK_WORDS = 5  # discard heading-only fragments


@dataclass
class Chunk:
    chunk_id: str
    reference_id: str
    doc_title: str
    section_number: int
    section_title: str
    text: str
    subsection: Optional[str] = None
    word_count: int = 0

    def as_dict(self) -> dict:
        return {
            "chunk_id": self.chunk_id,
            "reference_id": self.reference_id,
            "doc_title": self.doc_title,
            "section_number": self.section_number,
            "section_title": self.section_title,
            "subsection": self.subsection,
            "text": self.text,
            "word_count": self.word_count,
        }


@dataclass
class ChunkResult:
    reference_id: str
    doc_title: str
    chunks: list[Chunk] = field(default_factory=list)
    section_count: int = 0
    is_malformed: bool = False
    malformed_reason: str = ""


def _word_count(s: str) -> int:
    return len(s.split())


def _sub_split(section_body: str) -> list[tuple[Optional[str], str]]:
    """Split a long section on H2 subheadings.

    Returns list of (subsection_label, body). If no H2 boundaries exist,
    returns a single (None, section_body) tuple. Empty subsections are
    dropped by the caller via _MIN_CHUNK_WORDS filter.
    """
    matches = list(_H2_RE.finditer(section_body))
    if not matches:
        return [(None, section_body.strip())]

    parts: list[tuple[Optional[str], str]] = []
    # Preamble before the first H2 (kept if non-trivial)
    preamble = section_body[: matches[0].start()].strip()
    if _word_count(preamble) >= _MIN_CHUNK_WORDS:
        parts.append((None, preamble))
    for i, m in enumerate(matches):
        label = m.group(1).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(section_body)
        body = section_body[start:end].strip()
        # Prepend the label to the body so the chunk carries its own header
        # for embedding — helps retrieval quality.
        text = f"{label}\n\n{body}" if body else label
        parts.append((label, text))
    return parts


def chunk_article(
    *, reference_id: str, doc_title: str, body: str
) -> ChunkResult:
    """Chunk a single article body into section-level (and sub-section) chunks.

    Never raises — malformed articles still yield whatever chunks parsed cleanly
    and are flagged via `ChunkResult.is_malformed` so the caller can log them.
    """
    result = ChunkResult(reference_id=reference_id, doc_title=doc_title)

    if not body or not body.strip():
        result.is_malformed = True
        result.malformed_reason = "empty body"
        return result

    matches = list(_H1_RE.finditer(body))
    if not matches:
        result.is_malformed = True
        result.malformed_reason = "no numbered H1 sections found"
        return result

    result.section_count = len(matches)
    # Product expectation: exactly 15 sections. Fewer/more → still index, flag.
    if len(matches) != 15:
        result.is_malformed = True
        result.malformed_reason = f"expected 15 sections, found {len(matches)}"

    for i, m in enumerate(matches):
        section_num = int(m.group(1))
        section_title = m.group(2).strip()
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        section_body = body[body_start:body_end].strip()

        # Trim footer horizontal rules and trailing metadata after last section
        if i == len(matches) - 1:
            # Strip trailing `---`, `***`, `___` rules and anything after
            section_body = re.split(r"\n\s*(?:-{3,}|\*{3,}|_{3,})\s*\n", section_body)[0].strip()

        if _word_count(section_body) < _MIN_CHUNK_WORDS:
            # Heading with no meaningful body — skip.
            continue

        # Long sections: sub-split on H2 boundaries so each failure/subsection
        # is independently retrievable. Short sections stay as one chunk.
        if _word_count(section_body) > _SUBSPLIT_THRESHOLD_WORDS:
            sub_parts = _sub_split(section_body)
        else:
            sub_parts = [(None, section_body)]

        for j, (sub_label, sub_body) in enumerate(sub_parts):
            wc = _word_count(sub_body)
            if wc < _MIN_CHUNK_WORDS:
                continue
            suffix = f".{j}" if sub_label is not None else ""
            chunk_id = f"{reference_id}#s{section_num:02d}{suffix}"
            result.chunks.append(Chunk(
                chunk_id=chunk_id,
                reference_id=reference_id,
                doc_title=doc_title,
                section_number=section_num,
                section_title=section_title,
                subsection=sub_label,
                text=sub_body,
                word_count=wc,
            ))
    return result


def chunk_articles(articles: Iterable[dict]) -> Iterable[ChunkResult]:
    """Convenience iterator — pass an iterable of `{reference_id, title, body}` dicts."""
    for a in articles:
        yield chunk_article(
            reference_id=a.get("reference_id") or a.get("id", ""),
            doc_title=a.get("title", ""),
            body=a.get("body", ""),
        )

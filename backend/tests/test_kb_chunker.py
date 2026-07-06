"""Tests for the KB section chunker.

We keep these purely functional — no DB, no HTTP — so they run fast
in CI and don't depend on the embedding provider.
"""
from __future__ import annotations

import textwrap

from services.kb_indexing.chunker import chunk_article


def _make_article(body: str, ref: str = "WD-KB-001", title: str = "Test Article") -> dict:
    return {"reference_id": ref, "doc_title": title, "body": body}


def _fifteen_section_body(section_words: int = 20) -> str:
    """Build a well-formed 15-section body with `section_words` per section."""
    filler = " ".join([f"word{i}" for i in range(section_words)])
    sections = []
    titles = [
        "Executive Summary", "Prerequisites", "Configuration Overview",
        "Step-by-step Setup", "Validation Checks", "Testing Strategy",
        "Common Pitfalls", "Failure Patterns", "Performance Notes",
        "Security Considerations", "Common Workday Reports", "Rollback Plan",
        "FAQ", "Glossary", "Related Articles",
    ]
    for i, title in enumerate(titles, start=1):
        sections.append(f"# {i}. {title}\n\n{filler}\n")
    return "\n".join(sections)


class TestHappyPath:
    def test_15_sections_all_short(self):
        art = _make_article(_fifteen_section_body(section_words=20))
        r = chunk_article(**art)
        assert r.section_count == 15
        assert not r.is_malformed
        # Each section produces exactly one chunk when short.
        assert len(r.chunks) == 15
        # Chunk IDs are zero-padded and stable per section
        assert r.chunks[0].chunk_id == "WD-KB-001#s01"
        assert r.chunks[7].chunk_id == "WD-KB-001#s08"
        assert r.chunks[14].chunk_id == "WD-KB-001#s15"

    def test_section_metadata_is_carried(self):
        art = _make_article(_fifteen_section_body())
        r = chunk_article(**art)
        c8 = r.chunks[7]
        assert c8.section_number == 8
        assert c8.section_title == "Failure Patterns"
        assert c8.reference_id == "WD-KB-001"
        assert c8.doc_title == "Test Article"


class TestSubSplitLongSections:
    def test_long_section_sub_splits_on_h2(self):
        # Section 8 is > threshold and contains 3 sub-headings.
        long_section = ["# 8. Failure Patterns\n"]
        for i in range(1, 4):
            long_section.append(f"## Failure {i}: Something goes wrong")
            long_section.append(" ".join([f"w{i}_{j}" for j in range(400)]))  # ~400 words
            long_section.append("")
        body = "\n".join(long_section)
        r = chunk_article(**_make_article(body))
        # Section 8 alone should sub-split into 3 chunks (one per failure).
        s8 = [c for c in r.chunks if c.section_number == 8]
        assert len(s8) == 3
        assert all(c.subsection and c.subsection.startswith("Failure ") for c in s8)
        # Chunk IDs are unique per sub-part.
        assert len({c.chunk_id for c in s8}) == 3

    def test_short_section_does_not_sub_split(self):
        body = "# 3. Prerequisites\n\n## 3.1 Tools\n\nOnly a few words."
        r = chunk_article(**_make_article(body))
        # Well under the sub-split threshold — stays as one chunk.
        s3 = [c for c in r.chunks if c.section_number == 3]
        assert len(s3) == 1
        assert s3[0].subsection is None


class TestMalformed:
    def test_missing_sections_flags_malformed_but_still_indexes(self):
        # Only 5 sections instead of 15.
        body = "\n".join([f"# {i}. Title {i}\n\nsome content here for section {i}\n"
                          for i in range(1, 6)])
        r = chunk_article(**_make_article(body))
        assert r.is_malformed is True
        assert "expected 15" in r.malformed_reason
        # But the 5 sections that DID parse are still chunked.
        assert len(r.chunks) == 5

    def test_empty_body_flags_malformed(self):
        r = chunk_article(**_make_article(""))
        assert r.is_malformed is True
        assert r.chunks == []

    def test_no_headings_flags_malformed(self):
        r = chunk_article(**_make_article("Just some running text with no headings."))
        assert r.is_malformed is True
        assert "no numbered H1" in r.malformed_reason


class TestEdgeCases:
    def test_heading_only_section_is_skipped(self):
        # Section 4 is heading-only (no body) — should be skipped, not empty chunk.
        body = _fifteen_section_body()
        # Blank out section 4's body
        body = body.replace(
            "# 4. Step-by-step Setup\n\n" + " ".join([f"word{i}" for i in range(20)]),
            "# 4. Step-by-step Setup\n\n",
        )
        r = chunk_article(**_make_article(body))
        # 15 sections detected, but section 4 is not in chunks
        assert r.section_count == 15
        assert 4 not in [c.section_number for c in r.chunks]
        assert len(r.chunks) == 14

    def test_trailing_footer_rule_is_trimmed(self):
        body = _fifteen_section_body() + "\n\n---\n\nDo not embed this footer content."
        r = chunk_article(**_make_article(body))
        last = r.chunks[-1]
        assert last.section_number == 15
        assert "footer content" not in last.text.lower()

    def test_heading_wording_variance_is_ignored(self):
        # The parser splits on the leading number, not the title text.
        body = (
            "# 1. TITLE IN CAPS\n\ncontent one goes here in plain english\n"
            "# 2.   funny  spacing here\n\ncontent two also has enough words\n"
            "# 3. 8. numbers in title\n\ncontent three has plenty of words to survive\n"
        )
        r = chunk_article(**_make_article(body))
        assert [c.section_number for c in r.chunks] == [1, 2, 3]
        # Section 3's title CAN contain a digit — parser must not misclassify.
        assert r.chunks[2].section_title.startswith("8.")

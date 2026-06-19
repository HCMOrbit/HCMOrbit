"""CI guard: verify the JS welcome-email template port stays in sync with the
Python source of truth.

Strategy: render the 3 Python templates, extract a set of "canary" substrings
(subject lines, key copy, brand colors, signature, footer), then assert each
one appears verbatim in `welcomeEmailTemplates.js`. If a copy edit lands in
one file and not the other, this test fails the CI build.

The test is intentionally a substring match (not a structural diff) so that
trivial differences (whitespace, attribute order, JS-vs-Python formatting)
don't cause false positives.
"""
import re
from pathlib import Path

import pytest

from welcome_emails import (
    _email_1_html,
    _email_2_html,
    _email_3_html,
    HEADER_HTML,
    SIGNATURE_HTML,
    _footer_html,
)


JS_TEMPLATE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "src"
    / "lib"
    / "welcomeEmailTemplates.js"
)


@pytest.fixture(scope="module")
def js_source() -> str:
    """The full text of the JS template port."""
    assert JS_TEMPLATE_PATH.exists(), f"JS template file missing: {JS_TEMPLATE_PATH}"
    return JS_TEMPLATE_PATH.read_text(encoding="utf-8")


# ---- Canary copy ----------------------------------------------------------

SUBJECTS = {
    1: "Welcome to HCMOrbit",
    2: "Top 5 resources every Workday professional should know",
    3: "What's your biggest Workday challenge?",
}


@pytest.mark.parametrize("step,expected_subject", list(SUBJECTS.items()))
def test_subject_lines_in_sync(step, expected_subject, js_source):
    """The Python subject line for each step must appear verbatim in the JS file."""
    py_subject = {1: _email_1_html, 2: _email_2_html, 3: _email_3_html}[step]("X")[0]
    assert py_subject == expected_subject, (
        f"Python subject for step {step} changed unexpectedly. "
        f"Update SUBJECTS dict here AND mirror in the JS file."
    )
    assert expected_subject in js_source, (
        f"Subject for Email {step} '{expected_subject}' missing from JS template. "
        f"Update /app/frontend/src/lib/welcomeEmailTemplates.js to match the Python."
    )


CTA_LABELS = ["Quick ask:", "Pro tip:", "Hit reply"]


@pytest.mark.parametrize("label", CTA_LABELS)
def test_cta_labels_in_sync(label, js_source):
    """Each CTA-box label used in the Python templates must appear in the JS file."""
    # Verify the label still exists somewhere in the rendered Python emails first
    rendered_all = (
        _email_1_html("X")[1] + _email_2_html("X")[1] + _email_3_html("X")[1]
    )
    assert label in rendered_all, (
        f"CTA label '{label}' missing from Python templates. "
        f"Update CTA_LABELS in this test if you intentionally renamed it."
    )
    assert label in js_source, (
        f"CTA label '{label}' missing from JS template. Mirror the Python change."
    )


def test_founder_quote_in_sync(js_source):
    quote = "I created HCMOrbit because the knowledge exists"
    assert quote in _email_1_html("X")[1]
    assert quote in js_source, "Founder quote drift between Python and JS templates."


def test_signature_block_in_sync(js_source):
    """Signature elements that brand the email must match across both files."""
    must_match = [
        "Suchismita Tripathy",
        "Founder | HCMOrbit",
        "The Community Where Workday Professionals Learn, Solve, and Grow",
        "calendar.app.google/xPmeV4iQ9WKi3ezY8",
        "suchi@hcmorbit.com",
        "hcmorbit.com",
    ]
    for s in must_match:
        assert s in SIGNATURE_HTML, f"'{s}' missing from Python SIGNATURE_HTML"
        assert s in js_source, (
            f"Signature element '{s}' missing from JS template — drift detected."
        )


def test_header_branding_in_sync(js_source):
    """Header brand wordmark and tagline must match."""
    for s in [
        "HCM",
        "Orbit",
        "The Community Where Workday Professionals Learn, Solve, and Grow",
        "#1B3A6B",   # navy band
        "#5EEAD4",   # teal accent on wordmark
    ]:
        assert s in HEADER_HTML, f"'{s}' missing from Python HEADER_HTML"
        assert s in js_source, f"Header element '{s}' missing from JS template."


def test_footer_in_sync(js_source):
    """Footer copy + dynamic-year structure must match."""
    py_footer = _footer_html()
    assert "You received this because you joined HCMOrbit." in py_footer
    assert "You received this because you joined HCMOrbit." in js_source
    assert "All rights reserved." in py_footer
    assert "All rights reserved." in js_source
    # JS must use a dynamic year (not a hardcoded one)
    assert re.search(r"getUTCFullYear\s*\(\s*\)", js_source), (
        "JS template must compute the year dynamically (getUTCFullYear) "
        "to mirror the Python `datetime.now(timezone.utc).year`."
    )


def test_brand_color_tokens_in_sync(js_source):
    """The 3 brand colors must be present in both files."""
    for color in ["#1B3A6B", "#0D9373", "#E1F5EE"]:
        # Sanity-check Python output
        assert color in _email_1_html("X")[1], f"Brand color {color} missing from Python output"
        assert color in js_source, f"Brand color {color} missing from JS template — drift detected."


def test_resource_card_count_in_sync(js_source):
    """Email 1 has 3 cards, Emails 2 & 3 have 5 cards each — confirm JS does too."""
    # Count `border-left:4px solid #0D9373` occurrences inside each builder in JS.
    # Each email-N function block ends at the next `function email` declaration.
    def cards_in(fn_name: str) -> int:
        start = js_source.find(f"function {fn_name}(")
        assert start != -1, f"JS function {fn_name} not found"
        # Find the next function or end of file
        rest = js_source[start:]
        end_match = re.search(r"\nfunction\s+\w+\(", rest[1:])
        end = end_match.start() + 1 if end_match else len(rest)
        block = rest[:end]
        # Resource cards use `border-left:4px solid #0D9373`. The founder quote
        # & CTA boxes in Email 1 also use that token, so count card calls instead.
        return block.count("resourceCard(")

    assert cards_in("email1") == 3, "Email 1 should call resourceCard 3 times in JS"
    assert cards_in("email2") == 5, "Email 2 should call resourceCard 5 times in JS"
    assert cards_in("email3") == 5, "Email 3 should call resourceCard 5 times in JS"

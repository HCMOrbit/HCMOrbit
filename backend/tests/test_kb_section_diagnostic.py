"""Tests for the new /admin/kb/section-diagnostic/{reference_id} endpoint
and regression tests around the KB chunker + related admin/ask routes.

Testing scope (per E1 review request iteration 10):
    - Diagnostic returns expected JSON keys/shape
    - Diagnostic returns section_count_detected=15, missed_lines=[] and
      "no fix needed" for TA-CAREER-KB-001..006 (clean articles in preview)
    - Unauthenticated calls return 401 (require_admin gate)
    - Non-existent reference_id returns 404 with helpful message
    - Chunker regression: TA-CAREER-KB-* still parse to exactly 15 sections
    - Existing POST /admin/kb/reindex/{ref} still works for HCM-CORE-KB-001
    - POST /api/ask still returns contract shape with graceful fallback when
      Voyage key is empty (preview env expected behaviour)
"""
from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback to frontend .env — CI containers sometimes don't export it.
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")

ADMIN_EMAIL = "admin@hcmorbit.com"
ADMIN_PASSWORD = "Admin123!"

TA_CAREER_REFS = [f"TA-CAREER-KB-00{i}" for i in range(1, 7)]
HCM_REF = "HCM-CORE-KB-001"


# ── Fixtures ──────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    resp = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if resp.status_code != 200:
        pytest.skip(f"Admin login failed: {resp.status_code} {resp.text[:200]}")
    data = resp.json()
    token = data.get("token") or data.get("access_token")
    if not token:
        pytest.skip(f"No token in login response: {data}")
    return token


@pytest.fixture(scope="session")
def admin_client(api_client, admin_token):
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}",
    })
    return s


# ── Diagnostic endpoint — happy path ─────────────────────────────────
class TestSectionDiagnosticHappyPath:
    """Diagnostic on TA-CAREER-KB-001 (clean article in preview DB)."""

    def test_returns_expected_shape(self, admin_client):
        r = admin_client.get(
            f"{BASE_URL}/api/admin/kb/section-diagnostic/TA-CAREER-KB-001"
        )
        assert r.status_code == 200, r.text
        data = r.json()
        expected_keys = {
            "reference_id", "title", "body_length",
            "current_regex_pattern", "section_count_detected",
            "current_regex_matches", "candidate_headings",
            "missed_lines", "diagnosis",
        }
        assert expected_keys.issubset(data.keys()), (
            f"Missing keys: {expected_keys - set(data.keys())}"
        )
        assert data["reference_id"] == "TA-CAREER-KB-001"
        assert isinstance(data["body_length"], int) and data["body_length"] > 0
        assert isinstance(data["current_regex_matches"], list)
        assert isinstance(data["candidate_headings"], list)
        assert isinstance(data["missed_lines"], list)

    def test_ta_career_001_parses_cleanly(self, admin_client):
        r = admin_client.get(
            f"{BASE_URL}/api/admin/kb/section-diagnostic/TA-CAREER-KB-001"
        )
        assert r.status_code == 200
        data = r.json()
        assert data["section_count_detected"] == 15, (
            f"Expected 15 sections, got {data['section_count_detected']}. "
            f"Diagnosis: {data['diagnosis']}"
        )
        assert data["missed_lines"] == [], (
            f"Expected no missed lines, got: {data['missed_lines']}"
        )
        assert "no fix needed" in data["diagnosis"].lower(), (
            f"Diagnosis text: {data['diagnosis']}"
        )

    @pytest.mark.parametrize("ref", TA_CAREER_REFS)
    def test_all_ta_career_articles_parse_to_15(self, admin_client, ref):
        r = admin_client.get(
            f"{BASE_URL}/api/admin/kb/section-diagnostic/{ref}"
        )
        assert r.status_code == 200, f"{ref}: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert data["section_count_detected"] == 15, (
            f"{ref}: got {data['section_count_detected']} sections"
        )


# ── Diagnostic endpoint — auth ───────────────────────────────────────
class TestSectionDiagnosticAuth:
    def test_unauthenticated_returns_401(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/admin/kb/section-diagnostic/TA-CAREER-KB-001"
        )
        assert r.status_code == 401, (
            f"Expected 401 unauthenticated, got {r.status_code}: {r.text[:200]}"
        )

    def test_bad_token_returns_401(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/admin/kb/section-diagnostic/TA-CAREER-KB-001",
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        assert r.status_code == 401, (
            f"Expected 401 with bad token, got {r.status_code}"
        )


# ── Diagnostic endpoint — 404 ────────────────────────────────────────
class TestSectionDiagnosticNotFound:
    def test_missing_ref_returns_404(self, admin_client):
        r = admin_client.get(
            f"{BASE_URL}/api/admin/kb/section-diagnostic/DOES-NOT-EXIST"
        )
        assert r.status_code == 404, (
            f"Expected 404, got {r.status_code}: {r.text[:200]}"
        )
        body = r.json()
        detail = body.get("detail", "")
        assert "not found" in str(detail).lower(), (
            f"Expected helpful 'not found' message, got: {detail}"
        )
        assert "DOES-NOT-EXIST" in str(detail), (
            f"Expected reference_id echoed in error: {detail}"
        )


# ── Regression: chunker still parses TA-CAREER-* to 15 sections ──────
class TestChunkerRegression:
    """Import chunker directly and run on live DB bodies — no HTTP.

    This is the load-bearing regression check: if the diagnostic endpoint's
    tolerant regex changes accidentally leaked into the strict chunker
    regex, this would fail.
    """

    @pytest.mark.parametrize("ref", TA_CAREER_REFS)
    def test_chunker_parses_15_sections(self, ref):
        import asyncio
        import sys
        sys.path.insert(0, "/app/backend")
        from motor.motor_asyncio import AsyncIOMotorClient
        from services.kb_indexing.chunker import chunk_article

        async def _load(ref):
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client["test_database"]
            doc = await db.kb_docs.find_one(
                {"reference_id": ref},
                {"_id": 0, "reference_id": 1, "title": 1, "body": 1},
            )
            client.close()
            return doc

        doc = asyncio.get_event_loop().run_until_complete(_load(ref))
        assert doc is not None, f"{ref} missing from DB"
        result = chunk_article(
            reference_id=doc["reference_id"],
            doc_title=doc["title"],
            body=doc["body"],
        )
        assert result.section_count == 15, (
            f"{ref}: chunker found {result.section_count} sections, "
            f"malformed={result.is_malformed} reason={result.malformed_reason}"
        )
        assert not result.is_malformed, (
            f"{ref} flagged malformed: {result.malformed_reason}"
        )


# ── Regression: POST /admin/kb/reindex still works ───────────────────
class TestReindexRegression:
    def test_reindex_hcm_core_001(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/kb/reindex/{HCM_REF}")
        # In preview VOYAGE_API_KEY is empty; reindex will emit errors on
        # embedding but the route contract is "500 with report on failure,
        # 200 with report on success, 404 on missing ref". We accept either
        # 200 or 500 because Voyage isn't available here — but the *shape*
        # must be a dict with 'articles_indexed' etc. either way.
        if r.status_code == 404:
            pytest.fail(f"HCM-CORE-KB-001 not found in preview DB: {r.text}")

        # Success path
        if r.status_code == 200:
            data = r.json()
            for key in ("articles_processed", "articles_indexed",
                        "chunks_created", "errors"):
                assert key in data, f"Missing key '{key}' in report: {data}"
            return

        # Failure path (expected in preview — no Voyage key)
        assert r.status_code == 500, (
            f"Unexpected status {r.status_code}: {r.text[:300]}"
        )
        body = r.json()
        detail = body.get("detail", {})
        # Contract: detail carries the report so operators can diagnose
        # without deploy logs.
        assert isinstance(detail, dict) or "message" in str(detail).lower(), (
            f"Expected structured detail, got: {detail}"
        )

    def test_reindex_unknown_returns_404(self, admin_client):
        r = admin_client.post(
            f"{BASE_URL}/api/admin/kb/reindex/DOES-NOT-EXIST-KB-999"
        )
        assert r.status_code == 404, (
            f"Expected 404 for unknown ref, got {r.status_code}: {r.text[:200]}"
        )


# ── Regression: POST /api/ask still returns contract shape ───────────
class TestAskRegression:
    def test_ask_returns_contract_shape(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/ask",
            json={"question": "What are the failure patterns in career sites?"},
        )
        assert r.status_code == 200, (
            f"Expected 200, got {r.status_code}: {r.text[:300]}"
        )
        data = r.json()
        for key in ("answer", "tenant_check", "sources", "in_scope"):
            assert key in data, f"Missing key '{key}' in response: {list(data.keys())}"
        assert isinstance(data["answer"], str) and data["answer"]
        assert isinstance(data["sources"], list)
        assert isinstance(data["in_scope"], bool)

    def test_ask_graceful_fallback_no_voyage_key(self, api_client):
        """In preview env VOYAGE_API_KEY is empty — service must return
        graceful fallback with in_scope=False and empty sources."""
        r = api_client.post(
            f"{BASE_URL}/api/ask",
            json={"question": "Random Workday question about payroll"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["in_scope"] is False, (
            f"Expected in_scope=False when Voyage is unreachable, got: {data}"
        )
        assert data["sources"] == [], f"Expected empty sources, got: {data['sources']}"

    def test_ask_rejects_empty_question(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/ask", json={"question": ""})
        # Pydantic min_length=1 → 422 Unprocessable Entity
        assert r.status_code == 422, (
            f"Expected 422 for empty question, got {r.status_code}"
        )

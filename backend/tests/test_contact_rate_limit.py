"""Unit tests for the public /api/contact rate limiter (5/IP/hour).

Mirrors the pattern in `test_submit_rate_limit.py` — we test the pure helpers
in `routes/contact.py` directly to avoid Motor/asyncio loop issues that occur
when driving TestClient against this codebase.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routes import contact


def _req(remote_ip="127.0.0.1", forwarded=None):
    headers = {"x-forwarded-for": forwarded} if forwarded else {}
    return SimpleNamespace(
        headers=SimpleNamespace(get=headers.get),
        client=SimpleNamespace(host=remote_ip) if remote_ip else None,
    )


@pytest.fixture(autouse=True)
def _reset_window():
    contact._hits.clear()
    yield
    contact._hits.clear()


def test_first_five_hits_pass():
    for _ in range(5):
        contact._check_rate_limit(_req(forwarded="10.1.0.1"))
    assert len(contact._hits["10.1.0.1"]) == 5


def test_sixth_hit_raises_429():
    for _ in range(5):
        contact._check_rate_limit(_req(forwarded="10.1.0.2"))
    with pytest.raises(HTTPException) as exc:
        contact._check_rate_limit(_req(forwarded="10.1.0.2"))
    assert exc.value.status_code == 429
    assert "Too many messages" in exc.value.detail


def test_limit_is_per_ip():
    for _ in range(5):
        contact._check_rate_limit(_req(forwarded="10.1.0.10"))
    with pytest.raises(HTTPException):
        contact._check_rate_limit(_req(forwarded="10.1.0.10"))
    contact._check_rate_limit(_req(forwarded="10.1.0.11"))
    assert len(contact._hits["10.1.0.11"]) == 1


def test_client_ip_prefers_x_forwarded_for():
    assert contact._client_ip(_req(remote_ip="10.0.0.1", forwarded="203.0.113.7, 10.0.0.9")) == "203.0.113.7"


def test_client_ip_handles_missing_client():
    assert contact._client_ip(_req(remote_ip=None, forwarded=None)) == "unknown"

"""Unit tests for the public-submit rate limiter (5/IP/hour).

The helpers in `routes/ecosystem.py` (`_check_submit_rate_limit`, `_client_ip`)
are pure and don't touch the DB — we test them directly to avoid the
Motor/asyncio loop collision that occurs when using FastAPI's TestClient with
this codebase.
"""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routes import ecosystem as eco


def _req(remote_ip: str | None = "127.0.0.1", forwarded: str | None = None):
    """Build a minimal stand-in Request object exposing just the fields the
    helper consumes (`headers.get`, `client.host`)."""
    headers = {"x-forwarded-for": forwarded} if forwarded else {}
    return SimpleNamespace(
        headers=SimpleNamespace(get=headers.get),
        client=SimpleNamespace(host=remote_ip) if remote_ip else None,
    )


@pytest.fixture(autouse=True)
def _reset_window():
    eco._submit_hits.clear()
    yield
    eco._submit_hits.clear()


def test_client_ip_prefers_x_forwarded_for():
    assert eco._client_ip(_req(remote_ip="10.0.0.1", forwarded="203.0.113.1, 10.0.0.5")) == "203.0.113.1"


def test_client_ip_falls_back_to_remote_addr():
    assert eco._client_ip(_req(remote_ip="10.0.0.1", forwarded=None)) == "10.0.0.1"


def test_client_ip_handles_missing_client():
    assert eco._client_ip(_req(remote_ip=None, forwarded=None)) == "unknown"


def test_first_five_hits_pass():
    for _ in range(5):
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.1"))
    assert len(eco._submit_hits["10.0.0.1"]) == 5


def test_sixth_hit_raises_429_with_message():
    for _ in range(5):
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.2"))
    with pytest.raises(HTTPException) as exc:
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.2"))
    assert exc.value.status_code == 429
    assert "Too many submissions" in exc.value.detail


def test_limit_is_per_ip():
    """Exhausting IP A must not affect IP B's quota."""
    for _ in range(5):
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.10"))
    with pytest.raises(HTTPException):
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.10"))
    # Different IP — clean quota.
    eco._check_submit_rate_limit(_req(forwarded="10.0.0.11"))
    assert len(eco._submit_hits["10.0.0.11"]) == 1


def test_expired_timestamps_release_quota():
    """Hits older than the window are evicted on the next check."""
    for _ in range(5):
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.20"))
    with pytest.raises(HTTPException):
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.20"))

    # Roll all stored timestamps for this IP back beyond the window.
    eco._submit_hits["10.0.0.20"] = [
        t - (eco._SUBMIT_RL_WINDOW_S + 1) for t in eco._submit_hits["10.0.0.20"]
    ]

    eco._check_submit_rate_limit(_req(forwarded="10.0.0.20"))  # should not raise
    # After the call the bucket should contain exactly the one fresh hit.
    assert len(eco._submit_hits["10.0.0.20"]) == 1


def test_blocked_ip_does_not_grow_unbounded():
    """Repeated rejections must keep evicting expired timestamps, not append more."""
    for _ in range(5):
        eco._check_submit_rate_limit(_req(forwarded="10.0.0.30"))
    for _ in range(10):
        with pytest.raises(HTTPException):
            eco._check_submit_rate_limit(_req(forwarded="10.0.0.30"))
    assert len(eco._submit_hits["10.0.0.30"]) == 5

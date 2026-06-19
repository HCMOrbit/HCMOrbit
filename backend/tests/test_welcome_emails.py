"""Unit tests for the welcome email sequence (no external network)."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import pytest_asyncio  # noqa: F401  (registers the asyncio mode)

import welcome_emails as we
from welcome_emails import _email_1_html, _email_2_html, _email_3_html, process_welcome_queue
from core import db


def test_email_1_template_contains_required_copy():
    subject, html = _email_1_html("Alex Tester")
    assert subject == "Welcome to HCMOrbit"
    assert "I created HCMOrbit because the knowledge exists" in html
    assert "hcmorbit.com/knowledge-base" in html
    assert "hcmorbit.com/community" in html
    assert "hcmorbit.com/career-hub" in html
    assert "What brought you to HCMOrbit" in html
    assert "Suchismita Tripathy" in html
    assert "Founder | HCMOrbit" in html
    assert "calendar.app.google/xPmeV4iQ9WKi3ezY8" in html
    assert "Hi Alex," in html


def test_branded_visual_design_applied_to_all_emails():
    """All 3 emails share the new branded shell: navy header, teal accents,
    light-teal callout, footer copyright. Locks the brand colors in regression."""
    for builder in (_email_1_html, _email_2_html, _email_3_html):
        _, html = builder("Sam")
        # Header navy band + tagline
        assert "#1B3A6B" in html, "navy brand color missing"
        assert "The Community Where Workday Professionals Learn, Solve, and Grow" in html
        # Teal accent on cards + signature links
        assert "#0D9373" in html, "teal accent color missing"
        # Quick-ask / pro-tip / hit-reply callout uses light teal
        assert "#E1F5EE" in html, "light teal callout color missing"
        # Footer copy — year is computed at render time
        assert "You received this because you joined HCMOrbit" in html
        current_year = datetime.now(timezone.utc).year
        assert f"{current_year} HCMOrbit" in html
        # Email-client-safe font (no system-ui)
        assert "Arial" in html
        # Width constraint
        assert "max-width:600px" in html or 'width="600"' in html


def test_email_2_template_contains_top_5_resources():
    subject, html = _email_2_html(None)
    assert "Top 5 resources" in subject
    assert "Knowledge Base" in html
    assert "Governance" in html or "governance" in html
    assert "Interview prep" in html or "interview" in html.lower()
    assert "Community" in html
    assert "Career Hub" in html
    assert "Suchismita Tripathy" in html


def test_email_3_template_asks_about_challenge():
    subject, html = _email_3_html("Priya")
    assert subject == "What's your biggest Workday challenge?"
    assert "Security" in html
    assert "Reporting" in html
    assert "Integrations" in html
    assert "Recruiting" in html
    assert "Career growth" in html
    assert "Hi Priya," in html


@pytest.mark.asyncio
async def test_process_welcome_queue_selects_only_eligible(monkeypatch):
    """Insert 4 users with varied created_at; verify only the right ones get email 2/3."""
    sent_calls = []

    async def fake_send(user, step):
        sent_calls.append((user["email"], step))
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {f"welcome_email_{step}_sent": datetime.now(timezone.utc).isoformat()}},
        )
        return True

    monkeypatch.setattr(we, "send_welcome_email", fake_send)
    # Make the throttle a true no-op (do NOT recurse into the patched function)
    _real_sleep = asyncio.sleep
    monkeypatch.setattr(we.asyncio, "sleep", lambda *_a, **_k: _real_sleep(0))

    now = datetime.now(timezone.utc)
    tag = uuid.uuid4().hex[:8]
    users = [
        {"user_id": f"wq_a_{tag}", "email": f"a_{tag}@example.com", "username": f"a_{tag}",
         "auth_provider": "email", "created_at": (now - timedelta(days=6)).isoformat()},
        {"user_id": f"wq_b_{tag}", "email": f"b_{tag}@example.com", "username": f"b_{tag}",
         "auth_provider": "email", "created_at": (now - timedelta(days=3)).isoformat()},
        {"user_id": f"wq_c_{tag}", "email": f"c_{tag}@example.com", "username": f"c_{tag}",
         "auth_provider": "email", "created_at": (now - timedelta(days=1)).isoformat()},
        {"user_id": f"wq_d_{tag}", "email": f"d_{tag}@hcmorbit.demo", "username": f"d_{tag}",
         "auth_provider": "email", "created_at": (now - timedelta(days=6)).isoformat()},
    ]
    await db.users.insert_many(users)

    try:
        await process_welcome_queue()
        sent_for = {(e, s) for (e, s) in sent_calls if tag in e}
        assert (f"a_{tag}@example.com", 2) in sent_for
        assert (f"a_{tag}@example.com", 3) in sent_for
        assert (f"b_{tag}@example.com", 2) in sent_for
        assert (f"b_{tag}@example.com", 3) not in sent_for
        assert not any(e.startswith(f"c_{tag}") for (e, _) in sent_for)
        assert not any(e.startswith(f"d_{tag}") for (e, _) in sent_for)
    finally:
        await db.users.delete_many({"user_id": {"$regex": f"^wq_._{tag}$"}})


@pytest.mark.asyncio
async def test_process_welcome_queue_idempotent(monkeypatch):
    sent_calls = []

    async def fake_send(user, step):
        sent_calls.append((user["email"], step))
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {f"welcome_email_{step}_sent": datetime.now(timezone.utc).isoformat()}},
        )
        return True

    monkeypatch.setattr(we, "send_welcome_email", fake_send)
    _real_sleep = asyncio.sleep
    monkeypatch.setattr(we.asyncio, "sleep", lambda *_a, **_k: _real_sleep(0))

    now = datetime.now(timezone.utc)
    tag = uuid.uuid4().hex[:8]
    await db.users.insert_one({
        "user_id": f"wq_idem_{tag}",
        "email": f"idem_{tag}@example.com",
        "username": f"idem_{tag}",
        "auth_provider": "email",
        "created_at": (now - timedelta(days=6)).isoformat(),
        "welcome_email_2_sent": now.isoformat(),  # already sent
    })

    try:
        await process_welcome_queue()
        sent_for_user = [(e, s) for (e, s) in sent_calls if tag in e]
        assert (f"idem_{tag}@example.com", 2) not in sent_for_user
        assert (f"idem_{tag}@example.com", 3) in sent_for_user
    finally:
        await db.users.delete_one({"user_id": f"wq_idem_{tag}"})

"""Guard the sender for password-reset emails — they MUST go from
`support@hcmorbit.com` (not the founder's personal inbox).
"""
import importlib
import os

import pytest


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch):
    monkeypatch.delenv("PASSWORD_RESET_SENDER_EMAIL", raising=False)
    yield


def test_default_password_reset_sender_is_support():
    import password_reset_email as mod
    importlib.reload(mod)
    assert mod._password_reset_sender() == "support@hcmorbit.com"


def test_password_reset_sender_overridable_via_env(monkeypatch):
    monkeypatch.setenv("PASSWORD_RESET_SENDER_EMAIL", "noreply@example.com")
    import password_reset_email as mod
    importlib.reload(mod)
    assert mod._password_reset_sender() == "noreply@example.com"


def test_welcome_sender_is_independent_of_password_reset_sender(monkeypatch):
    """Welcome stream must stay on its own sender even when reset sender changes."""
    monkeypatch.setenv("PASSWORD_RESET_SENDER_EMAIL", "support@hcmorbit.com")
    monkeypatch.setenv("SENDER_EMAIL", "founder@hcmorbit.com")
    import password_reset_email as pr_mod
    import welcome_emails as we_mod
    importlib.reload(we_mod)
    importlib.reload(pr_mod)
    assert pr_mod._password_reset_sender() == "support@hcmorbit.com"
    assert we_mod._resend_config()["sender"] == "founder@hcmorbit.com"

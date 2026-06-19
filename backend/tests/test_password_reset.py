"""Password-reset flow tests.

Covers:
  - /auth/forgot-password is always 200 (anti-enumeration), creates a token
    only when the email matches an existing email-provider user
  - /auth/reset-password validates token, expiry, min-length; updates the
    password hash; deletes the token after use
  - Single-use behavior (token can't be reused)
  - Old password no longer works after reset; new one does
"""
import os
from datetime import datetime, timedelta, timezone

# Ensure MONGO_URL/DB_NAME are available even if core isn't imported first
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

import pytest
import requests
from pymongo import MongoClient

from conftest import BASE_URL


PRIYA_USERNAME = "priya_hcm"
PRIYA_EMAIL    = "priya_hcm@hcmorbit.demo"
PRIYA_PASS     = "Demo123!"


def _sync_db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture
def restore_priya_password():
    """Reset Priya's password to the demo value after any test mutates it."""
    yield
    try:
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": PRIYA_EMAIL, "password": PRIYA_PASS})
        if r.status_code == 200:
            return
    except Exception:
        pass
    # Force-reset via direct DB hash update so the test suite stays repeatable
    import bcrypt
    pw_hash = bcrypt.hashpw(PRIYA_PASS.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db = _sync_db()
    db.users.update_one({"email": PRIYA_EMAIL}, {"$set": {"password_hash": pw_hash}})
    db.password_reset_tokens.delete_many({})


def _latest_token_for(email: str) -> str | None:
    db = _sync_db()
    u = db.users.find_one({"email": email}, {"_id": 0, "user_id": 1})
    if not u:
        return None
    rec = db.password_reset_tokens.find_one({"user_id": u["user_id"]})
    return rec["token"] if rec else None


def test_forgot_password_unknown_email_returns_200():
    """Anti-enumeration: unknown email still returns 200 with success message."""
    r = requests.post(f"{BASE_URL}/api/auth/forgot-password",
                      json={"email": "definitely-not-a-user@example.com"})
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_forgot_password_known_email_creates_token(restore_priya_password):
    """Known email: response is still generic, but a token IS created in DB."""
    # Clear any prior tokens for a clean check
    _sync_db().password_reset_tokens.delete_many({})

    r = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": PRIYA_EMAIL})
    assert r.status_code == 200
    token = _latest_token_for(PRIYA_EMAIL)
    assert token and len(token) >= 32, "Token must be created and reasonably long"


def test_reset_password_invalid_token_400():
    r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"token": "definitely-not-a-real-token", "password": "Whatever123!"})
    assert r.status_code == 400


def test_reset_password_too_short_400(restore_priya_password):
    # Issue a token first
    requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": PRIYA_EMAIL})
    token = _latest_token_for(PRIYA_EMAIL)
    assert token
    r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"token": token, "password": "short"})
    assert r.status_code == 400
    assert "8 characters" in r.json().get("detail", "")


def test_reset_password_full_round_trip(restore_priya_password):
    """End-to-end: issue token → reset → old password fails → new works → token gone."""
    # 1. Issue token
    requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": PRIYA_EMAIL})
    token = _latest_token_for(PRIYA_EMAIL)
    assert token, "Token should be created"

    # 2. Reset to a new password
    new_pwd = "BrandNewPwd!42"
    r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"token": token, "password": new_pwd})
    assert r.status_code == 200
    assert r.json().get("ok") is True

    # 3. Old password should now fail
    r_old = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": PRIYA_EMAIL, "password": PRIYA_PASS})
    assert r_old.status_code == 401

    # 4. New password should work
    r_new = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": PRIYA_EMAIL, "password": new_pwd})
    assert r_new.status_code == 200

    # 5. Token is single-use — must not work again
    r_reuse = requests.post(f"{BASE_URL}/api/auth/reset-password",
                            json={"token": token, "password": "AnotherPwd!"})
    assert r_reuse.status_code == 400


def test_reset_password_expired_token_400(restore_priya_password):
    """Manually expire a token; reset must reject it and clean it up."""
    # Issue a token then backdate its expiry
    requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": PRIYA_EMAIL})
    token = _latest_token_for(PRIYA_EMAIL)
    assert token

    db = _sync_db()
    db.password_reset_tokens.update_one(
        {"token": token},
        {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=5)}},
    )

    r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                      json={"token": token, "password": "Whatever123!"})
    assert r.status_code == 400
    assert "expired" in r.json().get("detail", "").lower()

    # Expired token should be gone from DB
    assert db.password_reset_tokens.find_one({"token": token}) is None

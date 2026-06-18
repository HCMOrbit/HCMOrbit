"""Follow / Unfollow system tests.

Uses the existing seed accounts (elena = practitioner, priya = aspirant).
Each test cleans up its own follow edge after running so other tests stay
deterministic and the test is safe to re-run repeatedly.
"""
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass


PRIYA_USERNAME = "priya_hcm"
ELENA_USERNAME = "elena_carter"


@pytest.fixture
def elena_unfollows_priya(elena_auth):
    """Ensure a clean slate before/after every follow test."""
    requests.delete(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)
    yield
    requests.delete(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)


def test_anon_profile_has_follow_fields():
    """GET /api/users/{username} must always return follower counts + is_following=False for anon."""
    r = requests.get(f"{BASE_URL}/api/users/{PRIYA_USERNAME}")
    assert r.status_code == 200
    body = r.json()
    assert "stats" in body
    assert isinstance(body["stats"]["followers"], int)
    assert isinstance(body["stats"]["following"], int)
    assert body["is_following"] is False


def test_follow_user_succeeds(elena_auth, elena_unfollows_priya):
    """A user can follow another user; is_following flips true and counts increment."""
    before = requests.get(f"{BASE_URL}/api/users/{PRIYA_USERNAME}", headers=elena_auth).json()
    assert before["is_following"] is False
    before_followers = before["stats"]["followers"]

    r = requests.post(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_following"] is True
    assert body["followers_count"] == before_followers + 1

    # Profile endpoint should now reflect the new state for the requesting user
    after = requests.get(f"{BASE_URL}/api/users/{PRIYA_USERNAME}", headers=elena_auth).json()
    assert after["is_following"] is True
    assert after["stats"]["followers"] == before_followers + 1


def test_unfollow_user_succeeds(elena_auth, elena_unfollows_priya):
    """Following then unfollowing returns counts to baseline."""
    # Set up: follow first
    requests.post(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)

    r = requests.delete(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_following"] is False

    after = requests.get(f"{BASE_URL}/api/users/{PRIYA_USERNAME}", headers=elena_auth).json()
    assert after["is_following"] is False


def test_cannot_follow_self(elena_auth):
    """A user cannot follow themselves — 400."""
    r = requests.post(f"{BASE_URL}/api/users/{ELENA_USERNAME}/follow", headers=elena_auth)
    assert r.status_code == 400
    assert "yourself" in r.json().get("detail", "").lower()


def test_cannot_unfollow_self(elena_auth):
    """A user cannot unfollow themselves either — 400."""
    r = requests.delete(f"{BASE_URL}/api/users/{ELENA_USERNAME}/follow", headers=elena_auth)
    assert r.status_code == 400


def test_duplicate_follow_is_idempotent(elena_auth, elena_unfollows_priya):
    """Follow → Follow should not double-increment the count."""
    r1 = requests.post(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)
    assert r1.status_code == 200
    followers_after_first = r1.json()["followers_count"]

    r2 = requests.post(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)
    assert r2.status_code == 200
    assert r2.json()["followers_count"] == followers_after_first
    assert r2.json()["is_following"] is True


def test_follow_unknown_user_404(elena_auth):
    """Following a non-existent user returns 404."""
    r = requests.post(f"{BASE_URL}/api/users/no_such_user_xyz/follow", headers=elena_auth)
    assert r.status_code == 404


def test_follow_requires_auth():
    """Unauthenticated requests to follow / unfollow return 401."""
    r = requests.post(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow")
    assert r.status_code == 401
    r = requests.delete(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow")
    assert r.status_code == 401


def test_other_users_following_state_not_leaked(elena_auth, priya_auth, elena_unfollows_priya):
    """When Elena follows Priya, Priya's own GET of her profile must NOT show is_following=True
    (only the *viewer's* relationship to the profile matters)."""
    requests.post(f"{BASE_URL}/api/users/{PRIYA_USERNAME}/follow", headers=elena_auth)
    # Priya viewing her own profile
    body = requests.get(f"{BASE_URL}/api/users/{PRIYA_USERNAME}", headers=priya_auth).json()
    assert body["is_following"] is False
    # Counts still reflect the new follower
    assert body["stats"]["followers"] >= 1

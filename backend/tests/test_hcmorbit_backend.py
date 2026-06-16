"""HCMOrbit backend API tests."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env file
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass

ADMIN_EMAIL = "admin@hcmorbit.com"
ADMIN_PASS = "Admin123!"
DEMO_PRAC_EMAIL = "elena_carter@hcmorbit.demo"
DEMO_PRAC_PASS = "Demo123!"
DEMO_ASP_EMAIL = "priya_hcm@hcmorbit.demo"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def elena_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_PRAC_EMAIL, "password": DEMO_PRAC_PASS})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def elena_auth(elena_token):
    return {"Authorization": f"Bearer {elena_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def priya_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_ASP_EMAIL, "password": DEMO_PRAC_PASS})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def priya_auth(priya_token):
    return {"Authorization": f"Bearer {priya_token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_root():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- Spaces ----------
def test_spaces_seeded(s):
    """Spaces should match the canonical 17-area taxonomy (aligned with KB
    categories in Feb 2026). Legacy slugs are hidden, not deleted."""
    r = s.get(f"{BASE_URL}/api/spaces")
    assert r.status_code == 200
    spaces = r.json()
    slugs = {sp["slug"] for sp in spaces}
    expected = {
        "core-hcm", "talent-acquisition", "talent-management",
        "compensation-benefits", "workforce-management", "payroll",
        "learning-employee-experience", "workforce-planning-analytics",
        "finance-accounting", "procurement-spend-management",
        "projects-professional-services", "planning", "analytics-reporting",
        "integration-platform", "security-compliance", "ai-automation",
        "industry-solutions",
    }
    assert expected.issubset(slugs), f"Missing: {expected - slugs}"
    assert len(spaces) == 17
    # Legacy slugs MUST NOT appear in the public list
    legacy = {"integrations", "security", "reporting", "compensation", "financials", "career-lounge"}
    leaked = slugs & legacy
    assert not leaked, f"Hidden legacy space slugs leaked into public list: {leaked}"


def test_space_detail(s):
    r = s.get(f"{BASE_URL}/api/spaces/integration-platform")
    assert r.status_code == 200
    assert r.json()["slug"] == "integration-platform"


def test_space_not_found(s):
    r = s.get(f"{BASE_URL}/api/spaces/does-not-exist")
    assert r.status_code == 404


# ---------- Posts ----------
def test_list_posts(s):
    r = s.get(f"{BASE_URL}/api/posts")
    assert r.status_code == 200
    data = r.json()
    assert "posts" in data and "total" in data
    assert data["total"] >= 15
    p0 = data["posts"][0]
    assert "author" in p0 and p0["author"]["username"]
    assert "space" in p0


def test_posts_filter_type(s):
    r = s.get(f"{BASE_URL}/api/posts", params={"type": "question"})
    assert r.status_code == 200
    posts = r.json()["posts"]
    assert all(p["type"] == "question" for p in posts)


def test_posts_filter_space(s):
    r = s.get(f"{BASE_URL}/api/posts", params={"space": "integration-platform"})
    assert r.status_code == 200
    posts = r.json()["posts"]
    assert all(p["space"]["slug"] == "integration-platform" for p in posts)


def test_posts_sort_top(s):
    r = s.get(f"{BASE_URL}/api/posts", params={"sort": "top"})
    assert r.status_code == 200
    posts = r.json()["posts"]
    counts = [p["vote_count"] for p in posts]
    assert counts == sorted(counts, reverse=True)


def test_posts_unanswered(s):
    r = s.get(f"{BASE_URL}/api/posts", params={"unanswered": "true"})
    assert r.status_code == 200
    posts = r.json()["posts"]
    assert all(p["answer_count"] == 0 for p in posts)


# ---------- Auth ----------
def test_login_wrong_password(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong!"})
    assert r.status_code == 401


def test_login_success_returns_user_and_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["onboarded"] is True


def test_me_with_token(s, admin_auth):
    r = s.get(f"{BASE_URL}/api/auth/me", headers=admin_auth)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_me_without_token(s):
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


def test_check_username_taken(s):
    r = s.post(f"{BASE_URL}/api/auth/check-username", json={"username": "admin"})
    assert r.status_code == 200
    assert r.json()["available"] is False


def test_check_username_available(s):
    unique = f"newuser_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{BASE_URL}/api/auth/check-username", json={"username": unique})
    assert r.status_code == 200
    assert r.json()["available"] is True


def test_register_and_duplicate(s):
    unique = uuid.uuid4().hex[:8]
    payload = {
        "full_name": "Test User",
        "username": f"TEST_user_{unique}",
        "email": f"TEST_user_{unique}@hcmorbit.com",
        "password": "Test123!",
    }
    r = s.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["email"] == payload["email"].lower()
    assert data["user"]["onboarded"] is False
    assert "token" in data
    # Duplicate email
    r2 = s.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r2.status_code == 400


# ---------- Profile / Onboarding ----------
def test_profile_setup_flow(s):
    unique = uuid.uuid4().hex[:8]
    reg = s.post(f"{BASE_URL}/api/auth/register", json={
        "full_name": "Onboard Tester",
        "username": f"TEST_onb_{unique}",
        "email": f"TEST_onb_{unique}@hcmorbit.com",
        "password": "Test123!",
    }).json()
    token = reg["token"]
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # Not onboarded -> can't post
    r_block = s.post(f"{BASE_URL}/api/posts", headers=h, json={
        "space_slug": "core-hcm", "type": "question",
        "title": "Should be blocked title", "body": "x" * 50,
    })
    assert r_block.status_code == 403
    # Now setup
    r = s.post(f"{BASE_URL}/api/profile/setup", headers=h, json={
        "group_type": "aspirant", "workday_modules": ["Core HCM"], "years_experience": 1,
    })
    assert r.status_code == 200
    assert r.json()["onboarded"] is True
    assert r.json()["group_type"] == "aspirant"


# ---------- Post detail / answers / accept / votes ----------
@pytest.fixture(scope="session")
def sample_post_id(s):
    r = s.get(f"{BASE_URL}/api/posts")
    return r.json()["posts"][0]["id"]


def test_get_post_detail(s, sample_post_id):
    r1 = s.get(f"{BASE_URL}/api/posts/{sample_post_id}")
    assert r1.status_code == 200
    v1 = r1.json()["view_count"]
    r2 = s.get(f"{BASE_URL}/api/posts/{sample_post_id}")
    assert r2.json()["view_count"] >= v1 + 1
    assert "author" in r1.json()
    assert "space" in r1.json()


def test_get_answers_sorted(s):
    posts = s.get(f"{BASE_URL}/api/posts").json()["posts"]
    # find one with answers and accepted
    target = None
    for p in posts:
        ans = s.get(f"{BASE_URL}/api/posts/{p['id']}/answers").json()
        if ans and any(a.get("is_accepted") for a in ans):
            target = (p["id"], ans); break
    if target:
        _, ans = target
        assert ans[0]["is_accepted"] is True


def test_create_post_validation(s, elena_auth):
    # title too short
    r = s.post(f"{BASE_URL}/api/posts", headers=elena_auth, json={
        "space_slug": "core-hcm", "type": "question", "title": "short", "body": "x" * 50})
    assert r.status_code == 400
    # body too short
    r = s.post(f"{BASE_URL}/api/posts", headers=elena_auth, json={
        "space_slug": "core-hcm", "type": "question",
        "title": "A reasonably long title that passes", "body": "tiny"})
    assert r.status_code == 400


@pytest.fixture(scope="session")
def created_post(s, elena_auth):
    r = s.post(f"{BASE_URL}/api/posts", headers=elena_auth, json={
        "space_slug": "core-hcm", "type": "question",
        "title": f"TEST_ post for testing voting and accept {uuid.uuid4().hex[:6]}",
        "body": "This is a thorough test body that meets the 30 character minimum requirement.",
        "tags": ["test"],
    })
    assert r.status_code == 200, r.text
    return r.json()


def test_create_post_success(created_post):
    assert created_post["title"].startswith("TEST_")
    assert created_post["vote_count"] == 0


def test_create_answer_min_length(s, priya_auth, created_post):
    r = s.post(f"{BASE_URL}/api/posts/{created_post['id']}/answers",
               headers=priya_auth, json={"body": "too short"})
    assert r.status_code == 400


@pytest.fixture(scope="session")
def created_answer(s, priya_auth, created_post):
    r = s.post(f"{BASE_URL}/api/posts/{created_post['id']}/answers",
               headers=priya_auth, json={
                   "body": "This is a properly long answer that meets the minimum 50 character requirement for posting an answer."
               })
    assert r.status_code == 200, r.text
    return r.json()


def test_answer_increments_count(s, created_post, created_answer):
    r = s.get(f"{BASE_URL}/api/posts/{created_post['id']}")
    assert r.json()["answer_count"] >= 1


def test_vote_on_own_content_blocked(s, elena_auth, created_post):
    r = s.post(f"{BASE_URL}/api/votes", headers=elena_auth, json={
        "target_id": created_post["id"], "target_type": "post", "value": 1})
    assert r.status_code == 400


def test_vote_toggle_behavior(s, priya_auth, created_post):
    # Upvote
    r1 = s.post(f"{BASE_URL}/api/votes", headers=priya_auth, json={
        "target_id": created_post["id"], "target_type": "post", "value": 1})
    assert r1.status_code == 200
    after_up = r1.json()["new_count"]
    # Same vote -> toggle off
    r2 = s.post(f"{BASE_URL}/api/votes", headers=priya_auth, json={
        "target_id": created_post["id"], "target_type": "post", "value": 1})
    assert r2.status_code == 200
    assert r2.json()["user_vote"] == 0
    assert r2.json()["new_count"] == after_up - 1
    # Opposite vote flip from neutral -> -1
    r3 = s.post(f"{BASE_URL}/api/votes", headers=priya_auth, json={
        "target_id": created_post["id"], "target_type": "post", "value": -1})
    assert r3.status_code == 200
    assert r3.json()["user_vote"] == -1


def test_votes_me(s, priya_auth, created_post):
    r = s.get(f"{BASE_URL}/api/votes/me", headers=priya_auth,
              params={"target_ids": created_post["id"]})
    assert r.status_code == 200


def test_accept_answer(s, elena_auth, priya_auth, created_post, created_answer):
    # Non-author cannot accept
    r_block = s.post(f"{BASE_URL}/api/posts/{created_post['id']}/accept-answer",
                     headers=priya_auth, json={"answer_id": created_answer["id"]})
    assert r_block.status_code == 403
    # Author can accept
    r = s.post(f"{BASE_URL}/api/posts/{created_post['id']}/accept-answer",
               headers=elena_auth, json={"answer_id": created_answer["id"]})
    assert r.status_code == 200
    # Verify is_solved
    p = s.get(f"{BASE_URL}/api/posts/{created_post['id']}").json()
    assert p["is_solved"] is True


# ---------- Community ----------
def test_community_stats(s):
    r = s.get(f"{BASE_URL}/api/community/stats")
    assert r.status_code == 200
    d = r.json()
    for k in ("members", "posts", "answers", "active_today"):
        assert k in d and isinstance(d[k], int)
    assert d["posts"] >= 15


def test_top_contributors(s):
    r = s.get(f"{BASE_URL}/api/community/top-contributors")
    assert r.status_code == 200
    users = r.json()
    assert len(users) > 0
    reps = [u.get("reputation_score", 0) for u in users]
    assert reps == sorted(reps, reverse=True)


def test_recent_activity(s):
    r = s.get(f"{BASE_URL}/api/community/recent-activity")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_tag_cloud(s):
    r = s.get(f"{BASE_URL}/api/community/tags")
    assert r.status_code == 200
    tags = r.json()
    assert len(tags) > 0
    assert "tag" in tags[0] and "count" in tags[0]


def test_user_profile(s):
    r = s.get(f"{BASE_URL}/api/users/elena_carter")
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "elena_carter"
    assert "stats" in r.json()


def test_notifications_flow(s, elena_auth):
    r = s.get(f"{BASE_URL}/api/notifications", headers=elena_auth)
    assert r.status_code == 200
    assert "items" in r.json()
    r2 = s.post(f"{BASE_URL}/api/notifications/mark-read", headers=elena_auth)
    assert r2.status_code == 200

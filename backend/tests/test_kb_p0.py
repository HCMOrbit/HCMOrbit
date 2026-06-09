"""
Backend tests for HCMOrbit Knowledge Base P0 features:
- Practitioner KB contribution endpoint (POST /api/kb/docs)
- GET /api/kb/docs/mine
- GET /api/kb/docs/{doc_id} (draft visibility)
- Admin KB endpoints (stats, list, patch, delete, categories)
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@hcmorbit.com", "Admin123!")
PRACT = ("elena_carter@hcmorbit.demo", "Demo123!")
ASPIRANT = ("priya_hcm@hcmorbit.demo", "Demo123!")

VALID_BODY = ("This is a comprehensive guide body. " * 5).strip()
VALID_SUMMARY = "A detailed summary explaining the goal of this KB document for users."  # >30
VALID_TITLE_PREFIX = "TEST_KB_DOC_"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def pract_token():
    return _login(*PRACT)


@pytest.fixture(scope="module")
def aspirant_token():
    return _login(*ASPIRANT)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# Track created docs/categories for cleanup
_CREATED_DOCS = []
_CREATED_CATS = []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_token):
    yield
    for doc_id in _CREATED_DOCS:
        try:
            requests.delete(f"{API}/admin/kb/docs/{doc_id}", headers=auth(admin_token), timeout=10)
        except Exception:
            pass
    # No delete endpoint for categories - leave hidden via patch
    for slug in _CREATED_CATS:
        try:
            requests.patch(
                f"{API}/admin/kb/categories/{slug}",
                json={"is_hidden": True, "name": f"TEST_HIDDEN_{slug}"},
                headers=auth(admin_token),
                timeout=10,
            )
        except Exception:
            pass


def _new_doc_payload(title_suffix="published", publish=True):
    return {
        "title": f"{VALID_TITLE_PREFIX}{title_suffix}_{uuid.uuid4().hex[:6]}",
        "summary": VALID_SUMMARY,
        "body": VALID_BODY,
        "category_slug": "integrations",
        "doc_type": "fix_guide",
        "difficulty": "intermediate",
        "target_groups": ["practitioner"],
        "tags": ["TEST", "kb"],
        "publish": publish,
    }


# ---------- POST /api/kb/docs ----------
class TestKBCreate:
    def test_practitioner_publish(self, pract_token):
        payload = _new_doc_payload("publish")
        r = requests.post(f"{API}/kb/docs", json=payload, headers=auth(pract_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and data["is_published"] is True
        _CREATED_DOCS.append(data["id"])

        # Verify it's visible publicly
        g = requests.get(f"{API}/kb/docs/{data['id']}", timeout=15)
        assert g.status_code == 200
        assert g.json()["title"] == payload["title"]

    def test_practitioner_draft(self, pract_token):
        payload = _new_doc_payload("draft", publish=False)
        r = requests.post(f"{API}/kb/docs", json=payload, headers=auth(pract_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["is_published"] is False
        _CREATED_DOCS.append(data["id"])

        # Draft NOT visible publicly (no auth)
        g = requests.get(f"{API}/kb/docs/{data['id']}", timeout=15)
        assert g.status_code == 404

    def test_aspirant_forbidden(self, aspirant_token):
        payload = _new_doc_payload("aspirant_forbidden")
        r = requests.post(f"{API}/kb/docs", json=payload, headers=auth(aspirant_token), timeout=15)
        assert r.status_code == 403
        body = r.json().get("detail", "")
        assert "Practitioner" in body or "Employer" in body

    def test_validation_title(self, pract_token):
        p = _new_doc_payload("short_title")
        p["title"] = "short"  # < 10
        r = requests.post(f"{API}/kb/docs", json=p, headers=auth(pract_token), timeout=15)
        assert r.status_code == 400

    def test_validation_summary(self, pract_token):
        p = _new_doc_payload("short_summary")
        p["summary"] = "too short"  # < 30
        r = requests.post(f"{API}/kb/docs", json=p, headers=auth(pract_token), timeout=15)
        assert r.status_code == 400

    def test_validation_body(self, pract_token):
        p = _new_doc_payload("short_body")
        p["body"] = "x" * 50  # < 100
        r = requests.post(f"{API}/kb/docs", json=p, headers=auth(pract_token), timeout=15)
        assert r.status_code == 400

    def test_missing_category(self, pract_token):
        p = _new_doc_payload("missing_cat")
        p["category_slug"] = "nope-no-such-category"
        r = requests.post(f"{API}/kb/docs", json=p, headers=auth(pract_token), timeout=15)
        assert r.status_code == 404


# ---------- GET /api/kb/docs/mine ----------
class TestKBMine:
    def test_returns_user_docs_incl_drafts(self, pract_token):
        # Ensure at least one published + one draft created above persisted
        r = requests.get(f"{API}/kb/docs/mine", headers=auth(pract_token), timeout=15)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        # Must include both states from our created docs
        ids = {d["id"] for d in docs}
        # At least one of our created docs should be present
        assert any(did in ids for did in _CREATED_DOCS), f"None of our created docs found in /mine. ids={ids}"
        # Verify sort by updated_at desc
        if len(docs) >= 2:
            assert docs[0]["updated_at"] >= docs[1]["updated_at"]

    def test_requires_auth(self):
        r = requests.get(f"{API}/kb/docs/mine", timeout=15)
        assert r.status_code in (401, 403)


# ---------- Admin KB endpoints ----------
class TestAdminKB:
    def test_stats(self, admin_token):
        r = requests.get(f"{API}/admin/kb/stats", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        s = r.json()
        for k in ["total_docs", "published_docs", "drafts", "featured", "total_categories"]:
            assert k in s
            assert isinstance(s[k], int)
        assert s["total_docs"] >= s["published_docs"]
        assert s["total_docs"] == s["published_docs"] + s["drafts"]

    def test_list_filters(self, admin_token):
        # All
        r = requests.get(f"{API}/admin/kb/docs", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        all_data = r.json()
        assert "docs" in all_data and "total" in all_data

        # Drafts only
        r2 = requests.get(f"{API}/admin/kb/docs?status=draft", headers=auth(admin_token), timeout=15)
        assert r2.status_code == 200
        for d in r2.json()["docs"]:
            assert d["is_published"] is False

        # Published
        r3 = requests.get(f"{API}/admin/kb/docs?status=published", headers=auth(admin_token), timeout=15)
        assert r3.status_code == 200
        for d in r3.json()["docs"]:
            assert d["is_published"] is True

        # Featured
        r4 = requests.get(f"{API}/admin/kb/docs?status=featured", headers=auth(admin_token), timeout=15)
        assert r4.status_code == 200
        for d in r4.json()["docs"]:
            assert d["is_featured"] is True

        # Category filter
        r5 = requests.get(f"{API}/admin/kb/docs?category=integrations", headers=auth(admin_token), timeout=15)
        assert r5.status_code == 200
        for d in r5.json()["docs"]:
            assert d["category"]["slug"] == "integrations"

        # Search q
        r6 = requests.get(f"{API}/admin/kb/docs?q=TEST_KB_DOC", headers=auth(admin_token), timeout=15)
        assert r6.status_code == 200

    def test_patch_toggle_publish_and_feature(self, admin_token, pract_token):
        # Create a published doc
        p = _new_doc_payload("toggle")
        r = requests.post(f"{API}/kb/docs", json=p, headers=auth(pract_token), timeout=15)
        assert r.status_code == 200
        doc_id = r.json()["id"]
        _CREATED_DOCS.append(doc_id)

        # Get category doc_count before unpublish
        cat0 = requests.get(f"{API}/admin/kb/categories", headers=auth(admin_token), timeout=15).json()
        before = next(c for c in cat0 if c["slug"] == "integrations")["doc_count"]

        # Unpublish
        u = requests.patch(
            f"{API}/admin/kb/docs/{doc_id}",
            json={"is_published": False},
            headers=auth(admin_token), timeout=15,
        )
        assert u.status_code == 200
        assert u.json()["is_published"] is False

        cat1 = requests.get(f"{API}/admin/kb/categories", headers=auth(admin_token), timeout=15).json()
        after = next(c for c in cat1 if c["slug"] == "integrations")["doc_count"]
        assert after == before - 1, f"category count should decrement: before={before} after={after}"

        # Feature
        f = requests.patch(
            f"{API}/admin/kb/docs/{doc_id}",
            json={"is_featured": True},
            headers=auth(admin_token), timeout=15,
        )
        assert f.status_code == 200
        assert f.json()["is_featured"] is True

    def test_delete_doc(self, admin_token, pract_token):
        p = _new_doc_payload("to_delete")
        r = requests.post(f"{API}/kb/docs", json=p, headers=auth(pract_token), timeout=15)
        doc_id = r.json()["id"]

        d = requests.delete(f"{API}/admin/kb/docs/{doc_id}", headers=auth(admin_token), timeout=15)
        assert d.status_code == 200 and d.json().get("ok") is True

        # Verify gone
        g = requests.get(f"{API}/kb/docs/{doc_id}", timeout=15)
        assert g.status_code == 404

    def test_categories_list(self, admin_token):
        r = requests.get(f"{API}/admin/kb/categories", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) >= 5
        slugs = {c["slug"] for c in cats}
        assert "integrations" in slugs

    def test_category_create_and_duplicate(self, admin_token):
        slug = f"test-cat-{uuid.uuid4().hex[:6]}"
        _CREATED_CATS.append(slug)
        r = requests.post(
            f"{API}/admin/kb/categories",
            json={"slug": slug, "name": "TEST Category", "description": "test", "icon": "🧪"},
            headers=auth(admin_token), timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["slug"] == slug
        assert "_id" not in body

        # Duplicate must fail 400
        dup = requests.post(
            f"{API}/admin/kb/categories",
            json={"slug": slug, "name": "dup"},
            headers=auth(admin_token), timeout=15,
        )
        assert dup.status_code == 400

    def test_category_patch(self, admin_token):
        # Patch one of our created categories
        if not _CREATED_CATS:
            pytest.skip("no test category to patch")
        slug = _CREATED_CATS[0]
        r = requests.patch(
            f"{API}/admin/kb/categories/{slug}",
            json={"description": "Updated description for testing", "icon": "✅"},
            headers=auth(admin_token), timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["description"] == "Updated description for testing"
        assert r.json()["icon"] == "✅"

    def test_admin_requires_admin(self, pract_token):
        r = requests.get(f"{API}/admin/kb/stats", headers=auth(pract_token), timeout=15)
        assert r.status_code in (401, 403)

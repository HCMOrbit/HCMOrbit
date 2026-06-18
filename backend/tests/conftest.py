"""Shared pytest fixtures for the backend test suite."""
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


ADMIN_EMAIL = "admin@hcmorbit.com"
ADMIN_PASS = "Admin123!"
DEMO_PRAC_EMAIL = "elena_carter@hcmorbit.demo"
DEMO_PASS = "Demo123!"
DEMO_ASP_EMAIL = "priya_hcm@hcmorbit.demo"


def _login_headers(email: str, password: str) -> dict:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_auth():
    return _login_headers(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def elena_auth():
    return _login_headers(DEMO_PRAC_EMAIL, DEMO_PASS)


@pytest.fixture(scope="session")
def priya_auth():
    return _login_headers(DEMO_ASP_EMAIL, DEMO_PASS)

"""Shared core infrastructure: env config, DB client, JWT/password helpers, logger.

Imported by every route module and by server.py. Has no FastAPI dependencies
so it can be safely imported from anywhere without circular-import risk.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import bcrypt
import jwt
import certifi
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient


# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
# Use certifi's CA bundle for TLS verification — required for MongoDB Atlas
# connections on hosts (e.g. Railway) whose default trust store is missing
# the LetsEncrypt / ISRG root certificates Atlas presents.
_mongo_kwargs = {}
if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url.lower() or "ssl=true" in mongo_url.lower():
    _mongo_kwargs["tlsCAFile"] = certifi.where()
client = AsyncIOMotorClient(mongo_url, **_mongo_kwargs)
db = client[os.environ["DB_NAME"]]


# ---------- JWT / auth ----------
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, days: int = 7) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=days),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---------- Logging ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("hcmorbit")

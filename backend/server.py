"""HCMOrbit API — thin FastAPI entrypoint.

All routes are defined in route modules under `routes/`. This file:
  * creates the FastAPI app
  * mounts each router under the `/api` prefix
  * configures CORS
  * performs startup seeding (indexes, demo data, admin user, settings)
"""
import os
import uuid

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import db, client, now_iso, hash_password, log
from routes.auth import router as auth_router
from routes.community import router as community_router
from routes.kb import router as kb_router
from routes.admin import router as admin_router
from routes.feedback import router as feedback_router
from welcome_emails import process_welcome_queue
from apscheduler.schedulers.asyncio import AsyncIOScheduler


app = FastAPI(title="HCMOrbit API")
api = APIRouter(prefix="/api")

# Mount each domain router on /api
api.include_router(auth_router)
api.include_router(community_router)
api.include_router(kb_router)
api.include_router(admin_router)
api.include_router(feedback_router)


@api.get("/")
async def root():
    return {"app": "HCMOrbit", "status": "ok"}


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.spaces.create_index("slug", unique=True)
    await db.posts.create_index("id", unique=True)
    await db.answers.create_index("post_id")
    await db.votes.create_index(
        [("user_id", 1), ("target_id", 1), ("target_type", 1)],
        unique=True
    )
    await db.bookmarks.create_index([("user_id", 1), ("post_id", 1)], unique=True)
    await db.bookmarks.create_index([("user_id", 1), ("created_at", -1)])
    await db.reports.create_index([("status", 1), ("created_at", -1)])
    await db.admin_logs.create_index([("created_at", -1)])
    await db.kb_categories.create_index("slug", unique=True)
    await db.kb_docs.create_index("id", unique=True)
    await db.kb_docs.create_index([("category_id", 1), ("view_count", -1)])
    await db.kb_helpful_votes.create_index([("doc_id", 1), ("user_id", 1)], unique=True)
    # Follows
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.follows.create_index("follower_id")
    await db.follows.create_index("following_id")
    await db.kb_bookmarks.create_index([("user_id", 1), ("doc_id", 1)], unique=True)
    from seed_data import seed_all
    await seed_all(db, hash_password)
    from seed_kb import seed_kb
    await seed_kb(db)
    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_doc = await db.users.find_one({"email": admin_email})
    if not admin_doc:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "username": "admin",
            "full_name": "Admin",
            "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "avatar_url": None,
            "bio": "HCMOrbit administrator",
            "group_type": "practitioner",
            "workday_modules": [],
            "years_experience": None,
            "company_name": None,
            "location": None,
            "linkedin_url": None,
            "reputation_score": 0,
            "is_verified": True,
            "is_admin": True,
            "is_suspended": False,
            "onboarded": True,
            "auth_provider": "email",
            "created_at": now_iso(),
        })
    else:
        # Ensure existing admin has is_admin=true
        await db.users.update_one({"email": admin_email}, {"$set": {"is_admin": True}})
    # Seed default settings
    DEFAULTS = {
        "community_name": "HCMOrbit",
        "community_tagline": "Where HCM professionals connect, learn, and grow",
        "registrations_open": "true",
        "require_email_verification": "false",
        "min_rep_downvote": "0",
        "min_rep_post": "0",
    }
    for k, v in DEFAULTS.items():
        await db.settings.update_one(
            {"key": k},
            {"$setOnInsert": {"key": k, "value": v, "updated_at": now_iso()}},
            upsert=True,
        )
    log.info("Startup seeding complete")

    # Start hourly welcome-email scheduler (idempotent — guarded by per-user timestamps)
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(process_welcome_queue, "interval", hours=1, id="welcome_emails",
                      next_run_time=None, max_instances=1, coalesce=True)
    scheduler.start()
    app.state.scheduler = scheduler
    log.info("Welcome-email scheduler started (every 1h)")


@app.on_event("shutdown")
async def on_shutdown():
    sched = getattr(app.state, "scheduler", None)
    if sched:
        sched.shutdown(wait=False)
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

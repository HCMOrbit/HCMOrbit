# HCMOrbit (Tenantry) — Product Requirements Document

## Original Problem Statement
Build the MVP of HCMOrbit — an independent professional community for the HCM (Human Capital Management) ecosystem, specifically for Workday practitioners, aspirants, and employers. Structured like a technical Q&A forum (Stack Overflow + dbt Slack + Reddit), not a social network. Three principles: (1) Signal over noise, (2) Trust through community, (3) Professional credibility.

Original spec called for Next.js 14 + Supabase. Adapted to this platform's React (CRA) + FastAPI + MongoDB stack with full fidelity to the product brief.

## Architecture
- **Backend**: FastAPI on `/api`, MongoDB via Motor, JWT (PyJWT) + Emergent Google OAuth session_token (httpx)
- **Auth**: Bearer token in `Authorization` header. Stored in `localStorage` as `hcm_token`. Email/password (bcrypt) OR Google via Emergent.
- **Frontend**: React (CRA), CRACO with `@/*` alias, Tailwind, Shadcn UI components, React Router, Sonner toasts, ReactMarkdown + remark-gfm
- **Design**: Dark navy (#0A1628) + teal accent (#0D9373), DM Sans + IBM Plex Sans + IBM Plex Mono, Lucide icons
- **Database**: Collections `users`, `user_sessions`, `spaces`, `posts`, `answers`, `votes`, `comments`, `notifications`. UUID string IDs.

## User Personas
1. **Aspirants** (Teal) — Workday learners, 0–3 yrs, career changers
2. **Practitioners** (Blue) — Certified consultants, devs, architects, 3–10+ yrs
3. **Employers** (Amber) — Companies/firms hiring Workday talent

## Core Requirements (Static)
- Three group system with permanent badge display everywhere a user is mentioned
- Reputation system (+10 upvote, +25 accepted, etc.) driving trust
- 8 module-based spaces (Core HCM, Integrations, Security, Reporting, Compensation, Payroll, Financials, Career Lounge)
- 3 post types: Question, Discussion, Success Story
- Vote/accept-answer mechanics, optimistic UI
- Guest-readable, registration-gated participation

## What's Been Implemented
**2026-02 (initial MVP)**
- **Backend** (FastAPI): full auth (register/login/me/logout/check-username/Emergent OAuth), profile setup, spaces, posts (CRUD + filter/sort/unanswered/pagination), answers + comments, votes (toggle + reputation), accept-answer, notifications, community stats/top-contributors/recent-activity/tags
- **Seed data**: 8 spaces + 10 demo users + 16 demo posts. Idempotent.
- **Frontend pages**: Landing, Login, Register, Onboarding, Community Home, Post Detail, New Post, Space page, Profile page, Notifications.

**2026-02 (later in session)**
- Bookmarks (backend + UI), Search (`/search`), live vote polling, edit/delete on answers, Share buttons.
- **Admin Dashboard** (6 pages): Stats, Members, Posts, Reported Content (with reporter thank-you notifications), Spaces, Settings. Admin impersonation of users via special JWT claim.
- **Knowledge Base — read flows**: KB Home, Category pages, KB Search, Document detail (with helpful votes + bookmarks). Seeded with 6 categories and 8 documents.

**2026-02 (this session — P0 KB authoring)**
- **POST /api/kb/docs** — Practitioners/Employers can author KB docs (draft or publish). Aspirants get 403.
- **GET /api/kb/docs/mine** — list current user's KB docs (drafts + published).
- **Admin KB endpoints** — `/api/admin/kb/stats`, `/api/admin/kb/docs` (filters: status/category/q + pagination), PATCH (publish/feature/edit + adjusts category counts), DELETE (cascades helpful votes & bookmarks), categories list/create/update.
- **Frontend `/knowledge-base/new`** — 2-step contribute flow (doc type → form + markdown body with live preview + callout helper). Save draft / Publish.
- **Frontend `/admin/knowledge-base`** — Stats cards, status tabs (All/Published/Drafts/Featured), search + category filter, action menu per row (view/publish/unpublish/feature/delete), Categories panel with create + edit modal.
- KB Home shows "Contribute a document" CTA for Practitioners/Employers.
- Admin sidebar adds "Knowledge Base" entry.
- **Testing**: 17/17 new pytest tests + full frontend e2e via testing_agent (iteration_2.json). 100% pass.

## Prioritized Backlog (Phase 2+)
- P1 Full User Profile Page (`/profile/[username]`) — follower logic, paginated Questions/Answers/Reputation tabs.
- P1 Sub-badges (Contributor/Trusted/Expert) on reputation milestones.
- P1 Edit existing KB documents (author flow) — currently only admins can edit via PATCH.
- P2 Realtime updates (Mongo change streams).
- P2 Email/mention notifications.
- P2 Refactor `server.py` (1803 lines) into APIRouters: `auth.py`, `posts.py`, `kb.py`, `admin.py`.
- P2 Add `Field(max_length=...)` bounds to KBDocIn for abuse prevention.
- P2 DELETE endpoint for kb categories (currently hide-only).
- P2 Cookie consent banner overlap on /knowledge-base/new bottom action bar — move to corner toast.

## Test Credentials
See `/app/memory/test_credentials.md`

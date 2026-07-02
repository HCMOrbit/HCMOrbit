# HCMOrbit — PRD

## Original problem statement
HCMOrbit is an independent professional Q&A community for the HCM (Workday) ecosystem, serving Aspirants, Practitioners, and Employers. The MVP needs:
- Registration with role-based onboarding
- Community spaces (categories)
- Threaded Q&A, discussions, success stories
- Voting, reputation, user profiles
- Admin Dashboard (member management, moderation, impersonation, reporting)
- Knowledge Base (structured guides, references, checklists) with `.docx` ingestion
- Stack: React (CRA) + FastAPI + MongoDB

## Stack & architecture
- **Frontend**: React, Tailwind, React Router. Entry: `/app/frontend/src/App.js`.
- **Backend** (post-refactor, Feb 2026): modular FastAPI app.
  - `/app/backend/server.py` (~120 lines) — thin entrypoint, mounts routers, startup seeding
  - `/app/backend/core.py` — DB (Motor/Atlas via certifi), JWT, password hashing, logger
  - `/app/backend/schemas.py` — Pydantic models + type literals
  - `/app/backend/dependencies.py` — `get_current_user`, `require_admin`, `get_setting`, `log_admin_action`, `check_active`, `update_reputation`, `create_notification`
  - `/app/backend/routes/auth.py` — register, login, /me, OAuth callback, profile setup, user profiles
  - `/app/backend/routes/community.py` — spaces, posts, answers, votes, comments, bookmarks, notifications, community discovery, public settings, reports
  - `/app/backend/routes/kb.py` — KB categories, docs (public reads), feedback voting, bookmarks, admin-only `POST /kb/docs`
  - `/app/backend/routes/admin.py` — overview, members, post moderation, reports, spaces, KB admin CRUD, `.docx` upload, settings
  - `/app/backend/kb_docx.py` — `.docx` parser (preserved)
- **Auth**: Custom JWT. Auth-gate redirect preservation via `/app/frontend/src/lib/redirect.js`.
- **Deployment**: Railway (separate from this preview).
- **Analytics**: GA4 wired in `/app/frontend/public/index.html`.

## Implemented (chronological highlights)
- Landing page + custom homepage (Built For, Why Join, Founder, Founding Member, Featured Topics)
- Auth (register/login), `/why-hcmorbit` page, shared `SiteFooter`
- Community feed + post detail, threaded Q&A, voting, reputation
- Admin Dashboard (members, moderation, impersonation, reports)
- Knowledge Base (categories, list, search, doc viewer, bookmarks)
- KB authoring restricted to admins
- Inline `<AuthPrompt>` gating for logged-out community/KB actions
- KB thumbs-up/down voting (`POST /api/kb/docs/:id/feedback`)
- `.docx` upload parsing for KB: 11-row metadata table, duplicate `reference_id` detection, nested lists, bold/italic whitespace fixes
- KB Markdown blockquotes styled as Callouts (Note, Tip, Warning, Important)
- "What kind of post is this?" step removed from `/community/new-post`
- "Ask in Discussions" deep-link CTA from KB doc pages
- GA4 + custom favicon/title + branding cleanup
- **[Feb 2026] KBDoc layout restructure**: full-width dark hero, wider 250px sidebar with H3 indentation, anchor links with smooth scroll + active state, markdown stripped from TOC labels
- **[Feb 2026] KB table overflow**: `table-layout: fixed` with min-width cols + overflow-x scroll container, right-edge fade gradient + "← scroll →" hint that hides on scroll/8s timeout
- **[Feb 2026] KB code-block overflow**: same affordance pattern as tables, via shared `useScrollOverflowAffordance` hook (`KBTable` + `KBPre`)
- **[Feb 2026] KB sidebar sticky+scrollable**: `max-height: calc(100vh - 6rem) + overflow-y-auto`
- **[Feb 2026] KB TOC active-item auto-scroll**: `scrollIntoView({ block: 'nearest' })` on active anchor change
- **[Feb 2026] Backend refactor**: `server.py` split from ~2000 lines into `routes/` (auth, community, kb, admin) + `core.py` + `schemas.py` + `dependencies.py`; zero behavior change verified via curl + 40 pytest tests passing
- **[Feb 2026] Feedback endpoint `POST /api/feedback`**: persists submissions to MongoDB `feedback` collection AND sends Resend email notification (best-effort, non-blocking) — wired to `routes/feedback.py`. Sender `onboarding@resend.dev` (sandbox), recipient `support@hcmorbit.com` until `hcmorbit.com` domain is verified on Resend; then switch to `noreply@hcmorbit.com` → `admin@hcmorbit.com`.
- **[Feb 2026] 3-step welcome email sequence** (`/app/backend/welcome_emails.py`): Email 1 sent immediately on register (both `/auth/register` and `/auth/emergent-session` for net-new users), Email 2 at +2 days, Email 3 at +5 days. APScheduler hourly job (`process_welcome_queue`) picks up backlog; per-user timestamps (`welcome_email_{1,2,3}_sent`) guarantee idempotency. Throttled at ~3 req/sec to stay under Resend's 5/sec limit. Seed/demo (`@hcmorbit.demo`) users excluded. Sender: `suchi@hcmorbit.com` (requires `hcmorbit.com` domain verification on Resend to deliver). 5 unit tests covering templates, eligibility windows, and idempotency.
- **[Feb 2026] Ecosystem hub** `/ecosystem` (events, news, certifications) + Admin manager `/admin/ecosystem` (tabbed). RSS hourly fetch (Google News) + APScheduler auto-archive of stale events (>90 days).
- **[Feb 2026] Ecosystem destination pages** `/ecosystem/events`, `/ecosystem/news`, `/ecosystem/certifications`: dark-navy hero + breadcrumb (Home > Ecosystem > Section), reuses exported `EventCard`/`NewsRow`/`CertRow` components from `Ecosystem.jsx`, fetches public API with empty-state UX. `SectionHeader` view-all links switched to react-router `Link` for SPA navigation. Shared `EcosystemSubpageHero.jsx`. **Frontend tested by testing_agent_v3 at 100% success (8/8 acceptance criteria).**
- **[Feb 2026] Events filter bar** on `/ecosystem/events`: client-side chip filters for Type (All / RUG / Conference / Webinar) and Month (All + current month + next 3 dynamically). "Clear filters" link + dedicated "no matches" empty state. Count updates as "X of Y" when filters active. `EventCard` made tolerant of both API (`event_type`, `sponsor`, `register_url`, ISO `date` + separate `time`/`timezone`) and placeholder shapes, so the type pill + formatted date now render correctly for API-fed cards.
- **[Feb 2026] Ecosystem hub layout — full tile-grid redesign**: All three sections (`Events`, `News`, `Certs`) now use a consistent 3-col tile-grid treatment on the hub.
  - **Events**: capped at 3 on `/ecosystem` (single clean row), "View all" routes to `/ecosystem/events` for the rest.
  - **News**: replaced row list with `NewsTile` cards. RSS fetcher (`jobs/rss_fetch.py`) now extracts `image_url` from feedparser's `media_content` / `media_thumbnail` / `enclosures` / inline `<img>` (in that priority order); public news endpoint projection includes `image_url`. Tile shows og-style image when available, deterministic gradient + icon fallback when not. Source pill + date below title (line-clamp-3). Opens in new tab.
  - **Best-effort og:image scraper** (`_scrape_og_image`): runs as part of the existing 24h RSS job, only on **newly-inserted** articles when no media-field image was found. Uses `httpx.AsyncClient` with 3s timeout, follows redirects, parses `<meta property="og:image">` with a tolerant regex (handles either attribute ordering), fails silently on any error. `image_url` + `image_resolved_at` set via `$setOnInsert` so each article is scraped exactly once and never retried (per-doc permanent cache). Verified: first run scraped 60/60, second run scraped 0/0 (idempotent). 66 pytest pass.
  - **RSS sources** (`FEEDS` list): Workday Blog (XML invalid, fails gracefully), Google News (Workday HCM query), **UC Today** (`https://uctoday.com/feed/`), **HR Executive** (`https://hrexecutive.com/feed/`). UC Today and HR Executive yield ~90% og:image coverage, giving Community News a rich editorial look.
  - **Certs**: replaced row list with `CertTile` cards — large colored band (teal / amber / bright-teal) with status word (NEW / UPCOMING / RELEASED) prominently anchored, name as headline, `date_label` below.
  - `NewsRow` / `CertRow` row components preserved unchanged for the existing list-layout subpages (`/ecosystem/news`, `/ecosystem/certifications`).

## Key DB schemas
- `users`, `posts`, `comments`, `votes`, `categories`, `bookmarks`
- `kb_docs`: `{_id, category_id, title, doc_type, difficulty, target_groups, is_published, reference_id?, sub_module?, read_time?, platform?, helpful_count, not_helpful_count}`
- `kb_feedback` / `kb_helpful_votes`: `{user_id, doc_id, helpful: bool}`

## Key endpoints
- `POST /api/admin/kb/docs/upload` — `.docx` ingestion
- `POST /api/contact` — public contact form (5/IP/hr rate limit, stores to `contact_messages`, Resend email to `ADMIN_EMAIL`)
- `GET /api/admin/contact` — list contact submissions (admin)
- `PATCH /api/admin/contact/{id}` — toggle `resolved` (admin)
- `POST /api/kb/docs/{id}/feedback`, `GET /api/kb/docs/{id}/feedback`
- `POST /api/kb/bookmarks/{id}`
- Full CRUD: `/api/posts`, `/api/comments`, `/api/votes`, `/api/admin/*`, `/api/kb/*`

## Roadmap
### Recently shipped (Feb 2026)
- **Admin → Contact inbox** at `/admin/contact`: list view with topic pills, expandable rows showing full message + IP + received date, mailto quick-reply, mark resolved/reopen toggle, and Open/Resolved/All filter tabs with live counts. Backed by `GET /api/admin/contact` and `PATCH /api/admin/contact/{id}`.
- **Connect page** redesign with dark navy hero, functional contact form (5/IP/hr rate-limited), and 3 channel cards (email, community, LinkedIn). Submissions stored in `db.contact_messages` and emailed to `ADMIN_EMAIL` via Resend. Tests: `tests/test_contact_rate_limit.py` (5 passing).
- **Header redesign** to match attached reference image: two-tone "HCM"+"Orbit" wordmark, tagline beneath, taller h-20 layout, teal underline for active route, icon-only search opening a full-screen overlay, Career Hub nav item, Connect moved into About dropdown, rounded "Join Community" CTA pill, refined avatar dropdown
- New placeholder pages `/career-hub` and `/connect` (Connect is now fully functional)

### P1 — Next up
- **Industry Pulse — Phase 2 crawler** (real RSS/HTML crawler for approved public sources, robots.txt respected, scheduled nightly; the admin ingestion + approval queues are already live from Phase 1)
- Custom domain `hcmorbit.com` setup (platform-level — needs support_agent guidance)
- Admin moderation tools: post moderation actions, reporting workflows (from original PRD). *Admin impersonation removed per user request Feb 2026.*
- Production run of `migrate_seed_kb_engagement.py` against Atlas (user-driven; preview pod lacks prod `MONGO_URL`)
- Flesh out `/connect` placeholder page (contact form etc.)

### Recently shipped (Feb 2026)
- **Site-wide hero unification** — every top-level page now uses the KB hero visual language (135° navy gradient `#0a1628 → #0d2d3a`, 18px rounded card, amber `#F5B731` eyebrow, white `font-heading` title). Shared `components/PageHero.jsx` rewritten to this spec; consumers (`CommunityHome`, `Connect`, `WhyHCMOrbit`, `KBCategory`) auto-inherit. `LegalLayout` (Privacy/Terms/Cookies), `Landing.jsx`, `KBSearch`, `KBGlobalSearch`, `KBDoc`, `HeroMast` (Career Hub), `EcosystemIndustryPulse`, `EcosystemIndustryPulseCompare`, and `EcosystemSubpageHero` (News/Events/Certifications) all refactored to the same treatment. Verified across 15 routes via computed-style probes + screenshots.
- **Workday Relevance Scorer for Community News** — every crawled article now scores 0–100 at ingestion time in `services/news_scoring.py`. Signals: +50 "Workday" in title, +50 Workday-owned source, +25 approved partner + Workday mention, +10/module keyword (capped 30), +5/context keyword ("go-live", "customer", "implementation"…) capped 15, +15 "workday" in URL slug, -5/generic-tech-keyword (AI/cloud/ERP/DEI…) capped -20, -15 competitor product in title, hard cap at 25 if no Workday mention anywhere. Thresholds: ≥ 80 auto-publish, 60–79 pending admin review, < 60 reject. Scored/status frozen via `$setOnInsert` so re-fetches never re-score. Legacy docs grandfathered as `status="published"` with `workday_score=null` (one-time backfill on first refresh). New admin **News Review** tab at `/admin/ecosystem?tab=news-review` with Needs Review / Published / Rejected filters, per-article score pill, "why" breakdown reasons, and inline Approve/Reject actions. Public `/api/ecosystem/news` now filters `status="published"` only. Backend tests: `backend/tests/test_news_scoring.py` (10 passing).
- **Study Plan route retired** — standalone `/study-plan` route and page (`StudyPlan.jsx`) fully removed. Shared primitives (`T`, `Stage`, `ContentTile`, `Chip`, `cardStyle`) live in `careerNavigator/studyPlanShared.jsx` and are consumed by `InterviewTab.jsx`'s "By role" mode. Nav link removed from `NavHeader.jsx`.
- **Ecosystem → Industry Pulse dashboard v2** (`/ecosystem/industry-pulse`) — dark-navy hero, industry filter chips (8 industries), industry summary card with live KPIs, CSS-only stacked module adoption bars for 14 modules, high-demand + still-adopting sidebar cards, top trends + go-lives + hiring roles + upcoming events row. All data served from `/api/intel/industry-pulse` — zero hardcoded content in React.
- **6 new MongoDB collections** for the intelligence layer: `intel_module_scores`, `intel_go_lives`, `intel_hiring_signals`, `intel_trends`, `intel_events`, `intel_sources`, `intel_crawl_runs`. Every seeded row tagged `status: "sample_data"`; admin overrides flip to `status: "approved"` and are preserved across seed re-runs.
- **Admin CMS** at `/admin/ecosystem-intelligence` — four tabs: Sources CRUD (+ Phase-2-stub crawl trigger), Go-Lives approval queue, Events approval queue, Module Scores inline override (sum-to-100 enforced backend-side).
- **Ecosystem nav dropdown** — replaced the `/ecosystem` landing with a 3-item About-menu-style dropdown (Industry Pulse / Community News / Upcoming Events). Legacy `/ecosystem`, `/ecosystem/events`, `/ecosystem/news` all redirect to the new paths.
- **Career Hub cleaned up** — Industry Pulse tab removed from Career Hub; it now lives only under Ecosystem. Career Hub is now Home / Career paths / Interview prep.
- **Interview prep "By role" wired** — `InterviewTab.jsx` now consumes `getStudyPlan()` when view === "role", with a 6-stage roadmap, "What's included" tiles, and Recommended KB guides. Empty-state guard fixes the "4–0 hrs" bug for empty roles.
- **Study plan role model overhaul** — `ROLE_MODULE_MAP` replaced with `ROLE_AUTO_MAP` (module + subModule + technicalFocus filters, OR / wildcard / CONTAINS matching), aliased short labels preserved (`Payroll Consultant` etc.), 7 roles in the dropdown.
- **Admin impersonation removed** — backend route deleted, frontend UI + banner removed, session flag reader in `dependencies.get_current_user` left untouched by user request (dead code path only readable by legacy JWTs, which expire within 2h).

### P2 — Soon
- Add `/app/backend/tests` pytest suite for the new route structure (refresh KB tests to reflect admin-only authoring policy)

### P3 — Backlog
- Notifications (mentions, answers, follows)
- Email digests
- Tag pages / tag follow
- Search improvements (full-text on KB body)

## Credentials
See `/app/memory/test_credentials.md`.

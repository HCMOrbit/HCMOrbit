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
- Frontend: React, Tailwind, React Router. Entry: `/app/frontend/src/App.js`.
- Backend: FastAPI monolith `/app/backend/server.py` (~2000 lines), Motor/PyMongo. `python-docx` for `.docx` ingestion. `certifi` for Atlas TLS.
- Auth: Custom JWT. Auth-gate redirect preservation via `/app/frontend/src/lib/redirect.js`.
- Deployment: Railway (separate from this preview).
- Analytics: GA4 wired in `/app/frontend/public/index.html`.

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
- **[Feb 2026] KBDoc layout restructure**: full-width dark hero (edge-to-edge), wider 250px sidebar with H3 indentation, anchor links with smooth scroll + active state, markdown stripped from TOC labels

## Key DB schemas
- `users`, `posts`, `comments`, `votes`, `categories`, `bookmarks`
- `kb_docs`: `{_id, category_id, title, doc_type, difficulty, target_groups, is_published, reference_id?, sub_module?, read_time?, platform?, helpful_count, not_helpful_count}`
- `kb_feedback`: `{user_id, doc_id, helpful: bool}`

## Key endpoints
- `POST /api/admin/kb/docs/upload` — `.docx` ingestion
- `POST /api/kb/docs/{id}/feedback`, `GET /api/kb/docs/{id}/feedback`
- `POST /api/kb/bookmarks/{id}`
- Full CRUD: `/api/posts`, `/api/comments`, `/api/votes`, `/api/admin/*`, `/api/kb/*`

## Roadmap
### P1 — Next up
- Full User Profile page `/profile/[username]`: follower logic, paginated answers/questions tabs, reputation breakdown

### P2 — Soon
- Refactor `server.py` (~2000 lines) into APIRouters: `routes/auth`, `routes/community`, `routes/kb`, `routes/admin`
- Add `/app/backend/tests` pytest suite for regression

### P3 — Backlog
- Notifications (mentions, answers, follows)
- Email digests
- Tag pages / tag follow
- Search improvements (full-text on KB body)

## Credentials
See `/app/memory/test_credentials.md`.

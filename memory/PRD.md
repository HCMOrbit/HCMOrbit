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

## What's Been Implemented (2026-02)
- **Backend** (FastAPI): full auth (register/login/me/logout/check-username/Emergent OAuth), profile setup, spaces, posts (CRUD + filter/sort/unanswered/pagination), answers + comments, votes (toggle + reputation), accept-answer, notifications (list + mark-read), community stats/top-contributors/recent-activity/tags
- **Seed data**: 8 spaces + 10 demo users (4 aspirants / 4 practitioners / 2 employers) + 16 demo posts spanning all spaces with realistic answers, accepted answers, and vote counts. Idempotent on startup.
- **Frontend pages**: Landing (hero, 3-group, stats, featured spaces, recent activity, quotes, CTA), Login (email + Google), Register (4-step wizard with live username check), Onboarding (returning OAuth users), Community Home (feed with tabs/sort + sidebars), Post Detail (markdown rendering, voting, accept answer, answer composer), New Post (2-step with conditional guidance), Space page, Profile page (header + stats + tabs), Notifications.
- **Components**: GroupBadge (3 colors), PostTypeBadge, VoteComponent (vertical arrows + optimistic updates), PostCard, NavHeader (with user dropdown), CommunityLayout (sidebar + right rail), AuthCallback (Emergent OAuth bridge).
- **Testing**: 33/33 backend pytest tests passing (testing agent). Frontend e2e validated for landing, login, community, post detail, voting, spaces, profile, new-post flow.

## Prioritized Backlog (Phase 2+)
- P0 Bookmarks (UI present but no backend wiring yet)
- P0 Sub-badges (Contributor/Trusted/Expert) on reaching reputation milestones
- P1 Realtime updates via Supabase-equivalent (Mongo change streams)
- P1 Email notifications
- P1 Mentions (@username) with notifications
- P1 Edit/delete answers (by author) with edit history
- P2 Search across posts
- P2 Share/report buttons functional
- P2 Job board, freelance marketplace, mentoring (explicitly out of MVP scope)

## Test Credentials
See `/app/memory/test_credentials.md`

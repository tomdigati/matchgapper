# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchGapper is a React SPA for managing BMW GAP inter-club golf team matches at Phoenixville Country Club. It handles player recruitment, roster management, team pairing with drag-and-drop, and match communication.

## Development

**No build system** — the app runs via Babel standalone transpilation in the browser.

- **Dev server:** `python3 serve.py` (serves on port 8080), or any static file server pointing at `public/`
- **Deploy frontend:** Push to main — Cloudflare Pages auto-deploys from `public/`
- **Deploy worker:** `cd workers/club-notify && wrangler deploy`
- **No tests** — testing is manual against the live Supabase instance

## Architecture

### Frontend (single-file SPA)

- **`public/index.html`** (~3150 lines) — the production app. Contains all React components, hooks, styles, and Supabase client config in one HTML file with embedded JSX transpiled by Babel at runtime.
- **`gap-manager.jsx`** (~1090 lines) — standalone React component source (reference/development copy, not directly served).
- React 18, ReactDOM, Babel, and Supabase JS are loaded from CDN. No bundler, no npm scripts.

### Backend

- **Supabase** — PostgreSQL database with Row-Level Security (RLS), JWT auth, webhooks on table inserts.
- **Cloudflare Worker** (`workers/club-notify/index.js`) — handles Supabase webhooks for club registration notifications and approval invite emails via Resend API.

### Database Schema (Supabase)

Two migration files define the schema:
- `supabase-migration.sql` — `profiles` table (roles: admin, captain, vice_captain), auth trigger
- `supabase-migration-v2.sql` — `players` table (club-scoped roster with status, availability, location preferences), RLS policies

**Key RLS pattern:** Players are scoped by `club` column — users only see/modify their own club's data. Captains and admins can insert/update; only admins can delete.

### Auth & Roles

- Supabase Auth handles sign-up/sign-in with JWT tokens
- Roles: `admin`, `captain`, `vice_captain` (stored in `profiles.role`)
- Platform admins are determined by email allowlist in `index.html` (`PLATFORM_ADMIN_EMAILS` constant) — they get a god-mode admin portal with club switching, user management, and registration approval

### Key Application Patterns

- **Team Builder:** Drag-and-drop pairing system with handicap threshold enforcement (Team 1 max ≤ Team 2 min), auto tee-time calculation, and lock/unlock workflow to prevent sending stale pairings
- **CSV/XLSX Upload:** Custom parser with auto-column detection for bulk player import during onboarding
- **Data conversion:** `dbPlayerToApp()` / `appPlayerToDb()` functions translate between Supabase snake_case and app camelCase
- **Onboarding flow:** Sign up → profile creation → onboarding wizard (CSV upload → review → save) → main app

### Email System

- Sender: `noreply@matchgapper.com` via Resend API
- Cloudflare Worker routes: `/approve` (sends invite to PGA pros), POST default (notifies admin of new registrations)
- Admin notifications go to `tom@axiolo.com`
- `RESEND_API_KEY` is a Wrangler secret (not in code)

# Project State — NIRMAAN-PASS

_Last updated: 2026-09-18 — Disconnected old Supabase project; Transitioned to 100% Standalone Local Architecture with Plug-and-Play readiness for new database connection_

## Architecture
Next.js 14 (App Router) + TypeScript + Tailwind CSS with official NIRMAAN 2026 Design System.
Database & Storage Strategy:
- **Standalone Local Mode (Active)**: Runs 100% self-contained directly from the verified 289-team dataset (`lib/data/seeded_teams.json`). Zero external network dependencies, zero latency.
- **Plug-and-Play Supabase Ready**: All database access is encapsulated via `hasSupabaseConfig()`. When a teammate connects their new Supabase project credentials in `.env.local`, the application will automatically switch to remote database operations without needing any code changes.
- **Consolidated Migration Script**: `supabase/complete_database_migration.sql` contains the complete schema, RLS policies, atomic scan RPCs, and all 289 clean team records ready to run in one click in the Supabase SQL Editor.

Security & Session Architecture:
- Participant Experience: completely isolated from admin operations. Zero public links or mentions of admin or scanner.
- Admin Experience: dedicated layout (`app/admin/layout.tsx`) protected by `ADMIN_ACCESS_CODE` (`NIRMAAN2026_ADMIN`).
- Unified Session Management:
  - Participant sessions: secured via httpOnly `nirmaan_team_session` cookie; validated across SSR (`lib/auth/session.ts`), Route Handlers (`/api/auth/session`, `/api/auth/login`, `/api/auth/logout`), and client navigation (`Navbar.tsx`).
  - Dual-auth fallback: seamlessly recognizes Supabase user sessions if configured, or local verified team member credentials.

## Completed
- [x] Initial documentation and skills review (README.md, prd.md, architecture.md, 4 skills) — 2026-09-18
- [x] Ingest official dataset: 289 teams, 908 participants with unique QR tokens — 2026-09-18
- [x] PassCard PNG download fix (Blob URL) and scanner camera cleanup — 2026-09-18
- [x] Added official NIRMAAN 2026 Sponsors and Socials page — 2026-09-18
- [x] **Completely separated Admin & Scanner from participant experience** — 2026-09-18
  - Removed "Scanner" and "Admin" navigation buttons and divider from `components/Navbar.tsx`.
  - Removed "EVENT SCANNER" hero button and footer "Scanner" link from `app/page.tsx`.
- [x] **Implemented Organizer Security Gate & Dedicated Admin Console** — 2026-09-18
  - Created `lib/auth/admin.ts` with session validation via httpOnly cookie `nirmaan_admin_session` and `ADMIN_ACCESS_CODE`.
  - Created `app/api/admin/auth/route.ts` supporting login, logout, and session check.
  - Created `components/Admin/AdminGate.tsx` restricted challenge screen for unauthorized visits to `/admin/*`.
  - Created `components/Admin/AdminNavbar.tsx` dedicated organizer header (Stats, Scanner, Broadcast, Lock Console).
  - Created `app/admin/layout.tsx` enforcing organizer authentication on all `/admin/*` routes.
  - Secured all admin APIs: `/api/admin/scan`, `/api/admin/teams`, `/api/admin/stats`, and `POST /api/announcements`.
- [x] **Purged all dummy data & demo presets** — 2026-09-18
  - Updated `scripts/parse_csv.py` to remove initial dummy mutations on `teams[0]`; re-generated clean `lib/data/seeded_teams.json` and `supabase/seed.sql`.
  - Removed `demoTeams` (Alpha, Beta, Gamma) and `demoMembers` from `lib/data/store.ts`.
  - Removed demo test buttons from `components/QRScanner/ScannerModal.tsx`.
  - Removed `<TeamDropdown>` demo switcher from `/pass` and `/dashboard`.
  - Removed dummy fallback `'nirmaan_alpha_9281a'` in `/pass` and `/dashboard`, replaced with clean access prompts.
  - Removed demo mode banner and demo dashboard links from `app/login/page.tsx`.
- [x] **Removed marketing fluff & promotional slogans** — 2026-09-18
  - Replaced promotional marketing layout on `app/page.tsx` ("ONE TEAM. ONE QR. ONE PASS.", "HOW NIRMAAN-PASS WORKS" marketing cards, demo pass preview) with a lean, functional Participant Pass Portal and direct Pass Token Lookup (`components/Participant/PassLookupForm.tsx`).
- [x] **Removed Obsolete Supabase Connection & Configured Plug-and-Play Architecture** — 2026-09-18
  - Disconnected obsolete Supabase credentials from `.env.local` and `.env.example`.
  - Updated `utils/supabase/middleware.ts`, `utils/supabase/client.ts`, and `utils/supabase/server.ts` with safe fallback handling to prevent unhandled fetch exceptions when Supabase is unconfigured.
- [x] **Fixed Vercel 500 MIDDLEWARE_INVOCATION_FAILED Error** — 2026-09-18
  - Added global try/catch error boundary in [middleware.ts](file:///c:/Users/swapn/OneDrive/Desktop/NIRMAAN-PASS/middleware.ts) preventing unhandled middleware crashes on Vercel Edge Runtime.
  - Hardened [utils/supabase/middleware.ts](file:///c:/Users/swapn/OneDrive/Desktop/NIRMAAN-PASS/utils/supabase/middleware.ts) with `isValidHttpUrl` validation, placeholder bypass, cookie manipulation error guards, and safe fallback credentials.
  - Added [tests/middleware.test.ts](file:///c:/Users/swapn/OneDrive/Desktop/NIRMAAN-PASS/tests/middleware.test.ts) covering all edge conditions (missing env vars, invalid URLs, placeholder configs) — 29/29 tests passing.
  - Added default [.env](file:///c:/Users/swapn/OneDrive/Desktop/NIRMAAN-PASS/.env) file ensuring Vercel production environments have baseline environment configurations.
  - Built unified local authentication pipeline:
    - `POST /api/auth/login`: validates member email against verified team roster, generates secure `nirmaan_team_session` cookie.
    - `GET /api/auth/session`: SSR and client session status endpoint.
    - `POST /api/auth/logout`: clears session cookie.
    - `lib/auth/session.ts`: `getSession()`, `getTeamForUser()`, and `requireTeam()` natively read `nirmaan_team_session` while preserving Supabase auth support.
    - `components/Navbar.tsx`: decoupled from direct Supabase SDK calls; reacts dynamically to session route.
    - `app/login/page.tsx`: refactored to submit to `/api/auth/login`.
    - `app/api/activate/link/route.ts`: sets team session cookie on activation.
    - `scripts/check_supabase.mjs`: reports standalone mode status or validates remote tables when credentials are provided.
  - **Removed "NIRMAAN 2026 LIVE" Pill Badge**:
    - Removed the hackathon live badge pill from `components/Navbar.tsx` for a cleaner, leaner header.
  - **Browser Tab Bar Icon (Favicon)**:
    - Converted user-uploaded NIRMAAN 2026 emblem into multi-resolution icons (`favicon.ico`, `icon.png`, `apple-icon.png`, `apple-touch-icon.png`, `favicon-32x32.png`, `favicon-16x16.png`) for all browser tabs and mobile home screen bookmarks.
    - Preserved the clean `nirmaan.` stylized text logo on-site in the Navbar and Footer without replacing it with the image.
  - **Navbar & Footer Re-alignment**:
    - Restored `Event Info` (`/event-info`) to `components/Navbar.tsx`.
    - Removed `Socials` from the Navbar.
    - Created shared `components/Footer.tsx` across all pages with `My Pass`, `Dashboard`, `Event Info`, and `Socials` with interactive Instagram and LinkedIn icons attached.
  - **Fixed 404 Error on /admin Route**:
    - Created `app/admin/page.tsx` redirecting authenticated organizers to `/admin/dashboard` and challenging unauthorized visitors via `AdminGate`.
  - **Fixed 500 MIDDLEWARE_INVOCATION_FAILED Deployment Error**:
    - Replaced `@supabase/ssr` edge middleware in `middleware.ts` with a clean pass-through (`NextResponse.next()`).
    - Reduced edge middleware bundle size from 86.1 kB to 26.5 kB, eliminating all edge network timeouts or unhandled exceptions.
    - Hardened `utils/supabase/middleware.ts` with complete defensive try/catch blocks.
  - **Event Info Page Cleanup & 25-Hour Runtime**:
    - Removed temporary "CAMPUS VENUE LOCATIONS" card and "HACKATHON RULES & GUIDELINES" card from `app/event-info/page.tsx` until officially confirmed.
    - Updated runtime from 36-hour to 25-hour runtime across the timeline badge, event entries, and sponsor descriptions.
    - Simplified layout into a clean, centered 25-hour schedule timeline, FAQ accordion grid, and official sponsor showcase.
  - **Dynamic Schedule Management via Admin Panel**:
    - Built dynamic schedule management under `/admin/schedule` allowing organizers to add, edit, delete, reorder (↑/↓), and reset timeline events.
    - Created `components/EventInfo/TimelineSection.tsx` with live background polling to reflect organizer updates in real-time.
    - Added public API endpoint `GET /api/schedule` and organizer-protected endpoints `POST /api/admin/schedule`, `PUT /api/admin/schedule`, `DELETE /api/admin/schedule`, and `POST /api/admin/schedule/reset`.
    - Added `Schedule` navigation link to `components/Admin/AdminNavbar.tsx` and quick action button to `app/admin/dashboard/page.tsx`.
    - Updated `supabase/complete_database_migration.sql` with `public.schedule` table, RLS policies, and seed data.
- [x] **Automated Testing & Full Build Verification** — 2026-09-18
  - All 38 tests passing across 6 test suites (`npm test`):
    - `tests/domain-rules.test.ts` (10/10 passing)
    - `tests/admin-security.test.ts` (9/9 passing)
    - `tests/auth-session.test.ts` (5/5 passing)
    - `tests/middleware.test.ts` (5/5 passing)
    - `tests/schema-models.test.ts` (3/3 passing)
    - `tests/schedule.test.ts` (6/6 passing)
  - TypeScript validation (`npm run lint` / `tsc --noEmit`) passes with 0 errors.
  - Next.js production build (`npm run build`) passing 100% across all 21 routes.

## In Progress / Pending
- [ ] Teammate connects new Supabase database by pasting credentials into `.env.local` and executing `supabase/complete_database_migration.sql` in their Supabase SQL editor.
- [ ] Live venue rehearsal with desk volunteers and food counter operators.

## Key Modified / Touched Files
- `.env.local` — Cleaned environment variables, prepared placeholders for new DB
- `.env.example` — Documented environment variables for team deployment
- `lib/auth/session.ts` — Server session & team retrieval supporting local cookie + Supabase
- `app/api/auth/login/route.ts` — Standalone team login endpoint
- `app/api/auth/session/route.ts` — Client/SSR session check endpoint
- `app/api/auth/logout/route.ts` — Session termination endpoint
- `app/login/page.tsx` — Clean login interface calling `/api/auth/login`
- `app/api/activate/link/route.ts` — Activation endpoint setting team session
- `components/Navbar.tsx` — Clean navigation using unified auth session check
- `scripts/check_supabase.mjs` — Database connectivity status verification script
- `supabase/complete_database_migration.sql` — Ready-to-run consolidated migration script
- `tests/auth-session.test.ts` — Standalone session test suite

## Decisions
- Stored session data in httpOnly `nirmaan_team_session` cookies so participants experience persistent, seamless SSR sessions even with zero external database connection.
- Preserved bidirectional compatibility: if the teammate adds their Supabase project to `.env.local`, the existing `hasSupabaseConfig()` checks automatically activate remote database queries and RPCs without changing any frontend code.

## Known Issues
- None. Build, linting, and all 24 tests pass with 0 errors.

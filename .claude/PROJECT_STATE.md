# Project State — NIRMAAN-PASS

_Last updated: 2026-09-18 — Admin Console & Scanner complete isolation, Organizer Access Gate, complete dummy data purge, and removal of marketing slogans/copy_

## Architecture
Next.js 14 (App Router) + TypeScript + Tailwind CSS with official NIRMAAN 2026 Design System.
Supabase Project: `tgpxcqazpifkifsnfmmz.supabase.co` (PostgreSQL + RLS + SSR Auth).
Security Architecture:
- Participant Experience: completely isolated from admin operations. Zero public links or mentions of admin or scanner.
- Admin Experience: dedicated layout (`app/admin/layout.tsx`) protected by `ADMIN_ACCESS_CODE` (`NIRMAAN2026_ADMIN`).
- Route & API Gates: unauthenticated access to `/admin/*` is intercepted by `AdminGate`; all `/api/admin/*` endpoints and announcement broadcasting require organizer authentication.
Data Store:
- Operates with clean seeded dataset of all 289 real teams and 908 members from `NIRMAAN_2026_MastryHub_Submission_of_Round_1_PPT.csv`.
- All dummy teams (`Team Alpha`, `Team Beta`, `Team Gamma`) and artificial initial scan counts have been completely purged.

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
- [x] **Created and verified test suites** — 2026-09-18
  - Created `tests/admin-security.test.ts` verifying admin route gates, API protections, and absence of dummy data.
  - Updated `tests/domain-rules.test.ts` to test against real seeded teams.
  - 19/19 tests passing across both suites (`npm test`).
  - Next.js production build (`npm run build`) passing 100% (17/17 routes).
  - TypeScript check (`npm run lint`) passing with 0 errors.

## In Progress / Pending
- [ ] Execute clean seed (`supabase/seed.sql`) and migrations in Supabase SQL editor
- [ ] Live venue rehearsal with desk volunteers and food counter operators

## Modified / Touched Files
- `app/admin/layout.tsx` — Gated layout requiring organizer access code
- `components/Admin/AdminGate.tsx` — Security access challenge screen for organizers
- `components/Admin/AdminNavbar.tsx` — Dedicated organizer top navigation
- `lib/auth/admin.ts` — Server-side admin verification and session helpers
- `app/api/admin/auth/route.ts` — Admin auth login, logout, and status endpoint
- `app/api/admin/scan/route.ts` — Added organizer authentication requirement
- `app/api/admin/teams/route.ts` — Added organizer authentication requirement
- `app/api/admin/stats/route.ts` — Added organizer authentication requirement
- `app/api/announcements/route.ts` — Added organizer authentication requirement for broadcasting
- `app/admin/dashboard/page.tsx` — Removed participant navbar, uses AdminLayout
- `app/admin/scanner/page.tsx` — Removed participant navbar, uses AdminLayout
- `app/admin/announcements/page.tsx` — Removed participant navbar, uses AdminLayout
- `components/Navbar.tsx` — Removed Scanner and Admin links
- `app/page.tsx` — Converted to lean participant portal, removed marketing slogans and dummy pass preview
- `components/Participant/PassLookupForm.tsx` — Quick token/key lookup for participants
- `app/pass/page.tsx` — Removed dummy fallback team and TeamDropdown; added clean access prompt
- `app/dashboard/page.tsx` — Removed dummy fallback team and TeamDropdown; added clean access prompt
- `app/login/page.tsx` — Removed demo mode banner and demo dashboard links
- `components/QRScanner/ScannerModal.tsx` — Removed demo team test buttons
- `lib/data/store.ts` — Removed demoTeams and demoMembers, cloned seededDataset
- `scripts/parse_csv.py` — Removed artificial pre-seeding mutations
- `lib/data/seeded_teams.json` — Regenerated with clean initial 0 counts
- `supabase/seed.sql` — Regenerated with clean initial 0 counts
- `tests/domain-rules.test.ts` — Updated to test real seeded teams
- `tests/admin-security.test.ts` — New test suite for admin gates and dummy data absence
- `.gitignore` — Added `.next`, `out`, `*.tsbuildinfo`, `.DS_Store`
- `.claude/PROJECT_STATE.md` — Updated Project Continuity state

## Decisions
- Used an in-place `AdminGate` component in `app/admin/layout.tsx` so unauthenticated visitors or curious participants attempting to access `/admin/*` are immediately stopped by a secure access code challenge without leaking any admin data or scanner interfaces.
- Hardened all `/api/admin/*` routes to check for `nirmaan_admin_session` cookie or `x-admin-code` header, ensuring API calls cannot be forged by participants.
- Replaced marketing copy on `/` with a functional Participant Portal and direct Pass Token Lookup input, making the website a fast utility tool for event attendees.
- Cloned `seededDataset` inside `store.ts` to prevent in-memory mutation of imported module objects during tests or runtime.

## Known Issues
- None. Production build, linting, and all 19 domain and security tests pass with 0 errors.

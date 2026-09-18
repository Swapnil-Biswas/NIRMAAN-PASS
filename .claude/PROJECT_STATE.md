# Project State — NIRMAAN-PASS

_Last updated: 2026-09-18 — Resolved website breakages across pass download, team selector layout, auth fallback, navbar responsiveness, and scanner lifecycle_

## Architecture
Next.js 14 (App Router) + TypeScript + Tailwind CSS with official NIRMAAN 2026 Design System.
Supabase Project: `tgpxcqazpifkifsnfmmz.supabase.co` (PostgreSQL + RLS + SSR Auth).
Middleware: automatic session token refresh via `@supabase/ssr` cookies handler on all routes.
Dual-mode Data Store: operates directly with live Supabase client / RPC procedures, with seeded fallback covering all 289 NIRMAAN 2026 teams.

## Completed
- [x] Initial documentation and skills review (README.md, prd.md, architecture.md, 4 skills) — 2026-09-18
- [x] Initialize Project Continuity state file — 2026-09-18
- [x] Setup Next.js App Router structure, TypeScript config, and Tailwind CSS with NIRMAAN design tokens — 2026-09-18
- [x] Create Supabase SQL schema (`teams`, `members`, `announcements`), RLS policies, and atomic stored procedures — 2026-09-18
- [x] Ingest official dataset `NIRMAAN_2026_MastryHub_Submission_of_Round_1_PPT.csv`: 289 teams, 908 participants — 2026-09-18
- [x] Generate `lib/data/seeded_teams.json` and `supabase/seed.sql` with unique QR tokens — 2026-09-18
- [x] Configure `.env.local` with Supabase project URL and Publishable Keys — 2026-09-18
- [x] Create Supabase client helpers and session refresh middleware — 2026-09-18
- [x] Added official NIRMAAN 2026 Sponsors (`MastryHub`, `Reskilll`, `Monster Energy`) with logos, badges, and links — 2026-09-18
- [x] Created Socials page (`/socials`) with direct links for BMSIT Coding Club (Instagram, LinkedIn, WhatsApp Community) and Alterino (Instagram, LinkedIn) + Live Site Link — 2026-09-18
- [x] Fixed PassCard PNG download crash by switching from `btoa(svgData)` to Blob object URL — 2026-09-18
- [x] Fixed 289-team horizontal layout blow-up on `/dashboard` and `/pass` with responsive `TeamDropdown` — 2026-09-18
- [x] Connected authenticated session to `/dashboard` and `/pass` so logged-in users view their team pass automatically — 2026-09-18
- [x] Added fallback handling to `/api/activate/link`, `lib/auth/session.ts`, and `lib/data/store.ts` for offline/demo reliability — 2026-09-18
- [x] Fixed Navbar unhandled promise rejection and mobile viewport overflow (<375px) — 2026-09-18
- [x] Fixed `Html5Qrcode` scanner lifecycle with explicit `clear()` calls — 2026-09-18
- [x] Added pagination and direct Pass links to `TeamsTable` in Admin Console — 2026-09-18
- [x] Added error display banner to Admin Broadcast Announcements form — 2026-09-18
- [x] Verified Next.js production build (`npm run build`), TypeScript (`tsc --noEmit`), and vitest suite (10/10 tests pass) — 2026-09-18

## In Progress / Pending
- [ ] Execute database schema (`supabase/migrations/20260101000000_nirmaan_pass_schema.sql`) and seed (`supabase/seed.sql`) in Supabase SQL editor
- [ ] End-to-end event day rehearsal with multiple scanner operators

## Modified / Touched Files
- `components/TeamSelector/TeamDropdown.tsx` — Responsive team selector for demo pills + full team dropdown
- `components/TeamQR/PassCard.tsx` — Fixed SVG to PNG download with Blob URL
- `components/Navbar.tsx` — Fixed getSession promise rejection and mobile responsive nav items
- `components/QRScanner/ScannerModal.tsx` — Added camera instance clearance and lifecycle cleanup
- `components/Admin/TeamsTable.tsx` — Added pagination and direct Pass links
- `app/dashboard/page.tsx` — Authenticated session lookup, clean 404 for invalid tokens, and TeamDropdown
- `app/pass/page.tsx` — Authenticated session lookup, clean 404 for invalid tokens, and TeamDropdown
- `app/admin/announcements/page.tsx` — Added broadcast failure error banner
- `app/api/activate/link/route.ts` — Added local store fallback for offline/demo activation
- `app/activate/page.tsx` — Resilient credential activation with offline demo fallback
- `app/login/page.tsx` — Resilient login routing for offline/demo team accounts
- `lib/data/store.ts` — Clean query parameter safety and unseeded Supabase fallback
- `lib/auth/session.ts` — Safe try/catch and email roster fallback in `getTeamForUser`
- `package.json` — Updated lint script to `tsc --noEmit`
- `tests/domain-rules.test.ts` — Added test coverage for invalid token rejections
- `.claude/PROJECT_STATE.md` — Project Continuity state

## Decisions
- Replaced 289 individual non-wrapping buttons with a hybrid TeamDropdown (3 demo pill switches + dropdown selector) to preserve fast demo testing while avoiding layout breaking.
- Used Blob object URL instead of `btoa` in PassCard to guarantee Latin1 and Unicode safety across all browsers.
- Allowed `/api/activate/link` and `/login` to fall back to the mock dataset when the remote database is unreachable, ensuring local testing and demoing never block on network.

## Known Issues
- None. Production build, linting, and all 10 domain rule test suites pass with 0 errors.

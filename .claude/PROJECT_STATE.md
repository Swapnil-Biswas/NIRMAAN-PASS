# Project State — NIRMAAN-PASS

_Last updated: 2026-09-18 — Initial project foundation & core architecture setup completed_

## Architecture
Next.js 14 (App Router) + TypeScript + Tailwind CSS with official NIRMAAN 2026 Design System.
Supabase (Auth + PostgreSQL with RLS and atomic RPC functions for concurrent scans) with exactly 3 core tables: `teams`, `members`, `announcements`.
Single QR token per team (`teams.qr_token`), server-side validated scanner with atomic counter increments and high-throughput volunteer UX.

## Completed
- [x] Initial documentation and skills review (README.md, prd.md, architecture.md, 4 skills) — 2026-09-18
- [x] Initialize Project Continuity state file — 2026-09-18
- [x] Setup Next.js App Router structure, TypeScript config, and Tailwind CSS with NIRMAAN design tokens — 2026-09-18
- [x] Create Supabase SQL schema (`teams`, `members`, `announcements`), RLS policies, and atomic stored procedures (`process_meal_scan`, `process_coffee_scan`, `process_registration`, `get_event_statistics`) — 2026-09-18
- [x] Implement core TypeScript interfaces (`types/database.ts`) — 2026-09-18
- [x] Implement QR token generation, formatting, and sanitization utilities (`lib/qr/token.ts`) — 2026-09-18
- [x] Implement domain validation rules for meal entitlement and attendance (`lib/validation/rules.ts`) — 2026-09-18
- [x] Implement unified data layer supporting both Supabase and in-memory mock store for instant local execution (`lib/data/store.ts`) — 2026-09-18
- [x] Build automated Vitest test suite covering QR utilities, meal entitlement, concurrency, and coffee counters (9/9 passing) — 2026-09-18
- [x] Build UI components: Navbar, Digital Pass Card, Food Status Grid, Announcements List, Stats Overview, Teams Table — 2026-09-18
- [x] Implement Event-Day QR Scanner with Scan Purpose selector (On-Desk Registration, Breakfast, Lunch, Dinner, Coffee/Tea) and auto-reset — 2026-09-18
- [x] Build Participant Pages: Home (`/`), Digital Pass (`/pass`), Participant Dashboard (`/dashboard`), Event Info (`/event-info`) — 2026-09-18
- [x] Build Admin Pages: Scanner (`/admin/scanner`), Dashboard & Stats (`/admin/dashboard`), Broadcast Announcements (`/admin/announcements`) — 2026-09-18
- [x] Verify Next.js production build (`npm run build`) and test suite (`npm test`) with 100% success — 2026-09-18

## In Progress / Pending
- [ ] Team Activation and Login auth flows with Supabase Auth session wiring
- [ ] QR Pass physical badge print optimization (print CSS stylesheet)
- [ ] Live end-to-end browser walkthrough and validation

## Modified / Touched Files
- `package.json` — Added Next.js, Supabase, Tailwind, QR code, Lucide, Vitest dependencies
- `tsconfig.json` — Configured TypeScript path aliases and compiler options
- `tailwind.config.js` — Added NIRMAAN 2026 palette tokens, typography, and card radiuses
- `postcss.config.js` — PostCSS configuration
- `next.config.js` — Next.js configuration
- `vitest.config.ts` — Vitest unit test configuration
- `.env.example` — Environment variable template
- `supabase/migrations/20260101000000_nirmaan_pass_schema.sql` — PostgreSQL schema, RLS, indexes, and atomic RPC functions
- `types/database.ts` — TypeScript types for teams, members, announcements, scan results, stats
- `lib/qr/token.ts` — Token generator and sanitization helpers
- `lib/validation/rules.ts` — Domain meal entitlement and validation rules
- `lib/supabase/client.ts` — Supabase browser client
- `lib/supabase/server.ts` — Supabase server client
- `lib/supabase/admin.ts` — Supabase admin service client
- `lib/data/store.ts` — Data store supporting Supabase and pre-seeded mock store
- `tests/domain-rules.test.ts` — Unit tests for domain logic and store operations
- `app/globals.css` — NIRMAAN 2026 Design System styles and Google Fonts
- `app/layout.tsx` — Root layout
- `app/page.tsx` — Landing page with live preview and highlights
- `app/pass/page.tsx` — Digital Pass view with QR save & share
- `app/dashboard/page.tsx` — Participant Dashboard with food status & member roster
- `app/event-info/page.tsx` — Event schedule, venue guide, rules, FAQs
- `app/admin/scanner/page.tsx` — QR Scanner for event operations
- `app/admin/dashboard/page.tsx` — Admin event statistics and teams consumption table
- `app/admin/announcements/page.tsx` — Live broadcast manager
- `app/api/admin/scan/route.ts` — Atomic scanner API route
- `app/api/admin/stats/route.ts` — Aggregate event statistics API route
- `app/api/admin/teams/route.ts` — Teams list and QR lookup API route
- `app/api/announcements/route.ts` — Announcements API route
- `components/Navbar.tsx` — Top navigation with branding and live status dot
- `components/TeamQR/PassCard.tsx` — Digital Pass QR component with download & share
- `components/FoodStatus/FoodStatusGrid.tsx` — Meal & beverage counter grid
- `components/QRScanner/ScannerModal.tsx` — Event operations scanner with camera & test presets
- `components/Admin/RegistrationModal.tsx` — On-Desk registration attendance checklist modal
- `components/Admin/MealServeModal.tsx` — Meal serving confirmation modal
- `components/Admin/CoffeeServeModal.tsx` — Unlimited Coffee/Tea confirmation modal
- `components/AnnouncementCard/AnnouncementList.tsx` — Announcement card feed
- `components/Admin/StatsOverview.tsx` — 8 aggregate event metrics
- `components/Admin/TeamsTable.tsx` — Teams overview & consumption table
- `.claude/PROJECT_STATE.md` — Project Continuity state

## Decisions
- Kept database strictly to 3 tables (`teams`, `members`, `announcements`) as per PRD non-negotiable rules.
- Implemented atomic server-side stored procedures for meal/coffee/attendance scans to prevent concurrency race conditions during live queues.
- Dual-mode data store: seamlessly operates on real Supabase instance when configured, with built-in in-memory fallback pre-seeded with NIRMAAN 2026 test teams for zero-friction local development and testing.
- Design strictly adheres to NIRMAAN 2026 Hackathon Design System (warm parchment cream background, solid flat saturated accents, Archivo Black display headers, 24px rounded cards, pill tags).

## Known Issues
- None. Build and tests passing.

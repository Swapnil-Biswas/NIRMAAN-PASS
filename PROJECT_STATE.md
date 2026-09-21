# PROJECT_STATE.md — NIRMAAN-PASS System State & Architecture

> **Last Updated:** September 2026  
> **Status:** Production-Ready / Deployed & Tested  
> **Repository:** `NIRMAAN-PASS`  
> **Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React, Supabase PostgreSQL / Mock DB Fallback, `html5-qrcode`, `qrcode.react`.

---

## 📌 1. Project Overview & Core Philosophy

**NIRMAAN-PASS** is the digital pass and event-day operations management system for **NIRMAAN 2026** — a 25-hour national-level hackathon organized by **Coding Club BMSIT** and **Alterino BMSIT**.

### Core Architecture Principle:
> **"One Team. One QR. Clear Stage Separation."**

1. **Stage 1: Pre-Event Registration Review & Approval**
   - Participants register their team details.
   - The anti-duplicate detection engine flags suspicious changes, duplicate emails, phones, names, or multiple login IDs.
   - Teams enter a **Pending Approval** or **Flagged Review** state.
   - **QR passes are withheld/gated** until organizers inspect and approve the registration in the Admin Console.
   - Once approved, the team's official **Digital QR Pass** is unlocked on their pass view and dashboard.

2. **Stage 2: Event-Day On-Desk Registration & Attendance Check-In**
   - Participating teams present their approved digital QR pass at the BMSIT registration desk on event day.
   - Desk staff scan the QR code via the **High-Speed Queue Scanner** (`/admin/scanner`).
   - Staff mark physical attendance (**Present** / **Absent**) for each registered member.
   - The verified present headcount caps meal allocations (Breakfast, Lunch, Dinner) while coffee/tea remains unlimited.

---

## 🚀 2. Recent Updates & Changelog

### 🎨 2.1 Organizer Branding & Logos
- Integrated official high-resolution logos for organizing bodies in `public/organizers/`:
  - **Coding Club BMSIT** (`/organizers/coding-club.png`)
  - **Alterino BMSIT** (`/organizers/alterino.jpg`)
- Added dedicated `OrganizersSection` to the Homepage (`/`), Event Info (`/event-info`), Socials (`/socials`), and Footer (`Footer.tsx`).

### 🛡️ 2.2 Strict Separation of Registration Approval vs. On-Desk Registration
- Removed confusing inline "Check-In" buttons from the main administrative team table.
- Clarified column hierarchy in `TeamsTable.tsx`:
  - **Team & College** (Name, institution, duplicate detection notes)
  - **Registration Status** (`PENDING APPROVAL`, `REVIEW REQUIRED (FLAGGED)`, `APPROVED`, `REJECTED`, `MERGED`)
  - **On-Desk Check-In (Event Day)** (`Checked In: X/Y Present` vs `Not Checked In`)
  - **Meal Consumption Logs** (Breakfast, Lunch, Dinner, Coffee)
  - **Actions** (`Review & Approve` for pending/flagged passes, `View Pass ➔`)

### 🔲 2.3 Official Circular N 2026 QR Emblem & Website Palette Integration
- **Preserved Official Center Emblem**: Integrated the official circular **`N 2026`** emblem ([`lib/brand/qrLogo.ts`](file:///Users/arnavpaniya/NIRMAAN-PASS/lib/brand/qrLogo.ts)) featuring the architectural `N`, gold `20`, black `26`, and subtle crosshairs.
- **Website Palette Matching**: The QR code background is set to the official website cream color (`#F1EBDD` / `--nirmaan-cream`) with black modules (`#141414` / `--nirmaan-black`) in [`PassCard.tsx`](file:///Users/arnavpaniya/NIRMAAN-PASS/components/TeamQR/PassCard.tsx).
- **High-Resolution PNG Download**: Configured pass downloads to export with the matching `#F1EBDD` background and crisp centered circular emblem.
- **Removed Token ID**: Kept all raw token ID strings hidden from participant cards for a clean, secure presentation.

### 📱 2.4 Mobile Navbar & Front-and-Center Scanner Viewport
- **Mobile Navbar Fix**: Resolved horizontal overflow and element squishing in `AdminNavbar.tsx` on narrow screens (down to 320px).
- **Streamlined Mobile Scanner UI**: Upgraded the mode selector bar (`[Registration]`, `[Breakfast]`, `[Lunch]`, `[Dinner]`, `[Coffee]`) with proper horizontal breathing room, rounded-full pills, clean `border-2 border-nirmaan-black` outlines, and zero text/pill clipping on mobile and desktop viewports in [`ScannerModal.tsx`](file:///Users/arnavpaniya/NIRMAAN-PASS/components/QRScanner/ScannerModal.tsx).
- **Front-and-Center Viewfinder**: Camera viewport and single-tap controls are positioned directly below the selector pills without requiring scrolling.
- **Removed Manual Token Lookup**: Focused the scanner interface strictly on rapid camera scanning.

### 🔒 2.5 Full Production Security Hardening & Audit Complete
- **HMAC-SHA256 Cryptographic Session Tokens**: Replaced plaintext JSON cookies with tamper-proof HMAC-SHA256 signed session tokens (`v1.<payload>.<sig>`) for both `nirmaan_team_session` and `nirmaan_admin_session`. Enforced constant-time signature verification with `crypto.timingSafeEqual`.
- **IDOR Elimination**: Hardened `/api/team/update` to strictly require verified session `teamId` matching the target team, preventing unauthorized edits across teams.
- **Account Takeover Prevention**: Secured `/api/activate/link` against duplicate claim attempts on already activated teams.
- **Sliding-Window In-Memory Rate Limiting**: Deployed rate limiters on `/api/auth/login`, `/api/admin/auth`, `/api/admin/scan`, `/api/register`, and `/api/activate/link`.
- **Defense-In-Depth Security Headers**: Configured HSTS, CSP, X-Content-Type-Options (`nosniff`), X-Frame-Options (`SAMEORIGIN`), X-XSS-Protection, Referrer-Policy, and Permissions-Policy across `next.config.js` and `middleware.ts`.
- **Automated Security Test Suite**: Added `tests/security-audit.test.ts` bringing the test suite to **66 passing tests** across 8 test suites. Zero build or TypeScript errors.

### 🧹 2.6 Codebase Optimization & Dead Asset Cleanup
- **Removed Redundant Image Assets**: Eliminated unused test raster files (`public/brand/nirmaan-emblem.jpg`, `public/brand/nirmaan-emblem-original.jpg`, `public/brand/qr-center-logo-180.png`, `public/brand/qr-logo-160.png`, `public/assets/nirmaan-logo.png`, duplicate `public/assets/favicon.ico`).
- **Eliminated Dead Boilerplate**: Removed unused `utils/` directory and consolidated Supabase middleware under [`lib/supabase/middleware.ts`](file:///Users/arnavpaniya/NIRMAAN-PASS/lib/supabase/middleware.ts).
- **Removed Deprecated Components**: Removed obsolete demo `components/TeamSelector/`.
- **Clean Architecture Verified**: 100% test pass rate (`66/66` tests across 8 test suites) and optimized Next.js 14 production build.

---

## 🗂️ 3. Application Directory Map

```text
/Users/arnavpaniya/NIRMAAN-PASS/
├── app/
│   ├── activate/page.tsx           # Account activation & team access linking
│   ├── admin/
│   │   ├── announcements/page.tsx  # Broadcast management console
│   │   ├── dashboard/page.tsx      # Organizer statistics overview & Teams Table
│   │   ├── dashboard/pass/page.tsx # Admin team pass viewer & switcher
│   │   ├── layout.tsx              # Admin layout & session protection guard
│   │   ├── scanner/page.tsx        # High-speed queue scanner page
│   │   └── schedule/page.tsx       # Hackathon timeline management
│   ├── api/
│   │   ├── activate/               # Team token link & verify API
│   │   ├── admin/auth/             # Admin authentication & logout
│   │   ├── admin/scan/             # QR scanner lookup & transaction processing
│   │   ├── admin/schedule/         # Schedule API
│   │   ├── admin/stats/            # Live aggregate statistics
│   │   ├── admin/teams/review/     # Registration approval, reject & merge API
│   │   ├── announcements/          # Broadcast notifications API
│   │   ├── auth/                   # Session login/logout APIs
│   │   ├── register/               # Team registration & duplicate validation
│   │   └── team/update/            # Team details edit API
│   ├── dashboard/page.tsx          # Participant team dashboard & meal tracking
│   ├── event-info/page.tsx         # Schedule, FAQs, venue guide & organizers
│   ├── login/page.tsx              # Team leader email magic lookup & login
│   ├── pass/page.tsx               # Dedicated digital pass view
│   ├── register/page.tsx           # Multi-track team registration
│   ├── socials/page.tsx            # Organizing clubs & social channels
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Landing page & quick pass lookup
├── components/
│   ├── Admin/
│   │   ├── AdminNavbar.tsx         # Organizer navigation bar
│   │   ├── AdminTeamPreview.tsx    # Admin team inspector
│   │   ├── CoffeeServeModal.tsx    # Quick coffee serve modal
│   │   ├── MealServeModal.tsx      # Meal serving modal with portion cap
│   │   ├── RegistrationModal.tsx   # Physical attendance (Present/Absent) check-in
│   │   ├── StatsOverview.tsx       # Live stats metrics cards
│   │   └── TeamsTable.tsx          # Core teams management & review table
│   ├── Organizers/
│   │   └── OrganizersSection.tsx   # Coding Club & Alterino showcase cards
│   ├── QRScanner/
│   │   └── ScannerModal.tsx        # Front-and-center queue scanner & mode selector
│   ├── Sponsors/
│   │   └── SponsorGrid.tsx         # Official partner sponsors grid
│   ├── TeamQR/
│   │   └── PassCard.tsx            # Digital QR pass card & SVG/canvas download
│   ├── Footer.tsx                  # Footer with organizer attributions
│   └── Navbar.tsx                  # Responsive participant navbar
├── lib/
│   ├── auth/                       # Admin & participant session helpers
│   ├── brand/                      # QR logo vector data URI
│   ├── data/store.ts               # Unified data access layer (Supabase + fallback)
│   ├── qr/token.ts                 # QR token sanitization & payload generation
│   ├── registration.ts             # Validation & duplicate detection algorithms
│   └── supabase/                   # Supabase clients (client, server, admin)
├── public/
│   ├── organizers/                 # Official club logos (coding-club.png, alterino.jpg)
│   └── sponsors/                   # Sponsor brand assets
└── types/
    └── database.ts                 # TypeScript types (Team, Member, ScanPurpose, etc.)
```

---

## 💾 4. Database Schema & Data Models

### 4.1 `teams` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `team_name` | `TEXT` | Registered Team Name |
| `canonical_name` | `TEXT` | Lowercase alphanumeric sanitized name |
| `college` | `TEXT` | Institution / College Name |
| `track` | `TEXT` | Hackathon Problem Track |
| `qr_token` | `TEXT` | Secure unique 64-char QR Token |
| `review_status` | `TEXT` | `'pending' \| 'approved' \| 'flagged_duplicate' \| 'merged' \| 'rejected'` |
| `duplicate_notes`| `TEXT` | Reason flag details for suspicious registrations |
| `duplicate_match_team_id` | `UUID` | Matched collision team ID (if applicable) |
| `merged_into_team_id` | `UUID` | Target team ID if merged |
| `checked_in` | `BOOLEAN` | Event-day physical on-desk check-in status |
| `breakfast_count` | `INT` | Total breakfast servings claimed |
| `lunch_count` | `INT` | Total lunch servings claimed |
| `dinner_count` | `INT` | Total dinner servings claimed |
| `coffee_count` | `INT` | Total coffee/tea cups claimed |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Timestamps |

### 4.2 `members` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary Key |
| `team_id` | `UUID` | Foreign Key to `teams.id` |
| `name` | `TEXT` | Member Full Name |
| `email` | `TEXT` | Unique normalized email address |
| `phone` | `TEXT` | Contact phone number |
| `is_leader` | `BOOLEAN` | Team leader indicator |
| `present` | `BOOLEAN` | Verified physical attendance at venue desk |

---

## 🔒 5. Security & Duplicate Prevention Rules

1. **Hard Collision Blocks**:
   - Duplicate email address registered in another team.
   - Duplicate contact phone number registered in another team.
   - Exact canonical team name from the same college.
2. **Suspicious / Flagged Review Checks**:
   - 2 or more overlapping member names from the same college.
   - $\ge 82\%$ team name similarity from the same college.
   - Identical team name from a different institution.
3. **Pass Security**:
   - Raw tokens are never displayed in participant-facing UI.
   - QR payloads use structured URI schemes (`nirmaan:pass:<token>`).
   - Scan APIs strictly require admin session authorization.

---

## 🧪 6. Verification & Build Status

- **Next.js Production Build**: `npm run build` passes with zero lint, type, or runtime bundling errors.
- **Static Pages Generated**: All 24 dynamic and static routes compiled.
- **Responsive Layouts**: Verified for desktop (>1024px), tablet (768px), and mobile (320px–420px).

# NIRMAAN-PASS

> Digital Participant Pass & Event Operations System for NIRMAAN 2026

NIRMAAN-PASS is a web application built for **NIRMAAN 2026**, a
national-level hackathon. It provides every participating team with a
single digital QR pass and gives organizers a centralized system to
manage event-day registration, attendance, meals, coffee/tea
consumption, announcements, and final event statistics.

The system is designed around one simple idea:

> **One team. One QR. One simple event-day pass.**

------------------------------------------------------------------------

## ✨ Features

### 👥 Participant Features

-   Secure team account activation and login
-   Team profile management
-   Member details management
-   One QR code generated per team
-   Save QR to device
-   Share QR with all team members
-   View event-day registration status
-   View breakfast, lunch, dinner, and coffee/tea status
-   View announcements
-   View event schedule, venue, rules, and important information

### 🛠️ Admin Features

-   Secure admin dashboard
-   QR scanner optimized for event-day operations
-   Scan Purpose selector:
    -   On-Desk Registration
    -   Breakfast
    -   Lunch
    -   Dinner
    -   Coffee / Tea
-   Individual member attendance marking during registration
-   Attendance correction by authorized staff
-   Meal serving validation
-   Unlimited coffee/tea consumption tracking
-   Team-wise statistics
-   Overall event statistics
-   Announcement management

------------------------------------------------------------------------

## 📱 One QR for Every Team

NIRMAAN-PASS uses **one QR code per team**.

The same QR is used for:

``` text
On-Desk Registration
       ↓
Breakfast
       ↓
Lunch
       ↓
Dinner
       ↓
Coffee / Tea
```

The QR identifies the team through a secure token. It should not contain
plaintext member names, phone numbers, or email addresses.

### Participant instruction

> **Every team member must show the team QR when collecting meals or
> beverages. Share this QR with all your team members and keep it easily
> accessible on your phone.**

Members do not need separate QR codes.

------------------------------------------------------------------------

## 🍽️ Food Tracking Logic

Breakfast, lunch, and dinner are limited by the number of team members
marked present during on-desk registration.

For example:

``` text
Team Members Registered = 4
Members Present         = 4

Breakfast Limit = 4
Lunch Limit     = 4
Dinner Limit    = 4
```

If two members eat lunch first:

``` text
Lunch = 2/4
```

The other two members can come later and use the same team QR:

``` text
Lunch = 3/4
Lunch = 4/4
```

The system does **not** require members to arrive together or identify
which individual ate.

### Important rule

**Attendance establishes meal entitlement. Food scans record actual
servings.**

If 4 members are present but only 3 take dinner:

``` text
Dinner = 3/4
```

The unused serving remains unused.

------------------------------------------------------------------------

## ☕ Coffee / Tea Tracking

Coffee/tea is intentionally **unlimited**.

There is no per-team or per-member limit.

The system only records the total number of cups served to each team.

Example:

``` text
Team A → 15 cups
Team B → 19 cups
Team C → 11 cups
```

If Team A receives another cup:

``` text
15 → 16
```

The same team QR is scanned each time.

The system does not need to record:

-   Which member took the cup
-   The exact time
-   Whether the cup was tea or coffee

The final event total can be calculated by adding all team coffee
counts.

------------------------------------------------------------------------

## 🧾 Event-Day Registration

At the registration desk:

1.  Select **On-Desk Registration**.
2.  Scan the team's QR.
3.  View the registered members.
4.  Tick the members who are physically present.
5.  Confirm registration.
6.  The selected members are marked `present = true`.
7.  The team's meal entitlement is automatically based on this
    attendance.

Example:

``` text
Team Alpha

☑ Member 1
☑ Member 2
☑ Member 3
☐ Member 4

Present: 3/4
```

If the team is scanned again for registration, authorized staff can use
**Edit Attendance**.

Food volunteers should not change attendance.

------------------------------------------------------------------------

## 📊 Event Statistics

At the end of NIRMAAN 2026, organizers can obtain both team-wise and
overall statistics.

### Team-level

``` text
Team A
├── Present: 4
├── Breakfast: 4
├── Lunch: 4
├── Dinner: 3
└── Coffee/Tea: 15
```

### Event-level

``` text
Total Students Present: 187

Breakfast Served: 181
Lunch Served:     184
Dinner Served:    179

Total Coffee/Tea Cups: 642
```

These totals are calculated from the existing attendance and consumption
counters. A separate statistics table is not required.

------------------------------------------------------------------------

## 🏗️ Architecture

NIRMAAN-PASS follows a lightweight architecture:

``` text
                    NIRMAAN-PASS
                          │
              ┌───────────┴───────────┐
              │                       │
       Participant App           Admin App
              │                       │
              └───────────┬───────────┘
                          │
                     API / Server
                          │
             ┌────────────┼────────────┐
             │            │            │
       Authentication   Database    QR Validation
             │            │            │
         Supabase      PostgreSQL   Secure Token
```

### Core database tables

Only three application tables are required:

``` text
teams
members
announcements
```

Authentication is handled separately by the authentication provider.

### `teams`

``` text
id
team_name
college
auth_id
qr_token
checked_in
breakfast_count
lunch_count
dinner_count
coffee_count
```

### `members`

``` text
id
team_id
name
phone
email
present
```

### `announcements`

``` text
id
title
message
priority
published
```

The database intentionally avoids unnecessary tables for:

-   QR records
-   Scan history
-   Meal transactions
-   Timing logs
-   Coffee transactions

The counters are sufficient for the V1 requirements.

------------------------------------------------------------------------

## 🔐 Security

Security is important because the QR is used for real event operations.

The system should:

-   Use secure authentication for participant and admin accounts
-   Protect admin routes with authentication and authorization
-   Restrict participants to their own team data
-   Keep database/service credentials server-side
-   Use non-guessable QR tokens
-   Avoid putting member information directly inside QR codes
-   Perform meal-limit validation on the server
-   Prevent participants from modifying attendance or consumption
    counters
-   Restrict attendance editing to authorized registration/admin staff
-   Use atomic database updates for counters where necessary

A hidden `/admin` URL alone is not considered sufficient security.

------------------------------------------------------------------------

## ⚡ Scanner Workflow

The scanner is designed for high-throughput event queues.

``` text
READY
  ↓
SCAN QR
  ↓
VALIDATE
  ↓
SHOW RESULT
  ↓
CONFIRM
  ↓
UPDATE DATABASE
  ↓
SUCCESS
  ↓
READY FOR NEXT SCAN
```

### Meal scan

``` text
Scan QR
   ↓
Check team
   ↓
Check registration
   ↓
Count present members
   ↓
Check meal counter
   ↓
Serve / Reject
```

### Coffee/tea scan

``` text
Scan QR
   ↓
Check team
   ↓
Increment coffee_count
   ↓
Ready for next scan
```

After a successful scan, the scanner should automatically return to a
ready state so volunteers can process the next participant without
unnecessary navigation.

------------------------------------------------------------------------

## 🖥️ Main Application Routes

A suggested route structure:

``` text
/
├── login
├── activate
├── dashboard
├── pass
├── event-info
│
└── admin
    ├── dashboard
    ├── scanner
    ├── teams
    └── announcements
```

The exact route structure may change depending on the final frontend
implementation.

------------------------------------------------------------------------

## 🧩 Suggested Technology Stack

### Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS

### Backend

-   Next.js Server/API Routes or Node.js + Express
-   TypeScript

### Database & Authentication

-   Supabase
-   PostgreSQL
-   Supabase Auth
-   Row-Level Security

### QR

-   QR generation library
-   Browser/mobile QR scanning library

### Deployment

A simple deployment can use:

``` text
Vercel
   ├── Next.js Application
   └── Server/API Routes

Supabase
   ├── Authentication
   └── PostgreSQL Database
```

------------------------------------------------------------------------

## 🔄 Complete Event Flow

``` text
ORGANIZER
    │
    │ Pre-create selected teams
    ↓
DATABASE
    │
    │ Team activation
    ↓
PARTICIPANT
    │
    │ Complete profile
    ↓
TEAM QR
    │
    │ Share with all members
    ↓
EVENT DAY
    │
    ↓
ON-DESK REGISTRATION
    │
    │ Mark present members
    ↓
MEAL SCANS
    │
    ├── Breakfast
    ├── Lunch
    └── Dinner
    │
    ↓
COFFEE / TEA SCANS
    │
    ↓
ADMIN DASHBOARD
    │
    ↓
FINAL EVENT STATISTICS
```

------------------------------------------------------------------------

## 🚫 V1 Non-Goals

To keep the system reliable and simple during the live hackathon, V1
does not include:

-   Individual member QR codes
-   Public unrestricted registration
-   Participant-facing team codes
-   Scan history
-   Timestamp logging
-   Individual meal identity tracking
-   Separate transaction/audit tables
-   Separate QR tables
-   Coffee/tea limits
-   Payment processing
-   Complex inventory management

These can be considered later if operational requirements change.

------------------------------------------------------------------------

## 📁 Recommended Project Structure

``` text
nirmaan-pass/
│
├── app/
│   ├── login/
│   ├── activate/
│   ├── dashboard/
│   ├── pass/
│   ├── event-info/
│   └── admin/
│       ├── dashboard/
│       ├── scanner/
│       ├── teams/
│       └── announcements/
│
├── components/
│   ├── QRScanner/
│   ├── TeamQR/
│   ├── FoodStatus/
│   ├── AnnouncementCard/
│   └── Admin/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── qr/
│   └── validation/
│
├── api/
│   ├── teams/
│   ├── members/
│   ├── scan/
│   └── announcements/
│
├── types/
│
├── public/
│
├── .env.local
├── package.json
└── README.md
```

------------------------------------------------------------------------

## 🚀 Getting Started

### Prerequisites

Make sure the development environment has:

-   Node.js
-   npm
-   Git
-   A Supabase project
-   Required Supabase environment variables

### Clone the repository

``` bash
git clone <repository-url>
cd nirmaan-pass
```

### Install dependencies

``` bash
npm install
```

### Configure environment variables

Create a `.env.local` file:

``` env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Server-only secrets, if required, should use appropriate server-side
environment variables and must not be exposed through `NEXT_PUBLIC_*`.

### Run development server

``` bash
npm run dev
```

Open:

``` text
http://localhost:3000
```

------------------------------------------------------------------------

## 🗄️ Database Setup

Create the three core application tables:

``` text
teams
members
announcements
```

Establish:

``` text
teams.id
    ↓
members.team_id
```

And:

``` text
teams.auth_id
    ↓
authenticated user
```

Recommended constraints include:

``` text
breakfast_count >= 0
lunch_count >= 0
dinner_count >= 0
coffee_count >= 0
```

Food counters must not exceed the number of present members.

Coffee/tea has no upper limit.

------------------------------------------------------------------------

## 🧪 Testing Checklist

Before the event, test the following.

### Participant

-   [ ] Team can activate account
-   [ ] Team can log in
-   [ ] Team can enter members
-   [ ] Team QR is generated
-   [ ] QR can be saved
-   [ ] QR can be shared
-   [ ] Participant can view announcements
-   [ ] Participant can view food status

### Registration

-   [ ] Valid QR is recognized
-   [ ] Invalid QR is rejected
-   [ ] All registered members appear
-   [ ] Individual attendance can be selected
-   [ ] `Present: X/Y` is correct
-   [ ] Registration is saved correctly
-   [ ] Existing registration can be edited by authorized staff

### Meals

-   [ ] Breakfast increments correctly
-   [ ] Lunch increments correctly
-   [ ] Dinner increments correctly
-   [ ] Meal limit is based on present members
-   [ ] Different members can scan at different times
-   [ ] Meal limit cannot be exceeded
-   [ ] Unregistered teams cannot receive food

### Coffee/Tea

-   [ ] Coffee/tea scan increments count
-   [ ] No artificial limit is applied
-   [ ] Multiple scans work correctly
-   [ ] Team-wise cup count is correct

### Dashboard

-   [ ] Present student total is correct
-   [ ] Breakfast total is correct
-   [ ] Lunch total is correct
-   [ ] Dinner total is correct
-   [ ] Coffee/tea total is correct
-   [ ] Team-wise statistics are correct

### Operational

-   [ ] Scanner automatically resets after successful scan
-   [ ] Scanner handles invalid QR
-   [ ] Scanner handles network/API errors
-   [ ] Multiple scanners cannot exceed meal limits
-   [ ] Admin routes are protected

------------------------------------------------------------------------

## 📈 Future Improvements

Possible future versions may add:

-   Offline-first scanner support
-   Export of final statistics to CSV/Excel
-   Separate tea vs coffee counts
-   More detailed inventory management
-   Role-based admin permissions
-   Dedicated volunteer accounts
-   Real-time dashboard updates
-   Event feedback module
-   Push notifications
-   Certificate generation
-   Post-event participation records

These should only be added if they provide clear operational value
without making event-day workflows slower or more complicated.

------------------------------------------------------------------------

## 🎯 Design Philosophy

NIRMAAN-PASS is intentionally built around a minimal operational model:

``` text
REGISTRATION
Who is present?

        ↓

FOOD SCAN
How many meals were served?

        ↓

COFFEE/TEA SCAN
How many cups were served?

        ↓

DASHBOARD
What were the final event totals?
```

The goal is not to track every action performed during the hackathon.

The goal is to make event operations **fast, reliable, and easy to
understand** while collecting the statistics organizers actually need.

------------------------------------------------------------------------

## 📌 Core Rules

1.  **One team = one QR.**
2.  **Every team member uses the same QR.**
3.  **Registration determines who is present.**
4.  **Present members determine the maximum food entitlement.**
5.  **Meal scans count actual servings.**
6.  **Members can eat at different times.**
7.  **Coffee/tea is unlimited.**
8.  **Coffee/tea scans only increment the cup counter.**
9.  **No timestamps or scan history are required in V1.**
10. **Final statistics are calculated from attendance and counters.**

------------------------------------------------------------------------

## NIRMAAN 2026

**NIRMAAN-PASS** is designed to support the complete participant and
event-day operations workflow for NIRMAAN 2026 --- from team activation
to the final event statistics.

# NIRMAAN-PASS --- System Architecture

## 1. Architecture Overview

NIRMAAN-PASS is a lightweight web application built around a simple
three-table data model and an authentication provider.

The architecture separates:

1.  Participant-facing application
2.  Admin-facing application
3.  Backend/API/business logic
4.  Authentication
5.  Database
6.  QR scanning and validation

### High-Level Architecture

``` text
                         NIRMAAN-PASS
                              |
              +---------------+---------------+
              |                               |
       Participant App                    Admin App
              |                               |
              +---------------+---------------+
                              |
                         Backend/API
                              |
              +---------------+---------------+
              |               |               |
        Authentication     Database       QR Validation
              |               |               |
          Auth Provider    3 Tables       Secure Token
```

------------------------------------------------------------------------

## 2. Recommended Technology Stack

### Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   Responsive/mobile-first UI
-   QR scanner library
-   QR generation library

### Backend

-   Node.js
-   Express.js or Next.js API routes
-   TypeScript
-   Server-side validation

### Database

-   PostgreSQL through Supabase

### Authentication

-   Supabase Auth

### Hosting

A simple deployment can use:

-   Vercel for the Next.js frontend/backend routes
-   Supabase for authentication and PostgreSQL

The architecture can also be deployed using another equivalent hosting
provider if required.

------------------------------------------------------------------------

## 3. Application Structure

A practical project structure is:

``` text
nirmaan-pass/
│
├── app/
│   ├── login/
│   ├── activate/
│   ├── dashboard/
│   ├── pass/
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── scanner/
│   │   ├── teams/
│   │   └── announcements/
│   └── event-info/
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
└── types/
```

The exact folder structure can vary depending on whether the application
uses Next.js API routes or a separate Express backend.

------------------------------------------------------------------------

## 4. Core Data Model

The application intentionally avoids unnecessary tables.

### Database

``` text
teams
members
announcements
```

Authentication is handled separately by Supabase Auth.

------------------------------------------------------------------------

## 5. Entity Relationship

``` text
                AUTH USERS
                    |
                    | auth_id
                    v
                  TEAMS
                    |
                    | 1 : many
                    v
                 MEMBERS


              ANNOUNCEMENTS
             independent table
```

### Relationship

One team has many members.

``` text
teams.id
    |
    +---- members.team_id
```

A team has one QR token stored in its own team record.

No separate QR table is required.

------------------------------------------------------------------------

## 6. Teams Table

Suggested schema:

``` sql
teams
-----
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

### Field meanings

`id` - Internal team identifier.

`team_name` - Official team name.

`college` - Team's college/institution.

`auth_id` - Reference to the authenticated team account.

`qr_token` - Secure random token encoded into the team's QR.

`checked_in` - Indicates that the team's event-day registration has been
completed.

`breakfast_count` - Number of breakfast servings recorded.

`lunch_count` - Number of lunch servings recorded.

`dinner_count` - Number of dinner servings recorded.

`coffee_count` - Number of coffee/tea servings recorded.

------------------------------------------------------------------------

## 7. Members Table

``` sql
members
-------
id
team_id
name
phone
email
present
```

`present` represents event-day attendance.

The total number of present students for a team is calculated from:

``` text
COUNT(members WHERE present = true)
```

There is no need for a separate `present_members` field because that
would duplicate information.

------------------------------------------------------------------------

## 8. Announcements Table

``` sql
announcements
-------------
id
title
message
priority
published
```

Possible priorities:

``` text
normal
important
urgent
```

Only announcements where `published = true` are displayed to
participants.

------------------------------------------------------------------------

## 9. QR Architecture

Each team receives one QR.

The QR should contain only a secure token or equivalent opaque
identifier.

Example concept:

``` text
NIRMAAN-PASS:<secure-random-token>
```

The QR must not contain:

``` text
Team name
Member names
Phone numbers
Email addresses
```

The scanner sends the token to the backend.

``` text
QR
 |
 v
Scanner
 |
 v
Backend
 |
 | lookup qr_token
 v
Team record
```

------------------------------------------------------------------------

## 10. Why the QR Token Is Stored in `teams`

A separate QR table is unnecessary because:

-   Each team has exactly one QR.
-   QR does not have independent business data.
-   QR can be regenerated by replacing the token.
-   Team lookup is straightforward.

Therefore:

``` text
teams.qr_token
```

is sufficient.

------------------------------------------------------------------------

## 11. Authentication Architecture

Supabase Auth handles:

-   Login
-   Passwords
-   Sessions
-   Authentication tokens
-   Account recovery

The application should not store plaintext passwords.

The application associates the authenticated account with its team
using:

``` text
teams.auth_id
```

### Participant authorization

After login:

``` text
Auth User
    |
    v
teams.auth_id
    |
    v
Team
    |
    +--> Members
    +--> QR
    +--> Food counters
```

A participant can only access their own team's data.

------------------------------------------------------------------------

## 12. Team Activation Architecture

Because organizers already know the selected teams, public signup should
not directly create arbitrary teams.

Recommended flow:

``` text
Organizer
   |
   | Pre-create selected teams
   v
Database
   |
   | Activation mechanism
   v
Participant
   |
   | Creates credentials
   v
Auth Provider
   |
   v
teams.auth_id
```

The activation mechanism can use a pre-registered team-leader email or a
secure one-time activation link.

The internal database ID and QR token should not be exposed as a public
team code.

------------------------------------------------------------------------

## 13. Event-Day Registration Flow

``` text
Team Member
     |
     | Show Team QR
     v
Admin Scanner
     |
     | Scan Purpose =
     | On-Desk Registration
     v
Backend
     |
     | Validate QR
     v
Team + Members
     |
     v
Registration Popup
     |
     | Select physically present members
     v
Confirm Registration
     |
     +----> teams.checked_in = true
     |
     +----> members.present = true/false
```

Example:

``` text
Team has 4 members

A ✓
B ✓
C ✓
D ✗

Present = 3/4
```

------------------------------------------------------------------------

## 14. Attendance and Meal Relationship

This is the most important business rule in the architecture.

The number of present members determines the maximum number of servings
for:

-   Breakfast
-   Lunch
-   Dinner

### Formula

``` text
meal_limit =
COUNT(members WHERE team_id = X AND present = true)
```

For example:

``` text
Present = 4

Breakfast limit = 4
Lunch limit = 4
Dinner limit = 4
```

The system does not track which individual member consumed a meal.

------------------------------------------------------------------------

## 15. Meal Scan Flow

``` text
Member
  |
  | Same Team QR
  v
Admin Scanner
  |
  | Scan Purpose = Lunch
  v
Backend
  |
  +--> Validate QR
  |
  +--> Check checked_in
  |
  +--> Count present members
  |
  +--> Read lunch_count
  |
  +--> Compare:
       lunch_count < present_count
             |
       +-----+-----+
       |           |
      YES          NO
       |           |
       v           v
    Serve       Reject
       |
       v
 lunch_count += 1
```

### Example

``` text
Present members = 4
Lunch count = 2

Remaining = 4 - 2 = 2

Serve
  |
  v
Lunch count = 3
```

The next member can arrive later and use the same QR.

------------------------------------------------------------------------

## 16. Important Timing Independence

No timestamp is required for meal eligibility.

The architecture intentionally does not use:

``` text
scan_time
meal_time
member_meal_time
scan_history
```

Therefore:

``` text
Member 1 -> lunch scan
       |
       | 20 minutes
       v
Member 2 -> lunch scan
       |
       | 15 minutes
       v
Member 3 -> lunch scan
       |
       v
Member 4 -> lunch scan
```

All four scans are valid if four members were marked present.

The database only cares about the final count.

------------------------------------------------------------------------

## 17. Coffee/Tea Flow

Coffee/tea has no entitlement limit.

``` text
Member
  |
  | Team QR
  v
Admin Scanner
  |
  | Scan Purpose = Coffee / Tea
  v
Backend
  |
  | Validate QR
  v
coffee_count
  |
  | +1
  v
Updated coffee_count
```

Example:

``` text
Team A
coffee_count = 15

Scan
   |
   v
coffee_count = 16
```

Another team:

``` text
Team B
coffee_count = 19
```

There is no comparison against member count.

------------------------------------------------------------------------

## 18. Why Coffee Does Not Need a Separate Table

The requirement is only:

> How many cups did each team consume?

Therefore:

``` text
teams.coffee_count
```

is enough.

There is no need to store:

``` text
who took coffee
when they took coffee
whether it was tea or coffee
which scanner served it
```

unless these requirements are added in a future version.

------------------------------------------------------------------------

## 19. Scanner State Machine

The scanner can be modeled as:

``` text
READY
  |
  v
SCAN
  |
  v
VALIDATE
  |
  +-------------------+
  |        |          |
  v        v          v
VALID    INVALID    NOT CHECKED IN
  |
  v
SHOW ACTION
  |
  v
CONFIRM
  |
  v
UPDATE DATABASE
  |
  v
SUCCESS
  |
  v
READY
```

For a meal:

``` text
VALID
  |
  v
CHECK LIMIT
  |
  +------------+
  |            |
  v            v
AVAILABLE    LIMIT REACHED
  |            |
  v            v
SERVE        REJECT
```

For coffee/tea, the limit check is skipped.

------------------------------------------------------------------------

## 20. Scanner UX Architecture

The scanner must support high-throughput operation.

After every successful operation:

``` text
Success
   |
   v
Reset scanner
   |
   v
Ready for next QR
```

The volunteer should not need to navigate back to the scanner manually.

### Required states

-   Ready
-   Scanning
-   Valid
-   Invalid QR
-   Not checked in
-   Meal available
-   Meal limit reached
-   Registration required
-   Success

------------------------------------------------------------------------

## 21. API Design

A minimal API surface is preferred.

### Team APIs

``` text
GET    /api/team/me
PATCH  /api/team/me
```

Used by participants to view/update their team profile.

### Member APIs

``` text
GET    /api/team/members
POST   /api/team/members
PATCH  /api/team/members/:id
```

Participant-side member editing should be restricted to the appropriate
team.

### Scanner API

A single central scan endpoint can handle all scan purposes:

``` text
POST /api/admin/scan
```

Example request:

``` json
{
  "qr_token": "secure-token",
  "purpose": "lunch"
}
```

Possible purposes:

``` text
registration
breakfast
lunch
dinner
coffee
```

### Registration request

``` json
{
  "qr_token": "secure-token",
  "purpose": "registration",
  "present_member_ids": [
    "member-1",
    "member-2",
    "member-3"
  ]
}
```

### Announcement APIs

``` text
GET    /api/announcements
POST   /api/admin/announcements
PATCH  /api/admin/announcements/:id
```

------------------------------------------------------------------------

## 22. Server-Side Scan Validation

All important scanner logic must be performed server-side.

Do not trust the frontend to enforce:

``` text
meal limits
attendance
team ownership
admin authorization
```

### Meal validation

Conceptually:

``` text
1. Authenticate admin
2. Validate QR token
3. Find team
4. Check team.checked_in
5. Count present members
6. Read relevant meal counter
7. If counter >= present count:
       reject
8. Otherwise:
       increment counter
9. Return updated count
```

This prevents a modified client from bypassing the meal limit.

------------------------------------------------------------------------

## 23. Database Update Safety

Meal and coffee counters should be updated atomically where possible.

For example, the backend should avoid:

``` text
READ count
wait
WRITE count + 1
```

when multiple scanners could operate simultaneously.

Instead, use a database-side transaction or atomic update so two
volunteers scanning the same team at nearly the same time cannot
accidentally exceed the allowed meal count.

This is especially important during lunch/dinner queues.

------------------------------------------------------------------------

## 24. Admin Authorization

The admin route must be protected by authentication and authorization.

``` text
Admin Login
    |
    v
Auth Provider
    |
    v
Admin Authorization
    |
    +---- allowed ----> /admin
    |
    +---- denied -----> login/access denied
```

A hidden `/admin` URL is not sufficient security.

Participant accounts must not be able to call admin scanner endpoints.

------------------------------------------------------------------------

## 25. Row-Level Security

If Supabase/PostgreSQL is used, Row Level Security should enforce
ownership.

Conceptually:

### Participant

``` text
Authenticated user
      |
      v
teams.auth_id = auth.uid()
```

The participant can read/update only their own team information and
related members.

### Admin

Admin authorization should grant access to required team, member,
scanner, and announcement operations.

Sensitive service credentials must remain server-side.

------------------------------------------------------------------------

## 26. Dashboard Calculations

The dashboard does not require a separate statistics table.

### Total students present

``` text
SUM of present members across all teams
```

### Breakfast

``` text
SUM(teams.breakfast_count)
```

### Lunch

``` text
SUM(teams.lunch_count)
```

### Dinner

``` text
SUM(teams.dinner_count)
```

### Coffee/Tea

``` text
SUM(teams.coffee_count)
```

### Example

``` text
Team A: present 4, breakfast 4, lunch 4, dinner 3, coffee 15
Team B: present 5, breakfast 5, lunch 4, dinner 5, coffee 19
Team C: present 3, breakfast 3, lunch 2, dinner 3, coffee 11

Total present  = 12
Breakfast      = 12
Lunch          = 10
Dinner         = 11
Coffee/Tea     = 45
```

------------------------------------------------------------------------

## 27. Dashboard Architecture

``` text
                 ADMIN DASHBOARD
                        |
       +----------------+----------------+
       |                |                |
    Overview         Scanner           Teams
       |                |                |
       |         Scan Purpose             |
       |                |                |
       |       +--------+--------+        |
       |       |        |        |        |
       |    Reg.     Meals    Coffee      |
       |                                  |
       +--------------+-------------------+
                      |
                Announcements
```

### Overview cards

Recommended cards:

``` text
Total Teams
Checked-in Teams
Registered Students
Students Present
Breakfast Served
Lunch Served
Dinner Served
Coffee/Tea Cups
```

------------------------------------------------------------------------

## 28. Participant Architecture

``` text
                    PARTICIPANT
                         |
                    Login/Activation
                         |
                         v
                  Participant Home
                         |
        +----------------+----------------+
        |                |                |
      QR Pass        Food Status     Announcements
        |                |                |
     Save/Share      Breakfast          Schedule
                      Lunch              Rules
                      Dinner              Venue
                    Coffee/Tea
```

The QR pass should be the most prominent element because it is the
participant's main event-day credential.

------------------------------------------------------------------------

## 29. Data Flow: Complete Event

``` text
ORGANIZER
   |
   | Pre-create teams
   v
DATABASE
   |
   v
TEAM
   |
   | Activate account
   v
AUTH
   |
   | Complete profile
   v
TEAM QR
   |
   | Event day
   v
REGISTRATION DESK
   |
   | Scan QR
   v
MEMBER ATTENDANCE
   |
   +---------------------+
   |          |          |
   v          v          v
Breakfast    Lunch      Dinner
   |          |          |
   +----------+----------+
              |
              v
        Food Counters

              +
              |
              v
        Coffee/Tea
              |
              v
        Coffee Counter
              |
              v
       ADMIN DASHBOARD
              |
              v
       FINAL EVENT TOTALS
```

------------------------------------------------------------------------

## 30. Example Complete Scenario

Team Alpha has four registered members.

### Registration

``` text
Registered = 4
Present = 4
```

### Breakfast

Four members eventually collect breakfast:

``` text
Breakfast = 4
```

### Lunch

Two members eat first:

``` text
Lunch = 2
```

Two members continue working.

Later:

``` text
Member 3 -> Lunch = 3
Member 4 -> Lunch = 4
```

Final:

``` text
Lunch = 4
```

### Coffee/Tea

Throughout the event:

``` text
15 scans
```

Final:

``` text
Coffee/Tea = 15
```

### Team record

``` text
Present       = 4
Breakfast     = 4
Lunch         = 4
Dinner        = 3
Coffee/Tea    = 15
```

No individual meal identity or scan timestamps are stored.

------------------------------------------------------------------------

## 31. Failure and Recovery

### Invalid QR

Return:

``` text
Invalid QR
Team not found.
```

### Team not registered

Return:

``` text
Registration required
Please visit the registration desk.
```

### Meal limit reached

Return:

``` text
Meal limit reached
4/4 already served.
```

### Duplicate registration

Return:

``` text
Team already registered
Use Edit Attendance if attendance needs correction.
```

### Network/database failure

The scanner should show a clear error rather than falsely confirming
service.

The organizer should only treat a serving as successful after the
backend confirms the database update.

------------------------------------------------------------------------

## 32. Concurrency Considerations

NIRMAAN 2026 may have multiple food/scanner stations operating
simultaneously.

Therefore, the backend must support concurrent scans.

Example:

``` text
Scanner A ----\
               \
Scanner B ------> Backend ---> Database
               /
Scanner C ----/
```

Two simultaneous lunch scans must not allow:

``` text
Present = 4
Lunch = 4
```

to become:

``` text
Lunch = 5
```

Atomic database operations/transactions should enforce:

``` text
new_meal_count <= present_count
```

------------------------------------------------------------------------

## 33. Data Integrity Rules

The backend should enforce:

``` text
breakfast_count >= 0
lunch_count >= 0
dinner_count >= 0
coffee_count >= 0
```

For food:

``` text
breakfast_count <= present_count
lunch_count <= present_count
dinner_count <= present_count
```

For coffee/tea:

``` text
coffee_count has no upper limit
```

Attendance:

``` text
present = true/false
```

------------------------------------------------------------------------

## 34. Simplicity Decisions

The following are deliberately excluded from V1:

### No scan history

The system only needs the resulting counters.

### No timestamps

The event does not require timing analysis.

### No transaction table

The counters are sufficient for the required reporting.

### No individual meal identity

The QR identifies the team, not the member consuming the meal.

### No separate QR table

One QR belongs to one team.

### No coffee limit

Only the number of cups is required.

### No additional statistics table

Final statistics can be calculated from the existing records.

This keeps the system easy to build, maintain, and operate.

------------------------------------------------------------------------

## 35. Security Model Summary

``` text
Participant
   |
   +--> Own team data only
   |
   +--> Own members only
   |
   +--> View/use team QR
   |
   X--> Attendance editing
   X--> Food counter editing
   X--> Admin dashboard

Admin
   |
   +--> Scan QR
   +--> Registration
   +--> Attendance correction
   +--> Food serving
   +--> Coffee/tea serving
   +--> Team statistics
   +--> Announcements
```

------------------------------------------------------------------------

## 36. Recommended Deployment

### Frontend + Server Routes

``` text
Vercel
   |
   +--> Next.js Participant App
   |
   +--> Next.js Admin App
   |
   +--> Server/API Routes
```

### Backend Services

``` text
Supabase
   |
   +--> Authentication
   +--> PostgreSQL
   +--> Row-Level Security
```

This reduces infrastructure complexity because a separate backend server
is not mandatory for V1.

If the team later requires a dedicated Node/Express backend, the API
layer can be separated without changing the core database model.

------------------------------------------------------------------------

## 37. Operational Principle

The system is designed around three simple operations:

``` text
REGISTRATION
    ↓
Who is present?

FOOD SCAN
    ↓
How many meals were served?

COFFEE/TEA SCAN
    ↓
How many cups were served?
```

At the end:

``` text
Attendance + Food Counters + Coffee Counter
                    ↓
          Event Statistics
```

This is the core architecture of NIRMAAN-PASS.

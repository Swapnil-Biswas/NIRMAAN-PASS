# NIRMAAN-PASS --- Product Requirements Document (PRD)

## 1. Product Overview

**NIRMAAN-PASS** is a digital participant pass and event operations
system for **NIRMAAN 2026**, a national-level hackathon.

The system provides participating teams with a single digital QR pass
and gives organizers an admin dashboard for:

-   Team activation and profile completion
-   Event-day on-desk registration
-   Member attendance tracking
-   Breakfast, lunch, and dinner serving
-   Unlimited coffee/tea consumption tracking
-   Announcements and event information
-   Event-day aggregate statistics and reporting

The core principle is **one QR code per team**. Every member of a team
uses the same team QR code.

------------------------------------------------------------------------

## 2. Goals

### Primary Goals

1.  Replace manual paper-based participant/event-day tracking with a
    simple digital workflow.
2.  Give every selected team one reusable QR code.
3.  Record which registered team members are physically present on event
    day.
4.  Use attendance to determine the team's meal entitlement.
5.  Track actual breakfast, lunch, and dinner servings.
6.  Track the total number of coffee/tea cups consumed by each team
    without imposing a limit.
7.  Provide organizers with team-wise and event-wide statistics.
8.  Make scanning fast enough for high-volume event queues.
9.  Keep the database and application architecture simple.

### Success Criteria

The system should allow organizers to answer, at the end of the event:

-   How many students were present?
-   How many students were served breakfast?
-   How many students were served lunch?
-   How many students were served dinner?
-   How many coffee/tea cups were served?
-   How many coffee/tea cups did each team consume?
-   How many students from each team were present?
-   How much food was consumed by each team?

------------------------------------------------------------------------

## 3. Non-Goals

The V1 system will **not** include:

-   Individual QR codes for each member
-   Public unrestricted team registration
-   Team codes exposed to participants
-   Scan history or timestamp logs
-   Individual meal-consumption identity tracking
-   A separate transaction/audit table
-   A separate QR-code table
-   A fixed coffee/tea allowance
-   Complex inventory management
-   Payment processing
-   A requirement for every member to log in during the event

------------------------------------------------------------------------

## 4. Users

### 4.1 Participant / Team

A team participant can:

-   Activate their pre-created team account
-   Create their own login credentials
-   Enter/update team information
-   Enter member details
-   View their team QR
-   Save the QR
-   Share the QR with all team members
-   View attendance status
-   View food consumption/status
-   Read announcements
-   View event schedule, rules, venue, and important information

### 4.2 Admin / Organizer

An authorized organizer can:

-   Access the admin dashboard
-   Scan team QR codes
-   Perform on-desk registration
-   Mark individual members present
-   Edit attendance when required
-   Serve breakfast/lunch/dinner through QR scans
-   Record coffee/tea consumption
-   Manage announcements
-   View teams and their statistics
-   View overall event-day statistics

------------------------------------------------------------------------

## 5. Core Concept: One Team QR

Each team receives exactly **one QR code**.

The QR contains a secure identifier/token that maps to the team
internally. It should not expose unnecessary member information.

The same QR is used for:

-   On-desk registration
-   Breakfast
-   Lunch
-   Dinner
-   Coffee/Tea

Every team member should have access to the same QR.

### Participant instruction

> **Every team member must show the team QR when collecting meals or
> beverages. Share this QR with all your team members and keep it easily
> accessible on your phone.**

------------------------------------------------------------------------

## 6. Team Activation and Registration Flow

Organizers will pre-create database records for the selected teams.

### Flow

1.  Organizer creates the selected team records.
2.  Organizer shares the common NIRMAAN-PASS link with participating
    teams.
3.  A team securely claims/activates its pre-created record.
4.  The team creates its own login credentials.
5.  Team enters member names, phone numbers, and email addresses.
6.  Team completes its profile.
7.  NIRMAAN-PASS generates/displays the team's QR.
8.  Team leader/member uses **Save QR** or **Share QR**.
9.  The QR is distributed to every team member.
10. The same QR is used throughout the event.

There must not be an unrestricted public signup that allows arbitrary
teams to create event accounts.

------------------------------------------------------------------------

## 7. Event-Day Registration

### 7.1 Registration Process

At the event desk:

1.  Organizer selects **On-Desk Registration** from the scanner's Scan
    Purpose dropdown.
2.  Team member shows the team QR.
3.  Organizer scans the QR.
4.  A registration popup appears.
5.  Popup displays:
    -   Team name
    -   College
    -   All registered team members
    -   Checkbox beside every member
6.  Organizer checks the members physically present.
7.  System displays a count such as:
    -   `Present: 3/4`
8.  Organizer selects **Confirm Registration**.
9.  Team is marked checked in.
10. Selected members are marked `present = true`.

### 7.2 Attendance Correction

If the same team is scanned again in On-Desk Registration mode:

-   Show that registration has already been completed.
-   Provide an authorized **Edit Attendance** action.
-   Registration/help-desk/admin staff can change which members are
    present.

Food volunteers should not be responsible for changing attendance.

------------------------------------------------------------------------

## 8. Food Serving Logic

The food system covers:

-   Breakfast
-   Lunch
-   Dinner

### Fundamental Rule

**Meal entitlement is based on the number of team members marked present
during on-desk registration.**

It does not depend on:

-   Which member eats first
-   Which member scans first
-   Whether members arrive at the food area together
-   The time between scans

### Example

A team has 4 registered members.

At on-desk registration:

`Present = 4/4`

At lunch:

-   Member 1 scans → `1/4`
-   Member 2 scans → `2/4`
-   Member 3 scans later → `3/4`
-   Member 4 scans later → `4/4`

All four servings are valid even if the members arrive at different
times.

### If fewer people eat

If:

`Present = 4`

but only 3 people take lunch:

`Lunch = 3/4`

The unused serving simply remains unused.

### If a member arrives later

If the member was already marked present during registration, their meal
is already included in the team's entitlement.

If the member was originally absent and later arrives, attendance must
be corrected by authorized registration/help-desk/admin staff.

------------------------------------------------------------------------

## 9. Meal Scanner Requirements

When the Scan Purpose is Breakfast, Lunch, or Dinner:

1.  Scan the team QR.
2.  Verify the team.
3.  Verify that the team has checked in.
4.  Display:
    -   Team name
    -   Members present, e.g. `4/4`
    -   Current meal count, e.g. `2/4`
    -   Remaining meals, e.g. `2`
5.  Organizer selects **Serve**.
6.  Relevant counter increments by 1.
7.  Scanner automatically becomes ready for the next scan.

### Meal rejection cases

Reject the scan if:

-   QR is invalid
-   Team does not exist
-   Team has not completed on-desk registration
-   Meal limit has already been reached

Example:

`Lunch limit reached — 4/4 served.`

No member selection should appear during meal serving because it would
slow down the queue.

------------------------------------------------------------------------

## 10. Coffee / Tea Tracking

Coffee/tea is **unlimited**.

There is no maximum per team.

The system only needs to count how many cups were served.

### Example

Team A:

`Coffee/Tea = 15`

Team B:

`Coffee/Tea = 19`

If Team A receives another cup:

`15 → 16`

If Team B receives another cup:

`19 → 20`

The system does not need to identify which individual member consumed
the cup.

### Coffee/Tea Scanner

When Scan Purpose is **Coffee / Tea**:

1.  Scan team QR.
2.  Verify the team.
3.  Display team name.
4.  Display current cup count.
5.  Organizer selects **Serve**.
6.  `coffee_count` increases by 1.
7.  Scanner immediately returns to scanning mode.

There is no limit-reached state for coffee/tea.

------------------------------------------------------------------------

## 11. Scan Purpose

The admin scanner must provide one dropdown:

-   On-Desk Registration
-   Breakfast
-   Lunch
-   Dinner
-   Coffee / Tea

The selected purpose determines the scanner's behavior and confirmation
popup.

------------------------------------------------------------------------

## 12. Participant Dashboard

The participant home screen should prominently display:

### Digital Pass

-   NIRMAAN 2026 branding
-   Team name
-   College
-   Team QR
-   Save QR
-   Share QR
-   Registration/checked-in status

### Important instruction

> Every team member must show the team QR when collecting meals or
> beverages.

### Event information

-   Announcements
-   Schedule
-   Venue
-   Rules
-   Important instructions

### Food status

Show the team's current counts, for example:

-   Breakfast: `4/4`
-   Lunch: `2/4`
-   Dinner: `0/4`
-   Coffee/Tea: `15`

------------------------------------------------------------------------

## 13. Admin Dashboard

The admin dashboard should provide:

### Dashboard

Aggregate event statistics:

-   Total teams
-   Checked-in teams
-   Total registered students
-   Total students present
-   Breakfast served
-   Lunch served
-   Dinner served
-   Total coffee/tea cups

### Scanner

High-speed QR scanning with the Scan Purpose selector.

### Teams

For each team:

-   Team name
-   College
-   Registered members
-   Members present
-   Checked-in status
-   Breakfast count
-   Lunch count
-   Dinner count
-   Coffee/tea count

### Announcements

Admin can:

-   Create announcement
-   Edit announcement
-   Publish/unpublish announcement
-   Set priority

Priority values:

-   Normal
-   Important
-   Urgent

------------------------------------------------------------------------

## 14. Final Event Statistics

The system must automatically calculate event totals.

### Attendance

**Total Students Present**

= sum of members where `present = true`

### Food

**Breakfast Served**

= sum of all `breakfast_count`

**Lunch Served**

= sum of all `lunch_count`

**Dinner Served**

= sum of all `dinner_count`

### Beverages

**Total Coffee/Tea Cups**

= sum of all `coffee_count`

### Team-level reporting

Example:

  Team       Present   Breakfast   Lunch   Dinner   Coffee/Tea
  -------- --------- ----------- ------- -------- ------------
  Team A           4           4       4        3           15
  Team B           5           5       4        5           19
  Team C           3           3       2        3           11

------------------------------------------------------------------------

## 15. Data Model

V1 should use three application tables plus the authentication system.

### `teams`

  Field               Purpose
  ------------------- ---------------------------------------------
  `id`                Team primary key
  `team_name`         Team name
  `college`           College/institution
  `auth_id`           Authentication user reference
  `qr_token`          Secure QR identifier
  `checked_in`        Whether the team has completed registration
  `breakfast_count`   Breakfast servings
  `lunch_count`       Lunch servings
  `dinner_count`      Dinner servings
  `coffee_count`      Total coffee/tea cups

### `members`

  Field       Purpose
  ----------- ----------------------
  `id`        Member primary key
  `team_id`   Team reference
  `name`      Member name
  `phone`     Member phone
  `email`     Member email
  `present`   Event-day attendance

### `announcements`

  Field         Purpose
  ------------- -----------------------------
  `id`          Announcement primary key
  `title`       Announcement title
  `message`     Announcement content
  `priority`    Normal / Important / Urgent
  `published`   Whether it is visible

Authentication credentials should be handled by the authentication
provider and should not be stored as plaintext passwords in the `teams`
table.

------------------------------------------------------------------------

## 16. Security Requirements

-   Admin routes must require authentication.
-   Participant accounts must only access their own team data.
-   Participants must not be able to modify attendance or food counters.
-   Attendance changes must be restricted to authorized
    admin/registration staff.
-   Food and beverage counters must be changed through controlled
    scanner actions.
-   QR tokens should be non-guessable.
-   The QR should not contain plaintext member information.
-   Database credentials and service keys must never be exposed to the
    client.
-   Server-side validation must enforce meal limits.

------------------------------------------------------------------------

## 17. Performance Requirements

The scanner is used during high-traffic event periods.

Therefore:

-   QR recognition should be fast.
-   Confirmation should require minimal interaction.
-   After a successful scan, scanner should automatically be ready for
    the next scan.
-   Meal volunteers should not have to select individual members.
-   The system should clearly communicate success/failure.
-   The interface should work well on phones/tablets used by volunteers.

------------------------------------------------------------------------

## 18. Error States

The scanner should clearly handle:

### Valid QR

`Team A — Lunch: 2/4`

Action:

`SERVE`

### Invalid QR

`Invalid QR — Team not found.`

### Not Checked In

`Team not registered at the event desk.`

Action:

`Send to Registration Desk`

### Meal Limit Reached

`Lunch limit reached — 4/4 served.`

### Already Registered

`Team already registered.`

Action:

`EDIT ATTENDANCE`

------------------------------------------------------------------------

## 19. Announcements and Event Information

Participant users should be able to view:

-   Live announcements
-   Event schedule
-   Venue information
-   Rules
-   Important instructions

The V1 schedule, rules, venue, and static information can remain
application content rather than requiring additional database tables.

Announcements are stored in the `announcements` table so organizers can
update them during the event.

------------------------------------------------------------------------

## 20. Functional Requirements Summary

  ID      Requirement
  ------- -------------------------------------------------
  FR-01   Organizer can pre-create selected teams
  FR-02   Team can securely activate its account
  FR-03   Team can create its credentials
  FR-04   Team can enter member information
  FR-05   System generates one QR per team
  FR-06   Team can save/share its QR
  FR-07   Admin can scan QR for registration
  FR-08   Admin can mark individual members present
  FR-09   Admin can edit attendance
  FR-10   Breakfast serving is limited by present members
  FR-11   Lunch serving is limited by present members
  FR-12   Dinner serving is limited by present members
  FR-13   Coffee/tea has no limit
  FR-14   Coffee/tea count increments per serving
  FR-15   Admin can manage announcements
  FR-16   Dashboard shows aggregate event statistics
  FR-17   Dashboard shows team-level consumption
  FR-18   Scanner automatically returns to ready state
  FR-19   Participant can view event information
  FR-20   Participant can view current food status

------------------------------------------------------------------------

## 21. V1 Deliverables

### Participant Application

-   Login/activation
-   Team profile
-   Member management
-   QR pass
-   Save/share QR
-   Attendance status
-   Food status
-   Announcements
-   Event information

### Admin Application

-   Secure admin login
-   Dashboard
-   QR scanner
-   Scan Purpose selector
-   Registration attendance popup
-   Meal serving popup
-   Coffee/tea counter
-   Team management
-   Announcements
-   Aggregate statistics

------------------------------------------------------------------------

## 22. Product Principle

NIRMAAN-PASS should optimize for **simplicity during a live hackathon**.

The participant should mainly need to remember one thing:

> **Keep your team's QR accessible. Every team member uses the same QR
> for registration, meals, and beverages.**

The organizer should mainly need to remember:

> **Registration records who is present. Food scans record servings.
> Coffee/tea scans record cups.**

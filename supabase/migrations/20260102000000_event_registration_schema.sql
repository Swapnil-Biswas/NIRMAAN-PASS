-- =============================================================================
-- Migration: Event, Registration, AttendanceInstance, AttendanceRecord Schema
-- Compatible with PostgreSQL / Supabase
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Event Model
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "date" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPCOMING'
);

-- 2. Registration Model
CREATE TABLE IF NOT EXISTS "Registration" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "userType" TEXT NOT NULL DEFAULT 'STUDENT',
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "usn" TEXT,
  "semester" INTEGER,
  "department" TEXT,
  "section" TEXT,
  "customFieldResponse" TEXT,
  "teamName" TEXT,
  "teamMembers" JSONB,
  "paymentScreenshot" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "attendanceCode" TEXT UNIQUE,
  "attended" BOOLEAN NOT NULL DEFAULT false,
  "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  CONSTRAINT "uq_registration_email_event" UNIQUE ("email", "eventId")
);

-- 3. AttendanceInstance Model
CREATE TABLE IF NOT EXISTS "AttendanceInstance" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "time" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "prerequisite_instance_id" TEXT REFERENCES "AttendanceInstance"("id") ON DELETE SET NULL
);

-- 4. AttendanceRecord Model
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "attendanceInstanceId" TEXT NOT NULL REFERENCES "AttendanceInstance"("id") ON DELETE CASCADE,
  "registrationId" TEXT NOT NULL REFERENCES "Registration"("id") ON DELETE CASCADE,
  "memberEmail" TEXT NOT NULL DEFAULT '',
  "attendedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_attendance_record_unique" UNIQUE ("attendanceInstanceId", "registrationId", "memberEmail")
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS "idx_registration_event" ON "Registration"("eventId");
CREATE INDEX IF NOT EXISTS "idx_registration_attendance_code" ON "Registration"("attendanceCode");
CREATE INDEX IF NOT EXISTS "idx_attendance_instance_event" ON "AttendanceInstance"("eventId");
CREATE INDEX IF NOT EXISTS "idx_attendance_instance_prereq" ON "AttendanceInstance"("prerequisite_instance_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_record_instance" ON "AttendanceRecord"("attendanceInstanceId");
CREATE INDEX IF NOT EXISTS "idx_attendance_record_registration" ON "AttendanceRecord"("registrationId");
CREATE INDEX IF NOT EXISTS "idx_attendance_record_member" ON "AttendanceRecord"("memberEmail");

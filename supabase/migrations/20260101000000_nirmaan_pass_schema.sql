-- =============================================================================
-- NIRMAAN-PASS Database Schema
-- Digital Participant Pass & Event Operations System for NIRMAAN 2026
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Table: teams
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    college TEXT NOT NULL,
    auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    qr_token TEXT UNIQUE NOT NULL,
    checked_in BOOLEAN NOT NULL DEFAULT false,
    breakfast_count INTEGER NOT NULL DEFAULT 0 CHECK (breakfast_count >= 0),
    lunch_count INTEGER NOT NULL DEFAULT 0 CHECK (lunch_count >= 0),
    dinner_count INTEGER NOT NULL DEFAULT 0 CHECK (dinner_count >= 0),
    coffee_count INTEGER NOT NULL DEFAULT 0 CHECK (coffee_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for QR lookup (used on every live scan)
CREATE INDEX IF NOT EXISTS idx_teams_qr_token ON public.teams(qr_token);
CREATE INDEX IF NOT EXISTS idx_teams_auth_id ON public.teams(auth_id);

-- -----------------------------------------------------------------------------
-- 2. Table: members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    present BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for member lookups
CREATE INDEX IF NOT EXISTS idx_members_team_id ON public.members(team_id);
CREATE INDEX IF NOT EXISTS idx_members_present ON public.members(team_id, present);

-- -----------------------------------------------------------------------------
-- 3. Table: announcements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published, created_at DESC);

-- -----------------------------------------------------------------------------
-- Row-Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- TEAMS policies
-- Participants: read own team record
CREATE POLICY "Participants can read own team"
    ON public.teams FOR SELECT
    TO authenticated
    USING (auth_id = auth.uid());

-- Participants: update own team profile (team_name, college)
CREATE POLICY "Participants can update own team profile"
    ON public.teams FOR UPDATE
    TO authenticated
    USING (auth_id = auth.uid())
    WITH CHECK (auth_id = auth.uid());

-- Service role / Admin bypass handles admin scans & overview via server API

-- MEMBERS policies
-- Participants: read own team members
CREATE POLICY "Participants can read own members"
    ON public.members FOR SELECT
    TO authenticated
    USING (team_id IN (SELECT id FROM public.teams WHERE auth_id = auth.uid()));

-- Participants: insert members for own team
CREATE POLICY "Participants can insert own members"
    ON public.members FOR INSERT
    TO authenticated
    WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE auth_id = auth.uid()));

-- Participants: update own team members
CREATE POLICY "Participants can update own members"
    ON public.members FOR UPDATE
    TO authenticated
    USING (team_id IN (SELECT id FROM public.teams WHERE auth_id = auth.uid()))
    WITH CHECK (team_id IN (SELECT id FROM public.teams WHERE auth_id = auth.uid()));

-- ANNOUNCEMENTS policies
-- Anyone authenticated or anonymous can read published announcements
CREATE POLICY "Anyone can read published announcements"
    ON public.announcements FOR SELECT
    TO anon, authenticated
    USING (published = true);

-- -----------------------------------------------------------------------------
-- Atomic RPC Stored Procedures
-- High-throughput, concurrent, server-validated live event operations
-- -----------------------------------------------------------------------------

-- 1. Process Meal Scan (Atomic check and increment)
CREATE OR REPLACE FUNCTION public.process_meal_scan(
    p_qr_token TEXT,
    p_meal_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team public.teams%ROWTYPE;
    v_present_count INTEGER;
    v_current_count INTEGER;
    v_new_count INTEGER;
    v_clean_token TEXT;
BEGIN
    -- Sanitize token (trim prefix if formatted as NIRMAAN-PASS:token)
    v_clean_token := regexp_replace(trim(p_qr_token), '^NIRMAAN-PASS:', '', 'i');

    -- Lock team row for concurrency safety
    SELECT * INTO v_team
    FROM public.teams
    WHERE qr_token = v_clean_token OR qr_token = trim(p_qr_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_QR',
            'message', 'Invalid QR — Team not found.'
        );
    END IF;

    -- Check on-desk registration
    IF NOT v_team.checked_in THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_CHECKED_IN',
            'message', 'Team not registered at the event desk. Please visit registration desk.',
            'team_id', v_team.id,
            'team_name', v_team.team_name,
            'college', v_team.college
        );
    END IF;

    -- Count physically present members
    SELECT COUNT(*) INTO v_present_count
    FROM public.members
    WHERE team_id = v_team.id AND present = true;

    IF v_present_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NO_PRESENT_MEMBERS',
            'message', 'No team members marked present. Please update attendance at registration desk.',
            'team_id', v_team.id,
            'team_name', v_team.team_name
        );
    END IF;

    -- Determine current meal count based on meal type
    CASE lower(trim(p_meal_type))
        WHEN 'breakfast' THEN
            v_current_count := v_team.breakfast_count;
            IF v_current_count >= v_present_count THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error_code', 'MEAL_LIMIT_REACHED',
                    'message', format('Breakfast limit reached — %s/%s served.', v_current_count, v_present_count),
                    'team_id', v_team.id,
                    'team_name', v_team.team_name,
                    'present_count', v_present_count,
                    'current_count', v_current_count,
                    'meal_type', 'breakfast'
                );
            END IF;
            UPDATE public.teams
            SET breakfast_count = breakfast_count + 1, updated_at = now()
            WHERE id = v_team.id
            RETURNING breakfast_count INTO v_new_count;

        WHEN 'lunch' THEN
            v_current_count := v_team.lunch_count;
            IF v_current_count >= v_present_count THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error_code', 'MEAL_LIMIT_REACHED',
                    'message', format('Lunch limit reached — %s/%s served.', v_current_count, v_present_count),
                    'team_id', v_team.id,
                    'team_name', v_team.team_name,
                    'present_count', v_present_count,
                    'current_count', v_current_count,
                    'meal_type', 'lunch'
                );
            END IF;
            UPDATE public.teams
            SET lunch_count = lunch_count + 1, updated_at = now()
            WHERE id = v_team.id
            RETURNING lunch_count INTO v_new_count;

        WHEN 'dinner' THEN
            v_current_count := v_team.dinner_count;
            IF v_current_count >= v_present_count THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error_code', 'MEAL_LIMIT_REACHED',
                    'message', format('Dinner limit reached — %s/%s served.', v_current_count, v_present_count),
                    'team_id', v_team.id,
                    'team_name', v_team.team_name,
                    'present_count', v_present_count,
                    'current_count', v_current_count,
                    'meal_type', 'dinner'
                );
            END IF;
            UPDATE public.teams
            SET dinner_count = dinner_count + 1, updated_at = now()
            WHERE id = v_team.id
            RETURNING dinner_count INTO v_new_count;

        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INVALID_MEAL_TYPE',
                'message', 'Invalid meal type specified. Must be breakfast, lunch, or dinner.'
            );
    END CASE;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_name', v_team.team_name,
        'college', v_team.college,
        'meal_type', lower(trim(p_meal_type)),
        'present_count', v_present_count,
        'new_count', v_new_count,
        'remaining_count', (v_present_count - v_new_count),
        'message', format('Successfully served %s (%s/%s)', lower(trim(p_meal_type)), v_new_count, v_present_count)
    );
END;
$$;

-- 2. Process Coffee / Tea Scan (Unlimited)
CREATE OR REPLACE FUNCTION public.process_coffee_scan(
    p_qr_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team public.teams%ROWTYPE;
    v_new_count INTEGER;
    v_clean_token TEXT;
BEGIN
    v_clean_token := regexp_replace(trim(p_qr_token), '^NIRMAAN-PASS:', '', 'i');

    SELECT * INTO v_team
    FROM public.teams
    WHERE qr_token = v_clean_token OR qr_token = trim(p_qr_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_QR',
            'message', 'Invalid QR — Team not found.'
        );
    END IF;

    UPDATE public.teams
    SET coffee_count = coffee_count + 1, updated_at = now()
    WHERE id = v_team.id
    RETURNING coffee_count INTO v_new_count;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_name', v_team.team_name,
        'college', v_team.college,
        'new_count', v_new_count,
        'message', format('Coffee/Tea served to %s (Total: %s cups)', v_team.team_name, v_new_count)
    );
END;
$$;

-- 3. Process On-Desk Registration / Attendance Correction
CREATE OR REPLACE FUNCTION public.process_registration(
    p_qr_token TEXT,
    p_present_member_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team public.teams%ROWTYPE;
    v_total_members INTEGER;
    v_present_count INTEGER;
    v_clean_token TEXT;
BEGIN
    v_clean_token := regexp_replace(trim(p_qr_token), '^NIRMAAN-PASS:', '', 'i');

    SELECT * INTO v_team
    FROM public.teams
    WHERE qr_token = v_clean_token OR qr_token = trim(p_qr_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_QR',
            'message', 'Invalid QR — Team not found.'
        );
    END IF;

    -- Mark team as checked in
    UPDATE public.teams
    SET checked_in = true, updated_at = now()
    WHERE id = v_team.id;

    -- Update member attendance atomically
    UPDATE public.members
    SET present = (id = ANY(p_present_member_ids))
    WHERE team_id = v_team.id;

    -- Count totals
    SELECT COUNT(*) INTO v_total_members FROM public.members WHERE team_id = v_team.id;
    SELECT COUNT(*) INTO v_present_count FROM public.members WHERE team_id = v_team.id AND present = true;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_name', v_team.team_name,
        'college', v_team.college,
        'checked_in', true,
        'total_members', v_total_members,
        'present_count', v_present_count,
        'message', format('Registration saved. %s/%s members marked present.', v_present_count, v_total_members)
    );
END;
$$;

-- 4. Get Event Statistics (Calculated aggregates without separate stats table)
CREATE OR REPLACE FUNCTION public.get_event_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_teams INTEGER;
    v_checked_in_teams INTEGER;
    v_total_students INTEGER;
    v_present_students INTEGER;
    v_breakfast_served INTEGER;
    v_lunch_served INTEGER;
    v_dinner_served INTEGER;
    v_total_coffee INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE checked_in = true),
           COALESCE(SUM(breakfast_count), 0),
           COALESCE(SUM(lunch_count), 0),
           COALESCE(SUM(dinner_count), 0),
           COALESCE(SUM(coffee_count), 0)
    INTO v_total_teams, v_checked_in_teams,
         v_breakfast_served, v_lunch_served, v_dinner_served, v_total_coffee
    FROM public.teams;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE present = true)
    INTO v_total_students, v_present_students
    FROM public.members;

    RETURN jsonb_build_object(
        'total_teams', v_total_teams,
        'checked_in_teams', v_checked_in_teams,
        'total_students', v_total_students,
        'present_students', v_present_students,
        'breakfast_served', v_breakfast_served,
        'lunch_served', v_lunch_served,
        'dinner_served', v_dinner_served,
        'total_coffee', v_total_coffee
    );
END;
$$;

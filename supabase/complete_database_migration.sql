-- =============================================================================
-- NIRMAAN 2026 FULL DATABASE MIGRATION & SEED SCRIPT
-- Ready for any new Supabase Project
-- Tables: teams, members, announcements
-- RLS Policies & Stored Procedures: process_meal_scan, process_coffee_scan, process_registration
-- Initial Seed: 289 Verified Teams, 908 Participants (Clean 0 counts)
-- =============================================================================

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
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
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
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
    published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(published, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Table: schedule
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    time TEXT NOT NULL,
    title TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'TIMELINE',
    color TEXT NOT NULL DEFAULT 'bg-nirmaan-blue',
    text_color TEXT DEFAULT 'text-white',
    order_index INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_order ON public.schedule(order_index ASC);

-- -----------------------------------------------------------------------------
-- Row-Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

-- SCHEDULE policies
CREATE POLICY "Anyone can read schedule"
    ON public.schedule FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Service role has full access to schedule"
    ON public.schedule FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

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
    p_present_member_ids TEXT[]
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


-- =============================================================================
-- SEED DATA: 289 TEAMS, 908 MEMBERS
-- =============================================================================

-- NIRMAAN 2026 Seed Data: 289 Teams, 908 Members, Default Schedule
BEGIN;

-- Schedule: No seed data. Schedule is managed dynamically via the admin panel (/admin/schedule).
-- All event timeline & announcements are published through the Event Info section.

INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-001', '0xDEADEAD', 'Engineering Institution', 'nirmaan_0xdeadead_036aa8d8a426', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-002', '3 BHK', 'Engineering Institution', 'nirmaan_3_bhk_c4f57ff6e3d7', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-003', '3 byte builders', 'Engineering Institution', 'nirmaan_3_byte_bui_cec14bbe0f48', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-004', '4O4', 'Engineering Institution', 'nirmaan_4o4_ebf3f976f78f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-005', 'ACE', 'Engineering Institution', 'nirmaan_ace_f2b276818017', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-006', 'AceOfMaze', 'Engineering Institution', 'nirmaan_aceofmaze_ed84202643a0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-007', 'Aera', 'Engineering Institution', 'nirmaan_aera_8493440c6f1f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-008', 'AERONEX', 'KLE Technological University', 'nirmaan_aeronex_dcd339f8d25a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-009', 'AetherAI', 'BMS Institute of Technology', 'nirmaan_aetherai_a7a95572e3b2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-010', 'Aevora', 'Engineering Institution', 'nirmaan_aevora_f23809f4da9e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-011', 'Agasthya', 'Engineering Institution', 'nirmaan_agasthya_033c6e2fb45a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-012', 'Agrenyx Technologies', 'Engineering Institution', 'nirmaan_agrenyx_te_32a619a36e58', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-013', 'AI Slaves', 'Nitte Meenakshi Institute of Technology', 'nirmaan_ai_slaves_7dbaee06a963', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-014', 'AlgoRhythms', 'Nitte Meenakshi Institute of Technology', 'nirmaan_algorhythm_a6cdea1ddf1f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-015', 'Alok', 'Engineering Institution', 'nirmaan_alok_ae41333d20c8', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-016', 'Alpha Coders', 'Engineering Institution', 'nirmaan_alpha_code_03989a725b2b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-017', 'ALRONICS', 'BMS Institute of Technology', 'nirmaan_alronics_e18778bfb64b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-018', 'Anti Virus', 'BVRIT Hyderabad', 'nirmaan_anti_virus_dd4f4d0516af', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-019', 'APEX', 'Engineering Institution', 'nirmaan_apex_dad4d9f8909f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-020', 'Apple', 'Sri Sairam Engineering College', 'nirmaan_apple_c97cc8600787', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-021', 'Arigato Algorithms', 'BMS Institute of Technology', 'nirmaan_arigato_al_7b76c8ebdfe8', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-022', 'Ashwasan', 'Engineering Institution', 'nirmaan_ashwasan_1dec0e348bab', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-023', 'AURALYNX', 'Engineering Institution', 'nirmaan_auralynx_b74cbd3227f1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-024', 'Aurevia', 'Engineering Institution', 'nirmaan_aurevia_2e158705969c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-025', 'Axiom', 'Engineering Institution', 'nirmaan_axiom_f5b2b67dcbf0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-026', 'AXON stack', 'Engineering Institution', 'nirmaan_axon_stack_fc02e9d9cd04', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-027', 'BACKL', 'Engineering Institution', 'nirmaan_backl_74c421bb4709', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-028', 'BeatX', 'Engineering Institution', 'nirmaan_beatx_d0bdbb200d4c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-029', 'Bee_Tech', 'Engineering Institution', 'nirmaan_bee_tech_c8dd658962cf', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-030', 'Bhuraksha', 'BMS Institute of Technology', 'nirmaan_bhuraksha_7f42eb890057', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-031', 'Binary V2', 'Engineering Institution', 'nirmaan_binary_v2_7d950d5c70ea', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-032', 'BIOCIRCUITZ', 'Engineering Institution', 'nirmaan_biocircuit_574468f4d11a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-033', 'Bitheads', 'Engineering Institution', 'nirmaan_bitheads_e764ac85a2af', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-034', 'Bitstorm', 'Engineering Institution', 'nirmaan_bitstorm_de40b7cf63af', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-035', 'Black Velvet', 'Engineering Institution', 'nirmaan_black_velv_0cb0099cbe33', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-036', 'Booyah Voyagers', 'Engineering Institution', 'nirmaan_booyah_voy_f7c1ea25080a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-037', 'Brain Blenders', 'Engineering Institution', 'nirmaan_brain_blen_4b83971252cf', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-038', 'Builder Grids', 'BMS Institute of Technology', 'nirmaan_builder_gr_b130e3a25a79', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-039', 'BUILDERS', 'Engineering Institution', 'nirmaan_builders_47465ad7cd80', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-040', 'Byte force', 'Engineering Institution', 'nirmaan_byte_force_587ef2ca6ad4', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-041', 'Byte_me', 'Engineering Institution', 'nirmaan_byte_me_f210a5e6ba72', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-042', 'ByteBenders', 'KLE Technological University', 'nirmaan_bytebender_2c337a13d67d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-043', 'Byterush', 'Engineering Institution', 'nirmaan_byterush_bdff3287aad7', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-044', 'ByteRush', 'Engineering Institution', 'nirmaan_byterush_b9e40239ea22', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-045', 'ByteX', 'Nitte Meenakshi Institute of Technology', 'nirmaan_bytex_0e206c19a6bd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-046', 'CacheUs', 'BMS Institute of Technology', 'nirmaan_cacheus_cf1c1ab09f7b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-047', 'Catalyst', 'BMS Institute of Technology', 'nirmaan_catalyst_cf0377fd2122', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-048', 'CelestriX', 'Engineering Institution', 'nirmaan_celestrix_84b96a326769', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-049', 'CERT26', 'BMS Institute of Technology', 'nirmaan_cert26_e68f7fe947bd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-050', 'ChaCha', 'Engineering Institution', 'nirmaan_chacha_03a5b7985530', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-051', 'Circuitpulse', 'Engineering Institution', 'nirmaan_circuitpul_32a9c32a3036', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-052', 'CLASHERS', 'Engineering Institution', 'nirmaan_clashers_4f644e1a9e43', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-053', 'Codalist', 'Engineering Institution', 'nirmaan_codalist_5fadb713dce8', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-054', 'Code Blooded', 'BMS Institute of Technology', 'nirmaan_code_blood_eb73ac576459', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-055', 'Code colouss', 'Engineering Institution', 'nirmaan_code_colou_4b09be5a09d5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-056', 'Code start', 'Engineering Institution', 'nirmaan_code_start_e99ced5e6c48', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-057', 'Code villa', 'Engineering Institution', 'nirmaan_code_villa_f4e602380d06', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-058', 'Codegeeks', 'Engineering Institution', 'nirmaan_codegeeks_1e3cb85e15f3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-059', 'CodeSquad', 'Engineering Institution', 'nirmaan_codesquad_3e3bd09e2973', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-060', 'CodeStorm', 'Engineering Institution', 'nirmaan_codestorm_e4da0ee64bb5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-061', 'Codex', 'Engineering Institution', 'nirmaan_codex_13bbb56687db', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-062', 'Codex', 'Nitte Meenakshi Institute of Technology', 'nirmaan_codex_4b925b34830b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-063', 'CodeX NINJA''S', 'Engineering Institution', 'nirmaan_codex_ninj_965d87959d42', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-064', 'Codexa', 'Engineering Institution', 'nirmaan_codexa_8cdca04ebb19', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-065', 'Codexa', 'Engineering Institution', 'nirmaan_codexa_a876908d1de1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-066', 'CrackHeads', 'Engineering Institution', 'nirmaan_crackheads_7e904bcfe0d6', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-067', 'ctrl alt delulu', 'Engineering Institution', 'nirmaan_ctrl_alt_d_30e0a2c006c0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-068', 'Ctrl+care', 'Engineering Institution', 'nirmaan_ctrl_care_3ae63a1f848c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-069', 'Cyber Citadel', 'Engineering Institution', 'nirmaan_cyber_cita_c59f43fa719e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-070', 'Dakaits', 'Engineering Institution', 'nirmaan_dakaits_fabfcadf98db', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-071', 'Debuggers', 'Engineering Institution', 'nirmaan_debuggers_fed2dab7c128', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-072', 'Dexter', 'Engineering Institution', 'nirmaan_dexter_a0409fc49881', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-073', 'DHANVANTARI', 'Engineering Institution', 'nirmaan_dhanvantar_15f940ac4639', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-074', 'Digital Dreamers', 'Engineering Institution', 'nirmaan_digital_dr_238a32c08014', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-075', 'DistanceDynamos', 'Engineering Institution', 'nirmaan_distancedy_15c6ddd0ed86', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-076', 'DOCKER DUCKS', 'BMS Institute of Technology', 'nirmaan_docker_duc_ba6ac79d23b0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-077', 'DOMAIN SPARKS', 'Engineering Institution', 'nirmaan_domain_spa_f9ef575f456f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-078', 'Drait', 'Engineering Institution', 'nirmaan_drait_15fc35aad77d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-079', 'DSOSC', 'Engineering Institution', 'nirmaan_dsosc_30faaa95ba89', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-080', 'Dynamo coders', 'Engineering Institution', 'nirmaan_dynamo_cod_4033d482bfaa', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-081', 'E2 Titans', 'Engineering Institution', 'nirmaan_e2_titans_98328a88a3d0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-082', 'ECO LOOP', 'Engineering Institution', 'nirmaan_eco_loop_46a8d62b097e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-083', 'ECO-Grow', 'Engineering Institution', 'nirmaan_eco_grow_16f0f122d09a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-084', 'EcoTech Innopreethamd1415@gmail.comvators 🌍', 'Engineering Institution', 'nirmaan_ecotech_in_376416e9b3f7', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-085', 'Edgevital', 'Engineering Institution', 'nirmaan_edgevital_319163140ed1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-086', 'Electrified', 'Engineering Institution', 'nirmaan_electrifie_d86b09a93c41', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-087', 'ElectroX', 'BMS Institute of Technology', 'nirmaan_electrox_754d8f1fc611', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-088', 'Elevate X', 'Engineering Institution', 'nirmaan_elevate_x_a6286be33365', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-089', 'Elevspark', 'Engineering Institution', 'nirmaan_elevspark_09207c3f18e4', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-090', 'Elite Team', 'Engineering Institution', 'nirmaan_elite_team_4c67d82997b2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-091', 'Embedded Minds', 'Engineering Institution', 'nirmaan_embedded_m_56980da15f7c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-092', 'ENIGMAA', 'BMS Institute of Technology', 'nirmaan_enigmaa_8afe6fce635c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-093', 'Error 404', 'Engineering Institution', 'nirmaan_error_404_037e4013d77d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-094', 'ERROR 404 : Chaos At Core', 'Engineering Institution', 'nirmaan_error_404_d82933c71d34', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-095', 'Error404:NotFound', 'Engineering Institution', 'nirmaan_error404_n_cb290be7297c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-096', 'Espadas', 'Engineering Institution', 'nirmaan_espadas_1f4c8053b132', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-097', 'FET''S LUCK', 'Engineering Institution', 'nirmaan_fet_s_luck_5c410b6a8ffd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-098', 'FNAF', 'Engineering Institution', 'nirmaan_fnaf_a24f2a217aab', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-099', 'Frequency Fusion', 'Engineering Institution', 'nirmaan_frequency_1f9b5268b0a2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-100', 'GARUDAX', 'Engineering Institution', 'nirmaan_garudax_c36a369b9541', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-101', 'Genus', 'Engineering Institution', 'nirmaan_genus_3f27bdead9e0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-102', 'globalhost', 'Engineering Institution', 'nirmaan_globalhost_c63d749123a5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-103', 'Gocrecer', 'Engineering Institution', 'nirmaan_gocrecer_251756b0506a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-104', 'God Valley', 'Engineering Institution', 'nirmaan_god_valley_d898dafc2840', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-105', 'Green Apple', 'Engineering Institution', 'nirmaan_green_appl_8c71179c7acc', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-106', 'Hack Ninjas', 'Engineering Institution', 'nirmaan_hack_ninja_9ba2143ff348', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-107', 'HackCore', 'Engineering Institution', 'nirmaan_hackcore_d220d616cb55', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-108', 'Hackfusion', 'Engineering Institution', 'nirmaan_hackfusion_4555bc398aae', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-109', 'HackHer', 'Engineering Institution', 'nirmaan_hackher_a4c3dabdeb8b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-110', 'HackHer3', 'Engineering Institution', 'nirmaan_hackher3_56d69b10534f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-111', 'HackNova', 'Engineering Institution', 'nirmaan_hacknova_c07440b096cc', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-112', 'HUSTLER''S', 'Engineering Institution', 'nirmaan_hustler_s_f2cf9e616e40', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-113', 'HydroEye', 'Engineering Institution', 'nirmaan_hydroeye_f948ba928261', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-114', 'IdeaFuse', 'Engineering Institution', 'nirmaan_ideafuse_2e403119cca7', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-115', 'IIT milani', 'Engineering Institution', 'nirmaan_iit_milani_fe92c1c4c9cd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-116', 'InferX', 'BMS Institute of Technology', 'nirmaan_inferx_14dc5ba1b513', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-117', 'INNORISE', 'Engineering Institution', 'nirmaan_innorise_cb956f423577', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-118', 'InnovateX', 'BMS Institute of Technology', 'nirmaan_innovatex_dd289dfe18ce', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-119', 'Innovative Coders', 'Engineering Institution', 'nirmaan_innovative_ac102178729f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-120', 'Innovex', 'Engineering Institution', 'nirmaan_innovex_92080b459758', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-121', 'InnovHer', 'Engineering Institution', 'nirmaan_innovher_735fb75fefa0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-122', 'INVINCIBLES', 'Engineering Institution', 'nirmaan_invincible_8d12fe72f2e3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-123', 'Koders Club', 'Engineering Institution', 'nirmaan_koders_clu_b596ad7a39dd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-124', 'LEGIONS', 'Nitte Meenakshi Institute of Technology', 'nirmaan_legions_6bc052490b72', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-125', 'Let''s crack it....', 'Engineering Institution', 'nirmaan_let_s_crac_a029624c7f32', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-126', 'Logic Forge', 'Engineering Institution', 'nirmaan_logic_forg_05e754daf741', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-127', 'Logic Legends', 'Engineering Institution', 'nirmaan_logic_lege_5bdf151d6c4a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-128', 'Lucent', 'Engineering Institution', 'nirmaan_lucent_a0f38b3c71fc', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-129', 'Lumos', 'Engineering Institution', 'nirmaan_lumos_ff3b5a635018', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-130', 'MALNAD TECH TITANS', 'Engineering Institution', 'nirmaan_malnad_tec_9f478d520b14', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-131', 'Mango_Eaters', 'Engineering Institution', 'nirmaan_mango_eate_d212102fb703', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-132', 'MergeInfinity', 'Engineering Institution', 'nirmaan_mergeinfin_e5b8678d9045', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-133', 'Mindsight', 'Engineering Institution', 'nirmaan_mindsight_a058407a3911', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-134', 'Muggles', 'Nitte Meenakshi Institute of Technology', 'nirmaan_muggles_65d522b83377', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-135', 'Nano flux', 'BMS Institute of Technology', 'nirmaan_nano_flux_62c8237577fb', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-136', 'Nemesis', 'Engineering Institution', 'nirmaan_nemesis_3fc373bf874d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-137', 'NEOX', 'Engineering Institution', 'nirmaan_neox_7798ab415efa', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-138', 'Neural Ninja''s', 'Engineering Institution', 'nirmaan_neural_nin_87eb942846c5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-139', 'NeuralNexus', 'Engineering Institution', 'nirmaan_neuralnexu_7ef3dbf7063b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-140', 'NeuroSpark', 'Engineering Institution', 'nirmaan_neurospark_0c437291b927', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-141', 'Newbies', 'Engineering Institution', 'nirmaan_newbies_0c80f2494301', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-142', 'nexbyte', 'BMS Institute of Technology', 'nirmaan_nexbyte_ad9e2a965fb5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-143', 'Nexora', 'Engineering Institution', 'nirmaan_nexora_8f59e3a9f2a9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-144', 'NextGen', 'Engineering Institution', 'nirmaan_nextgen_892ff037ee7e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-145', 'NextGenElite', 'BMS Institute of Technology', 'nirmaan_nextgeneli_8ac9ffadc4c6', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-146', 'Nexus', 'Engineering Institution', 'nirmaan_nexus_5723ab902088', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-147', 'NEXUS', 'Engineering Institution', 'nirmaan_nexus_284937d06df5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-148', 'NightCrawler', 'Nitte Meenakshi Institute of Technology', 'nirmaan_nightcrawl_fd022e7627b3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-149', 'NIMHANS', 'BMS Institute of Technology', 'nirmaan_nimhans_443285ce95f2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-150', 'Nirmaan Nexus', 'Engineering Institution', 'nirmaan_nirmaan_ne_393b2d19ebe8', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-151', 'Nirvaan', 'Engineering Institution', 'nirmaan_nirvaan_a19d181027df', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-152', 'NOT IITIAN', 'Engineering Institution', 'nirmaan_not_iitian_98fb9cced34c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-153', 'Nova Nexus', 'Engineering Institution', 'nirmaan_nova_nexus_c0f784eece01', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-154', 'NUCLEUS', 'Engineering Institution', 'nirmaan_nucleus_e543d6fc08c5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-155', 'Null Theory', 'Engineering Institution', 'nirmaan_null_theor_cc0a9f70a56c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-156', 'Nxtwave innovators', 'Engineering Institution', 'nirmaan_nxtwave_in_230b8bbd39c9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-157', 'Odyssey', 'Engineering Institution', 'nirmaan_odyssey_0ae17ad3e108', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-158', 'ORBITX', 'Engineering Institution', 'nirmaan_orbitx_190c5f8b0023', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-159', 'ottimo guys', 'Engineering Institution', 'nirmaan_ottimo_guy_7e3b3cadd268', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-160', 'Paritrana', 'Ramaiah Institute of Technology', 'nirmaan_paritrana_17661e26f0f2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-161', 'Phoenix', 'BMS Institute of Technology', 'nirmaan_phoenix_e3f26bc09a4f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-162', 'Pixie Chicks', 'BMS Institute of Technology', 'nirmaan_pixie_chic_6ff004ba3af9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-163', 'Prayas Infinity', 'Engineering Institution', 'nirmaan_prayas_inf_b6e25144f48d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-164', 'PRiSa', 'Engineering Institution', 'nirmaan_prisa_afc1fc6e853d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-165', 'Prism Talons', 'Engineering Institution', 'nirmaan_prism_talo_84a5bf9a5783', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-166', 'Prompt2Long', 'Engineering Institution', 'nirmaan_prompt2lon_c9c1258c2061', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-167', 'PyroSense', 'Engineering Institution', 'nirmaan_pyrosense_a23bc439a599', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-168', 'QuadCore', 'Engineering Institution', 'nirmaan_quadcore_433fe670931a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-169', 'QuadraTech', 'BMS Institute of Technology', 'nirmaan_quadratech_ce652f20f64a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-170', 'Quadruples', 'Engineering Institution', 'nirmaan_quadruples_ea9357112d35', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-171', 'QuadX', 'BMS Institute of Technology', 'nirmaan_quadx_019755de4712', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-172', 'Quantum crew', 'Engineering Institution', 'nirmaan_quantum_cr_d85a3896c4bc', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-173', 'QUANTUM TRAID', 'Engineering Institution', 'nirmaan_quantum_tr_27ea6ddd6928', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-174', 'R1', 'Engineering Institution', 'nirmaan_r1_c22407b257c3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-175', 'R2-D2', 'BMS Institute of Technology', 'nirmaan_r2_d2_1f6faa952928', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-176', 'RadarX', 'Engineering Institution', 'nirmaan_radarx_68368d7576bd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-177', 'RASAM', 'Engineering Institution', 'nirmaan_rasam_fafdfa2c49cd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-178', 'RehabGrip', 'Engineering Institution', 'nirmaan_rehabgrip_59d2fb07d028', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-179', 'Resilient Labs', 'Engineering Institution', 'nirmaan_resilient_b937072a2567', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-180', 'ResQnet', 'Engineering Institution', 'nirmaan_resqnet_8fb1aa1fa927', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-181', 'ResQNet', 'Engineering Institution', 'nirmaan_resqnet_2df602c4d04a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-182', 'Revanche', 'BMS Institute of Technology', 'nirmaan_revanche_db4a9f58b5c9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-183', 'root access', 'Engineering Institution', 'nirmaan_root_acces_676036645d9e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-184', 'RootAccess', 'Nitte Meenakshi Institute of Technology', 'nirmaan_rootaccess_6ff77548e133', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-185', 'Royal Enfield', 'Engineering Institution', 'nirmaan_royal_enfi_5e9d4f472c32', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-186', 'RTX 6090', 'Engineering Institution', 'nirmaan_rtx_6090_8193baf90311', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-187', 'Runtime Terror', 'Engineering Institution', 'nirmaan_runtime_te_aaca022d7dc3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-188', 'SahayaSetu', 'Engineering Institution', 'nirmaan_sahayasetu_f39fe8c5eddd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-189', 'Seed-to-circuit', 'Engineering Institution', 'nirmaan_seed_to_ci_5eaadcc2522a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-190', 'Sentinels', 'Engineering Institution', 'nirmaan_sentinels_8ecabb334aa3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-191', 'SETU', 'Engineering Institution', 'nirmaan_setu_5f04f8181f89', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-192', 'Shadow quant', 'Engineering Institution', 'nirmaan_shadow_qua_a35f0c7f530d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-193', 'Shelmet People', 'BMS Institute of Technology', 'nirmaan_shelmet_pe_e13b6df3f605', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-194', 'Shree Priya', 'Engineering Institution', 'nirmaan_shree_priy_b59150f7f979', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-195', 'Silicon Syndicate', 'Engineering Institution', 'nirmaan_silicon_sy_5b5e077f32c3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-196', 'Silicon Syndicate', 'Engineering Institution', 'nirmaan_silicon_sy_7f37bc3bd481', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-197', 'SILVER ARROWS', 'Engineering Institution', 'nirmaan_silver_arr_4dee14f7c1e1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-198', 'Sirius', 'BMS Institute of Technology', 'nirmaan_sirius_5318ad02682a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-199', 'SmartGuard', 'Engineering Institution', 'nirmaan_smartguard_cb38d13b99c7', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-200', 'Soch.exe', 'Engineering Institution', 'nirmaan_soch_exe_7d6c024c69f4', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-201', 'SSR', 'Engineering Institution', 'nirmaan_ssr_d291adddb466', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-202', 'Stone Ocean', 'Engineering Institution', 'nirmaan_stone_ocea_bf94b325bf95', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-203', 'Sud0Shift', 'Engineering Institution', 'nirmaan_sud0shift_c0209eff394d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-204', 'SustainMax', 'Engineering Institution', 'nirmaan_sustainmax_7b37b0c7424a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-205', 'SVAN', 'Engineering Institution', 'nirmaan_svan_70f07426f69f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-206', 'SYNTAX AND SOLDER', 'Engineering Institution', 'nirmaan_syntax_and_43ef8c4b89d5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-207', 'TARS', 'Engineering Institution', 'nirmaan_tars_dddcfe8c5538', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-208', 'Tatva', 'Engineering Institution', 'nirmaan_tatva_c2f8a1fcde88', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-209', 'TEAM ADAP(T)', 'Engineering Institution', 'nirmaan_team_adap_eb1f8bcc61cd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-210', 'team amoeba', 'Engineering Institution', 'nirmaan_team_amoeb_4b01977f446b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-211', 'Team Astra', 'Engineering Institution', 'nirmaan_team_astra_426004624eed', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-212', 'Team Byte', 'Engineering Institution', 'nirmaan_team_byte_b4d837e9ca19', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-213', 'Team Codefury', 'Engineering Institution', 'nirmaan_team_codef_e419af9a7103', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-214', 'Team Deku', 'Engineering Institution', 'nirmaan_team_deku_c052fa048904', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-215', 'Team Elevate', 'Engineering Institution', 'nirmaan_team_eleva_c49fc21e0f41', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-216', 'TEAM HACKATTACK', 'Engineering Institution', 'nirmaan_team_hacka_9ab6e9b38b28', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-217', 'TEAM L.D', 'Engineering Institution', 'nirmaan_team_l_d_83ca748c8de1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-218', 'TEAM MARCUS', 'Engineering Institution', 'nirmaan_team_marcu_55193300328f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-219', 'TEAM NOVA', 'BMS Institute of Technology', 'nirmaan_team_nova_e44bb937d2c6', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-220', 'Team Rachana', 'Engineering Institution', 'nirmaan_team_racha_8f51b4fe67c4', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-221', 'TEAM SIRIUS', 'Engineering Institution', 'nirmaan_team_siriu_cdc78987ba4b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-222', 'TEAM TECHX', 'Engineering Institution', 'nirmaan_team_techx_0ad7194613ed', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-223', 'TeamSpy', 'Engineering Institution', 'nirmaan_teamspy_33d46472d335', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-224', 'TECH FOUR', 'BMS Institute of Technology', 'nirmaan_tech_four_f7555e5641ba', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-225', 'Tech JATs', 'Engineering Institution', 'nirmaan_tech_jats_4b4a2818cc24', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-226', 'TECH MAVERICKS', 'Engineering Institution', 'nirmaan_tech_maver_161804aa0616', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-227', 'Tech pulze', 'BMS Institute of Technology', 'nirmaan_tech_pulze_1ee6d7d96b86', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-228', 'Tech Spark', 'Engineering Institution', 'nirmaan_tech_spark_a04558f5dc8e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-229', 'Tech Tetrad', 'Engineering Institution', 'nirmaan_tech_tetra_746dd3cf0fa2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-230', 'Tech Titains', 'Engineering Institution', 'nirmaan_tech_titai_95f2c35d02d6', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-231', 'Tech Titans', 'Engineering Institution', 'nirmaan_tech_titan_90b1f8bebe2b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-232', 'Tech Trio', 'Engineering Institution', 'nirmaan_tech_trio_16f677298f46', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-233', 'Tech_Titans', 'Engineering Institution', 'nirmaan_tech_titan_a53a761559f9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-234', 'Tech4Buddies', 'Engineering Institution', 'nirmaan_tech4buddi_3e14afed1c41', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-235', 'Techtonic', 'Engineering Institution', 'nirmaan_techtonic_0cc6868c7c4d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-236', 'Tejashwini S', 'Engineering Institution', 'nirmaan_tejashwini_94921a6a503e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-237', 'Terra Sentinel', 'BMS Institute of Technology', 'nirmaan_terra_sent_eebc69578c00', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-238', 'TexSols', 'Engineering Institution', 'nirmaan_texsols_d544bd27bf2c', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-239', 'TFPAINS', 'Engineering Institution', 'nirmaan_tfpains_3978952e00fe', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-240', 'Thanos', 'Engineering Institution', 'nirmaan_thanos_d3023c700f09', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-241', 'THANOS', 'Engineering Institution', 'nirmaan_thanos_8779f44cc533', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-242', 'The big 4 tech', 'Engineering Institution', 'nirmaan_the_big_4_4064322e4bf3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-243', 'The Debuggers', 'Engineering Institution', 'nirmaan_the_debugg_dc33240fbda1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-244', 'The Epic Byte', 'Engineering Institution', 'nirmaan_the_epic_b_6ec284f79fb3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-245', 'The Hacksmiths', 'Engineering Institution', 'nirmaan_the_hacksm_932f2efd8d2a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-246', 'THE INNOV8ORS', 'Engineering Institution', 'nirmaan_the_innov8_d3055572e936', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-247', 'The Mavericks', 'Engineering Institution', 'nirmaan_the_maveri_40ad5df4078f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-248', 'The Ravagers', 'Engineering Institution', 'nirmaan_the_ravage_8bb4447cfcdc', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-249', 'The Third Byte', 'BMS Institute of Technology', 'nirmaan_the_third_54b00e254812', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-250', 'the_bug', 'Engineering Institution', 'nirmaan_the_bug_a7f46048a135', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-251', 'Toofani log', 'Engineering Institution', 'nirmaan_toofani_lo_72d89f9e5aea', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-252', 'TrackAegis', 'Engineering Institution', 'nirmaan_trackaegis_25edcec5fdf3', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-253', 'Tragic bytes', 'BMS Institute of Technology', 'nirmaan_tragic_byt_14973894ebd9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-254', 'TrailBack', 'Engineering Institution', 'nirmaan_trailback_9fbf2901553e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-255', 'TriByte', 'BMS Institute of Technology', 'nirmaan_tribyte_7bdbc88028f2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-256', 'TriCore', 'Engineering Institution', 'nirmaan_tricore_73daf1a319f1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-257', 'Triggered Minds', 'Engineering Institution', 'nirmaan_triggered_0a159239331e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-258', 'Trio', 'Engineering Institution', 'nirmaan_trio_a921bc874aa1', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-259', 'Triple Espresso', 'Nitte Meenakshi Institute of Technology', 'nirmaan_triple_esp_320b3097dc14', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-260', 'Trishul', 'BMS Institute of Technology', 'nirmaan_trishul_3dcceeb01899', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-261', 'TriSpark', 'Engineering Institution', 'nirmaan_trispark_2bf9d379161f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-262', 'Trojan Hex', 'Engineering Institution', 'nirmaan_trojan_hex_f90a1b94cfc2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-263', 'ULTRON', 'Engineering Institution', 'nirmaan_ultron_b007d94dee2a', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-264', 'UNO-PI', 'Engineering Institution', 'nirmaan_uno_pi_9d63e20e1c63', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-265', 'Valorise', 'Engineering Institution', 'nirmaan_valorise_b7a88c94ced5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-266', 'Value', 'Engineering Institution', 'nirmaan_value_72e7760e6663', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-267', 'Vandhe mandharam', 'Engineering Institution', 'nirmaan_vandhe_man_87f61b58b3b4', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-268', 'Venom', 'Engineering Institution', 'nirmaan_venom_f05a8684594e', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-269', 'Veriloop edge', 'Engineering Institution', 'nirmaan_veriloop_e_893e64d15bcf', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-270', 'VERISYN', 'Engineering Institution', 'nirmaan_verisyn_93fe28cd83b9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-271', 'Vibe coders', 'Engineering Institution', 'nirmaan_vibe_coder_db681645903d', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-272', 'Virtual Soldiers', 'Engineering Institution', 'nirmaan_virtual_so_8f358a65ab34', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-273', 'Vishwakarma', 'Engineering Institution', 'nirmaan_vishwakarm_86158e26a4b9', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-274', 'VisionForge', 'Engineering Institution', 'nirmaan_visionforg_aa8c5e520f73', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-275', 'VisionX', 'Engineering Institution', 'nirmaan_visionx_1562d3207acd', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-276', 'Void', 'Engineering Institution', 'nirmaan_void_030be89681c5', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-277', 'VOLTIX', 'BMS Institute of Technology', 'nirmaan_voltix_981969e077b4', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-278', 'Voltvixion', 'Engineering Institution', 'nirmaan_voltvixion_7c706179c866', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-279', 'VORTEX', 'BMS Institute of Technology', 'nirmaan_vortex_959bcdb6cae2', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-280', 'Vriddhi 2.0 Digital Farms', 'Engineering Institution', 'nirmaan_vriddhi_2_8d0063a12b00', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-281', 'Wabi-sabi', 'Engineering Institution', 'nirmaan_wabi_sabi_dffb4f2542f0', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-282', 'WHOCODES', 'Engineering Institution', 'nirmaan_whocodes_6dae9ab8f826', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-283', 'WorkingSystems', 'Engineering Institution', 'nirmaan_workingsys_870f11bd1e41', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-284', 'Xing', 'Engineering Institution', 'nirmaan_xing_875c5fc8d0e6', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-285', 'YantraVidya', 'Engineering Institution', 'nirmaan_yantravidy_9622a8c7a02b', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-286', 'YJB Bytes', 'Engineering Institution', 'nirmaan_yjb_bytes_efa50d676f77', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-287', 'YoungDumb&Broke', 'BMS Institute of Technology', 'nirmaan_youngdumb_343547e775df', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-288', 'Yugam', 'Engineering Institution', 'nirmaan_yugam_8885cfc9879f', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.teams (id, team_name, college, qr_token, checked_in, breakfast_count, lunch_count, dinner_count, coffee_count) VALUES ('team-nir-289', 'Zero knowledge', 'BMS Institute of Technology', 'nirmaan_zero_knowl_9a8c63c71ede', false, 0, 0, 0, 0) ON CONFLICT (qr_token) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0001', 'team-nir-001', 'Chetan Kulkarni', '+91 90000 00000', 'chetankulkarni47@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0002', 'team-nir-001', 'Joel John Alex', '+91 90000 00000', 'joelalex0601@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0003', 'team-nir-001', 'Eshan Shukla', '+91 90000 00000', 'eshanshukla2005@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0004', 'team-nir-001', 'Aaryan', '+91 90000 00000', 'aaryankalsi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0005', 'team-nir-002', 'Bhoomika V Kashyap', '+91 90000 00000', 'bhoomikavkashyap@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0006', 'team-nir-002', 'Kishan B S', '+91 90000 00000', 'bskishan6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0007', 'team-nir-002', 'Vanama Sai Hiranmayi', '+91 90000 00000', 'vsaihiranmayi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0008', 'team-nir-003', 'Amith H. P', '+91 90000 00000', 'amithveerapura@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0009', 'team-nir-003', 'Akhilesh', '+91 90000 00000', 'pgoognga@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0010', 'team-nir-003', 'Gagandeep Bhat', '+91 90000 00000', 'gagandeepbhat2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0011', 'team-nir-004', 'Leela Sharanu', '+91 90000 00000', 'leelasharanu83@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0012', 'team-nir-004', 'Simran Gaur', '+91 90000 00000', 'simrangaur3448@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0013', 'team-nir-004', 'VARUN', '+91 90000 00000', 'varun.achar7777@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0014', 'team-nir-004', 'Prasad L', '+91 90000 00000', 'vprasad.150206@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0015', 'team-nir-004', 'Yadava HC', '+91 90000 00000', 'yadavahc333@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0016', 'team-nir-005', 'Saksham Jha', '+91 90000 00000', 'jhasaksham.7453k@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0017', 'team-nir-005', 'Member 2', '+91 90000 00000', 'aarushdnaik@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0018', 'team-nir-005', 'Adhvik Kumar Kusma', '+91 90000 00000', 'adhvikkumark@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0019', 'team-nir-006', 'Karthik T.S', '+91 90000 00000', 'karthik3b@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0020', 'team-nir-006', 'Adarsh', '+91 90000 00000', 'dev2adarsh@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0021', 'team-nir-007', 'Eshaan Agrawal', '+91 90000 00000', 'agrawaleshaan12@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0022', 'team-nir-007', 'Ryan Dave', '+91 90000 00000', 'ryandave5844@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0023', 'team-nir-007', 'Ashutosh Patel', '+91 90000 00000', 'ashutoshpatel0044@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0024', 'team-nir-007', 'Aditya Chauhan', '+91 90000 00000', 'adityachauhan25881@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0025', 'team-nir-008', 'Drushya. Deshpande', '+91 90000 00000', 'drushyardeshpande@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0026', 'team-nir-008', 'Shreya C', '+91 90000 00000', '01fe25bec136@kletech.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0027', 'team-nir-008', 'ASHWATH YADAV', '+91 90000 00000', 'ashwathyara02@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0028', 'team-nir-008', '01fe25bec059', '+91 90000 00000', '01fe25bec059@kletech.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0029', 'team-nir-009', 'Poshika Gorantla', '+91 90000 00000', '25ug1bycs0140@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0030', 'team-nir-009', 'Roshini M Kavell', '+91 90000 00000', 'roshmkavell52@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0031', 'team-nir-009', 'TANAY TOLE AIML-1-2025-29', '+91 90000 00000', '25ug1byai061@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0032', 'team-nir-010', 'Vasundhara CVNR', '+91 90000 00000', 'vcvnr26@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0033', 'team-nir-010', 'TEJASHREE', '+91 90000 00000', 'tejuanitha014@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0034', 'team-nir-011', 'aditya kumar', '+91 90000 00000', 'adityakumar73918@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0035', 'team-nir-011', 'Shivam', '+91 90000 00000', 'shivam.khanayat06@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0036', 'team-nir-011', 'Amogh Shanbhag', '+91 90000 00000', 'amoghvshanbhag@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0037', 'team-nir-012', 'Thodupunuri Sai Charan', '+91 90000 00000', 'saicharan02117@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0038', 'team-nir-012', 'Rahul Reddy', '+91 90000 00000', 'rahulreddyakkala6765@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0039', 'team-nir-012', 'Podugu Harish', '+91 90000 00000', 'poduguharish947@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0040', 'team-nir-012', 'Aakashreddy Maramreddy', '+91 90000 00000', 'aakashreddymaramreddy84@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0041', 'team-nir-013', 'LIKHITHA A', '+91 90000 00000', '1nt24is053.ayyapasetti@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0042', 'team-nir-013', 'Allan Saju', '+91 90000 00000', '1nt24is026.allan@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0043', 'team-nir-013', 'AMSHU G', '+91 90000 00000', '1nt24is032.amshu@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0044', 'team-nir-013', 'ABHINAV PRASHANTH', '+91 90000 00000', '1nt24is005.abhinav@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0045', 'team-nir-014', 'SAMARTH H RAO', '+91 90000 00000', '1nt24is190.samarth@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0046', 'team-nir-014', 'ADITI M', '+91 90000 00000', '1nt24is012.aditi@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0047', 'team-nir-014', 'Umme Kulsum Durrani', '+91 90000 00000', '1nt24is237.umme@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0048', 'team-nir-014', 'AISHWARYA R', '+91 90000 00000', '1nt24is019.aishwarya@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0049', 'team-nir-015', 'Alok Verma', '+91 90000 00000', 'verma07.alok@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0050', 'team-nir-016', 'Lucky Gupta', '+91 90000 00000', 'lucky100gpt@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0051', 'team-nir-016', 'Harish Kumar', '+91 90000 00000', 'hv88786@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0052', 'team-nir-016', 'Raghavendra Singh Shekhawat', '+91 90000 00000', 'raghavgeca@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0053', 'team-nir-017', 'Aryan Sujay Kumar UK', '+91 90000 00000', '24ug1bycs1133@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0054', 'team-nir-017', 'Shivani Shenoy CSE-10', '+91 90000 00000', '24ug1bycs118@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0055', 'team-nir-017', 'ABHILASH HM', '+91 90000 00000', 'hmabhilash15@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0056', 'team-nir-017', 'Member 4', '+91 90000 00000', '24ug1bycs793@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0057', 'team-nir-018', 'GAJJELA ANJALI', '+91 90000 00000', '25wh5a0404@bvrithyderabad.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0058', 'team-nir-018', 'Shiva Satya Sri Lakshmi Prasanna Arlapalli', '+91 90000 00000', 'shivasriprasanna@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0059', 'team-nir-018', 'Shivapreethi Kanchari', '+91 90000 00000', 'shivapreethikanchari@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0060', 'team-nir-018', 'NAGARAPU STHUTHI', '+91 90000 00000', '25wh5a0406@bvrithyderabad.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0061', 'team-nir-019', 'Hithesh Gowda AM', '+91 90000 00000', 'hithugowda052006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0062', 'team-nir-019', 'Hruday NR', '+91 90000 00000', 'nrhruday@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0063', 'team-nir-019', 'Shivarjun V', '+91 90000 00000', 'shivarjun192@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0064', 'team-nir-019', 'Sanjay B', '+91 90000 00000', 'sanjaysanju7019572@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0065', 'team-nir-020', 'Abhienaya Sri Soundarajan', '+91 90000 00000', 'abhienayasris@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0066', 'team-nir-020', 'Afra Mariyam A', '+91 90000 00000', 'aframariyam2004@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0067', 'team-nir-020', 'SANJAY V', '+91 90000 00000', 'sec22cj002@sairamtap.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0068', 'team-nir-021', 'Navya Nawal', '+91 90000 00000', 'navyanawal4396@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0069', 'team-nir-021', 'Member 2', '+91 90000 00000', 'gauravscs54@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0070', 'team-nir-021', 'Anurag Dwivedi', '+91 90000 00000', 'adwivedi3506@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0071', 'team-nir-021', 'K K PRAVEEN CSE-7-2025-29', '+91 90000 00000', '25ug1bycs0123@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0072', 'team-nir-022', 'Aaditya A Wol', '+91 90000 00000', 'aadityawol223@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0073', 'team-nir-022', 'Ansh Anand', '+91 90000 00000', 'ansh.a.3112@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0074', 'team-nir-022', 'VARUN PRATAP SINGH', '+91 90000 00000', 'singhvarun2109@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0075', 'team-nir-022', 'Krishna', '+91 90000 00000', 'krishna.raipuria2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0076', 'team-nir-023', 'Nikhil Bistannanavar', '+91 90000 00000', 'nikhilbistannanavar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0077', 'team-nir-023', 'Jayanth VD', '+91 90000 00000', 'jayanthvd25@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0078', 'team-nir-023', 'Shivu', '+91 90000 00000', 'shivaprasadcm9292@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0079', 'team-nir-023', 'Navya Naveen', '+91 90000 00000', 'navyanaveen646@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0080', 'team-nir-024', 'Krishnaveni V', '+91 90000 00000', 'krishnaveniv.ise.rymec@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0081', 'team-nir-024', 'K Shereen', '+91 90000 00000', 'kshereen8431@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0082', 'team-nir-024', 'Christin Amulya G', '+91 90000 00000', 'christyamulya32@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0083', 'team-nir-025', 'Tharjun S', '+91 90000 00000', 'tharjun00@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0084', 'team-nir-025', 'Aishwarya S', '+91 90000 00000', 'aishwaryashri.s6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0085', 'team-nir-025', 'Mohan', '+91 90000 00000', 'mohanhmmaheshn@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0086', 'team-nir-025', 'Ameet Gowda', '+91 90000 00000', 'ameetgowda@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0087', 'team-nir-026', 'Sanjay Kumar', '+91 90000 00000', 'sanjaybrox@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0088', 'team-nir-027', 'Vicky Ric', '+91 90000 00000', 'vickyric455@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0089', 'team-nir-028', 'Vihan V', '+91 90000 00000', 'vihanv2469@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0090', 'team-nir-028', 'V.Lakshan', '+91 90000 00000', 'vlakshan1508@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0091', 'team-nir-028', 'Srivats Arjun', '+91 90000 00000', 'arjun.srpa@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0092', 'team-nir-029', 'Shivakumar', '+91 90000 00000', 'shivakumarwali557@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0093', 'team-nir-029', 'Member 2', '+91 90000 00000', 'tejasteju0717@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0094', 'team-nir-029', 'Vishal V R', '+91 90000 00000', 'vvr66486@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0095', 'team-nir-029', 'Ujwal Kumar L', '+91 90000 00000', 'ujwalkumarl.contact@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0096', 'team-nir-030', 'Nisarga N', '+91 90000 00000', 'nisarganagesh15@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0097', 'team-nir-030', 'ANUSHREE M V CIVIL-2025-29', '+91 90000 00000', '25ug1bycv048@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0098', 'team-nir-030', 'Amulya T R', '+91 90000 00000', 'amulyatr7002@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0099', 'team-nir-031', 'Jagadish Naik', '+91 90000 00000', 'jagadishnaikgerusoppa@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0100', 'team-nir-031', 'Ashwin Nethan', '+91 90000 00000', 'ashwinnethan07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0101', 'team-nir-031', 'Shaheem Niyaz', '+91 90000 00000', 'shaheembn@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0102', 'team-nir-031', 'Prajna', '+91 90000 00000', 'pt26210705@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0103', 'team-nir-032', 'Prithish S', '+91 90000 00000', 'prithishsprithish2008@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0104', 'team-nir-032', 'Dhinesh Karthick D', '+91 90000 00000', 'dhineshkarthickd.ece2025@citchennai.net', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0105', 'team-nir-032', 'RAJAPRIYAN R', '+91 90000 00000', 'rajapriyanraj10608@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0106', 'team-nir-032', 'Vimalesh Vimal', '+91 90000 00000', 'vimaleshv87@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0107', 'team-nir-033', 'SANYAM DEEPTMURTY', '+91 90000 00000', 'sanyamdeeptmurty@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0108', 'team-nir-033', 'SHISHIR VERMA', '+91 90000 00000', 'shishirver16@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0109', 'team-nir-033', 'Krishnangshu Bhowmick', '+91 90000 00000', 'krishnangshu.bhowmick@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0110', 'team-nir-033', 'Suryamani', '+91 90000 00000', 'surya577123@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0111', 'team-nir-034', 'RISHABH R NAIR', '+91 90000 00000', 'rishabhrnair.24cs@saividya.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0112', 'team-nir-034', 'Member 2', '+91 90000 00000', 'melvinss2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0113', 'team-nir-034', 'Siddharth C', '+91 90000 00000', 'csiddharth311@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0114', 'team-nir-034', 'Karthik G', '+91 90000 00000', 'karthikgirish2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0115', 'team-nir-035', 'Divyanshu Rauniyar', '+91 90000 00000', 'yanshudiv22@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0116', 'team-nir-035', 'Shubham Kumar Sah', '+91 90000 00000', 'shubhamshah.business05@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0117', 'team-nir-035', 'Bibek Harijan', '+91 90000 00000', 'erbibekharijan@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0118', 'team-nir-035', 'Member 4', '+91 90000 00000', 'anushka0206008@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0119', 'team-nir-036', 'Thanav PS', '+91 90000 00000', 'thanavps.1234@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0120', 'team-nir-036', 'Saanvi C P', '+91 90000 00000', 'cpsaanvi2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0121', 'team-nir-036', 'Ranjith Kumar k.A', '+91 90000 00000', 'ranjithka194@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0122', 'team-nir-036', 'Nisha Kalose', '+91 90000 00000', 'nishakn8118@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0123', 'team-nir-037', 'CHINMAYI M AIML', '+91 90000 00000', 'vvce25cseaiml0048@vvce.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0124', 'team-nir-037', 'Dhanush P', '+91 90000 00000', 'vvce25cseaiml0168@vvce.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0125', 'team-nir-037', 'BIDDAPPA M S', '+91 90000 00000', 'vvce25cseaiml0111@vvce.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0126', 'team-nir-038', 'Nagarjun Gowda K N CS-2023-27', '+91 90000 00000', '1by23cs130@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0127', 'team-nir-038', 'Nakul B', '+91 90000 00000', '1by23cs132@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0128', 'team-nir-038', 'Jayanth Gopala V CS-2023-27', '+91 90000 00000', '1by23cs092@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0129', 'team-nir-039', 'Jyothi Nagesh Moger', '+91 90000 00000', 'jyothinageshmogerjyothinageshm@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0130', 'team-nir-039', 'Member 2', '+91 90000 00000', 'pallaviiss777@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0131', 'team-nir-039', 'Shrey Srivastava', '+91 90000 00000', 'shrey.srivastava777@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0132', 'team-nir-040', 'Padmavathi', '+91 90000 00000', 'padmavatishreenivas@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0133', 'team-nir-041', 'Piyush Salunke', '+91 90000 00000', 'piyushsalunke16@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0134', 'team-nir-041', 'Vineeth Gowda', '+91 90000 00000', 'vineethgowda68@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0135', 'team-nir-041', 'Abhiram Adiga', '+91 90000 00000', 'abhiramadiga1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0136', 'team-nir-041', 'Lakshya Sharma', '+91 90000 00000', 'itslakshya777@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0137', 'team-nir-042', 'Ankit Kullkarni', '+91 90000 00000', 'ankitskulkarni@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0138', 'team-nir-042', 'RISHAB C M', '+91 90000 00000', 'rishabcm7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0139', 'team-nir-042', '01fe25bec069', '+91 90000 00000', '01fe25bec069@kletech.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0140', 'team-nir-042', 'Siddartha R Jamakhandi', '+91 90000 00000', 'siddharthjamkandi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0141', 'team-nir-043', 'Sinchana Gopal Naik', '+91 90000 00000', 'sinchunaik90@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0142', 'team-nir-043', 'Shivani S', '+91 90000 00000', 'shivanisaradhya13@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0143', 'team-nir-043', 'Tanushree Balusu', '+91 90000 00000', 'tanushreebalusu1723@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0144', 'team-nir-043', 'Ramya S R', '+91 90000 00000', 'ramyabeavy@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0145', 'team-nir-044', 'Meher Tasneem', '+91 90000 00000', 'mehertasneem97@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0146', 'team-nir-044', 'Saniya Mohammadi', '+91 90000 00000', 'saniyamohammadi92@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0147', 'team-nir-044', 'H Pallavi', '+91 90000 00000', 'pallavigowda130406@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0148', 'team-nir-045', 'Chethan G K', '+91 90000 00000', 'chethanagk87@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0149', 'team-nir-045', 'yashwanth b', '+91 90000 00000', 'yashuhb375@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0150', 'team-nir-045', 'Gagan N', '+91 90000 00000', 'gn653037@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0151', 'team-nir-045', 'CHANDAN KUMAR', '+91 90000 00000', '1nt25cs418t.chandan@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0152', 'team-nir-046', 'Aadvik Nandisha Gowda', '+91 90000 00000', '24ug1bycs221@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0153', 'team-nir-046', 'Shashank Sriram', '+91 90000 00000', '24ug1bycs178@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0154', 'team-nir-046', 'Lakshay Khatri CSE-6', '+91 90000 00000', '24ug1bycs370@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0155', 'team-nir-046', 'Gautam Shivanath Joshi', '+91 90000 00000', '24ug1bycs250@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0156', 'team-nir-047', 'Navya', '+91 90000 00000', 'ns7767312@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0157', 'team-nir-047', 'Inchara S Babu', '+91 90000 00000', 'sbabuinchara@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0158', 'team-nir-047', 'Poorvika S Javali', '+91 90000 00000', '24ug1byec145@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0159', 'team-nir-047', 'Mansi Guruprasad', '+91 90000 00000', 'mansigurup@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0160', 'team-nir-048', 'Darshan S', '+91 90000 00000', 'daachhu2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0161', 'team-nir-048', 'CHANDANA N', '+91 90000 00000', 'chandana211222@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0162', 'team-nir-048', 'Chethana P', '+91 90000 00000', 'chethana.kb17@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0163', 'team-nir-048', 'Umesh S Rathod', '+91 90000 00000', 'umeshsrathod8@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0164', 'team-nir-049', 'Andrew Tom Jacob MECH-2024-28', '+91 90000 00000', '24ug1byme065@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0165', 'team-nir-049', 'Rebecca', '+91 90000 00000', 'rebeccamiriamjacob@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0166', 'team-nir-049', 'Thejas Srinivas', '+91 90000 00000', 'thejassrenevas@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0167', 'team-nir-050', 'Ranjiv Krishnan', '+91 90000 00000', 'ranjivnair7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0168', 'team-nir-050', 'Anish Chetri', '+91 90000 00000', 'chandrachetry78620@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0169', 'team-nir-050', 'Mohammed Tazeem', '+91 90000 00000', 'mohammedtazeem846@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0170', 'team-nir-050', 'Nethanya Gowda', '+91 90000 00000', 'nethanyagowda65@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0171', 'team-nir-051', 'Vishnu HM', '+91 90000 00000', 'aakashreddyhm@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0172', 'team-nir-051', 'Vinay G', '+91 90000 00000', 'vinayg0210@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0173', 'team-nir-052', 'Rajath DK', '+91 90000 00000', 'rajathdkori1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0174', 'team-nir-052', 'Tejas K P', '+91 90000 00000', 'voltejas386@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0175', 'team-nir-052', 'Amogh M S', '+91 90000 00000', 'rimpstudio2997@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0176', 'team-nir-052', 'Venkatesh.N', '+91 90000 00000', 'venky23106@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0177', 'team-nir-053', 'Mohar Barat', '+91 90000 00000', '466mohar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0178', 'team-nir-053', 'Govind', '+91 90000 00000', 'govindrai2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0179', 'team-nir-053', 'Sneha Mukhopadhyay', '+91 90000 00000', 'snehamukhopadhyay7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0180', 'team-nir-053', 'Maria', '+91 90000 00000', 'mariaarshad453@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0181', 'team-nir-054', 'ADARSH BURIGINA CHANDRU ECE-2-2025-29', '+91 90000 00000', '25ug1byec043@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0182', 'team-nir-054', 'Mohith N', '+91 90000 00000', 'nmohith48@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0183', 'team-nir-054', 'Dasthagiri C', '+91 90000 00000', 'dastha050507@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0184', 'team-nir-054', 'Member 4', '+91 90000 00000', 'muniritheshbathala@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0185', 'team-nir-055', 'Manasa', '+91 90000 00000', 'm74663850@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0186', 'team-nir-055', 'Sujith', '+91 90000 00000', 'sujiths.m13@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0187', 'team-nir-055', 'Videesha A G', '+91 90000 00000', 'videeshaag@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0188', 'team-nir-055', 'Member 4', '+91 90000 00000', 'simrabegum28@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0189', 'team-nir-056', 'PRATHAM M', '+91 90000 00000', 'prathamgadal05@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0190', 'team-nir-057', 'Hrithik G V', '+91 90000 00000', 'hrithikgv5@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0191', 'team-nir-057', 'Madhu T', '+91 90000 00000', 'mtvipooo123@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0192', 'team-nir-057', 'Preetham Noronha', '+91 90000 00000', 'preethamnoronha764@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0193', 'team-nir-058', 'avanthi bheemireddy', '+91 90000 00000', 'bheemireddyavanthi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0194', 'team-nir-058', 'S Tabassum', '+91 90000 00000', 'tabbuswn118@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0195', 'team-nir-058', 'Nihaarika Madhunandan', '+91 90000 00000', 'nihaarikamadhunandan2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0196', 'team-nir-058', 'Muhammad Sabith', '+91 90000 00000', 'muhammad.sabith2k7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0197', 'team-nir-059', 'Kusuma K S', '+91 90000 00000', 'kusumaks682@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0198', 'team-nir-059', 'Trupthi Nazre K', '+91 90000 00000', 'nazrektrupthi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0199', 'team-nir-059', 'Arpitha S', '+91 90000 00000', 'arpitha.s05062005@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0200', 'team-nir-060', 'Keshav G K', '+91 90000 00000', 'keshavkokre30@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0201', 'team-nir-061', 'Manvith R', '+91 90000 00000', 'manvithnaik24@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0202', 'team-nir-061', 'Hemanth GM', '+91 90000 00000', 'hemanthgmahesh@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0203', 'team-nir-062', 'POOJA S', '+91 90000 00000', '1nt24ec101.pooja@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0204', 'team-nir-062', 'KALPANA K', '+91 90000 00000', '1nt24ec059.kalpana@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0205', 'team-nir-062', 'Ramya C', '+91 90000 00000', '1nt24ec121.ramya@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0206', 'team-nir-062', 'KAVYA K', '+91 90000 00000', '1nt24cs128.kavya@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0207', 'team-nir-063', 'Shanmuga Priyan E', '+91 90000 00000', 'shanmugapriyane7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0208', 'team-nir-063', 'Devipriya S', '+91 90000 00000', 'sdevipriya1234@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0209', 'team-nir-063', 'Vinod Kumar Vemagal Raviprasad', '+91 90000 00000', 'vinodkumar262006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0210', 'team-nir-063', 'Srishti B.S', '+91 90000 00000', 'srishtisrivatsa4@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0211', 'team-nir-064', 'Jahnavi', '+91 90000 00000', 'jahnavi2665@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0212', 'team-nir-064', 'NAITHRESH R', '+91 90000 00000', 'naithresh123@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0213', 'team-nir-064', 'Kajal Gupta R', '+91 90000 00000', 'kajalgupta8217@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0214', 'team-nir-064', 'Aarushi rai', '+91 90000 00000', 'raiaarushi108@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0215', 'team-nir-065', 'Aarushi rai', '+91 90000 00000', 'aarushirai426@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0216', 'team-nir-066', 'Srivathsa S Murthy', '+91 90000 00000', 'srivathsamurthys.1745@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0217', 'team-nir-066', 'Sriram P.S', '+91 90000 00000', 'pssriram2005@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0218', 'team-nir-066', 'Rohith Vishwanath', '+91 90000 00000', 'rohithvishwanath1789@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0219', 'team-nir-066', 'Wilfred Dsouza', '+91 90000 00000', 'wilfred2668@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0220', 'team-nir-067', 'Chirag Ns', '+91 90000 00000', 'chiruns444@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0221', 'team-nir-067', 'Prajwal Ramachandra Bhagwat', '+91 90000 00000', 'prajwalbhagwathofficial@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0222', 'team-nir-067', 'Amulya Amulya', '+91 90000 00000', 'amulya2447@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0223', 'team-nir-067', 'Sneha Gupta', '+91 90000 00000', 'snehagupta.y@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0224', 'team-nir-068', 'Padma Varshini D', '+91 90000 00000', 'amruthapvd4@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0225', 'team-nir-068', 'Mehal Bhagat', '+91 90000 00000', 'mehalbhagat13@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0226', 'team-nir-068', 'Purvitha C', '+91 90000 00000', 'purvithac@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0227', 'team-nir-069', 'Akshita Raj', '+91 90000 00000', 'akshitasuman2009@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0228', 'team-nir-069', 'Member 2', '+91 90000 00000', 'tanushreepatil73539@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0229', 'team-nir-069', 'Aananya Raj', '+91 90000 00000', 'aananyaraj588@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0230', 'team-nir-070', 'Nicksan Raj', '+91 90000 00000', 'nicksanraj2008@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0231', 'team-nir-070', 'Yugesh Kumar', '+91 90000 00000', 'yugeshkumar.1510@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0232', 'team-nir-070', 'NILAVARASAN GOVINDASAMY', '+91 90000 00000', 'nilavarasangovindasamy@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0233', 'team-nir-070', 'Vinay Vighnesh S', '+91 90000 00000', 'vinay.cv8tha@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0234', 'team-nir-071', 'Jothi sivan', '+91 90000 00000', 'jsivan2009@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0235', 'team-nir-071', 'Harshith Ravindran', '+91 90000 00000', 'harshithrchandrathil@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0236', 'team-nir-071', 'Devansh Vikram Singh', '+91 90000 00000', 'd3vansh2008@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0237', 'team-nir-071', 'CHIDAMBAR D GOWDA', '+91 90000 00000', 'gchidambar29@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0238', 'team-nir-072', 'Ashutosh', '+91 90000 00000', 'ashutoshbhatt2609@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0239', 'team-nir-072', 'Srinidhi P', '+91 90000 00000', 'srinidhip06@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0240', 'team-nir-072', 'Ansu Kumar', '+91 90000 00000', 'ansukumar2111@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0241', 'team-nir-073', 'Navya T J', '+91 90000 00000', 'navya08042006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0242', 'team-nir-073', 'Aadi Jain', '+91 90000 00000', 'aadi4aug2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0243', 'team-nir-073', 'Adarsh Hiremath', '+91 90000 00000', 'hiremathadarsh0@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0244', 'team-nir-073', 'Ankur Agrawal', '+91 90000 00000', 'ankuragrawal1742006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0245', 'team-nir-074', 'Varun Sai', '+91 90000 00000', 'vsai17886@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0246', 'team-nir-075', 'Utkarsh Tripathi', '+91 90000 00000', 'tripathiutkarsh7000@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0247', 'team-nir-075', 'Devansh Mishra', '+91 90000 00000', 'devanshmishra643@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0248', 'team-nir-075', 'Priyanshu Ranjan', '+91 90000 00000', 'priyanshuranjan1512@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0249', 'team-nir-076', 'Madiha Anjum', '+91 90000 00000', 'madihaanjum448@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0250', 'team-nir-076', 'Anshu RAJ', '+91 90000 00000', '24ug1bycs606@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0251', 'team-nir-076', 'Annanya Sharma', '+91 90000 00000', 'annanya1008.hsr@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0252', 'team-nir-076', 'Havana Ahlada', '+91 90000 00000', 'ahladahavana@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0253', 'team-nir-077', 'Midhunshabari A', '+91 90000 00000', 'midhunshabari@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0254', 'team-nir-078', 'Harikishan B S', '+91 90000 00000', 'harikishanbs03@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0255', 'team-nir-078', 'Gautham Adithya', '+91 90000 00000', 'gauthamks0706@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0256', 'team-nir-078', 'Gagan r Ravikumar', '+91 90000 00000', 'gaganravikumar2788@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0257', 'team-nir-079', 'PRANAM N.KOTIAN', '+91 90000 00000', 'pranamnkotian14@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0258', 'team-nir-079', 'Nivas M', '+91 90000 00000', 'nivasm7958@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0259', 'team-nir-079', 'Siddu B G R', '+91 90000 00000', 'bgrsiddu86605@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0260', 'team-nir-079', 'Ashith Cherian', '+91 90000 00000', 'ashith04.eagle@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0261', 'team-nir-080', 'Kommajosyula sai chandana', '+91 90000 00000', '23r01a05f5@cmrithyderabad.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0262', 'team-nir-081', 'Sabari S', '+91 90000 00000', 'sabari19eee@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0263', 'team-nir-082', 'Y Devendra Kumar', '+91 90000 00000', 'devendrabunny02@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0264', 'team-nir-082', 'G Veena Anupama', '+91 90000 00000', 'gveenaanupama@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0265', 'team-nir-082', 'M Shree Raksha', '+91 90000 00000', 'raksha200703@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0266', 'team-nir-083', 'Soujanya', '+91 90000 00000', 'jainsoujanya03@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0267', 'team-nir-083', 'Yuvraj Gowda K', '+91 90000 00000', 'gowdayuvraj528@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0268', 'team-nir-083', 'Mandara K R', '+91 90000 00000', 'mandaragowda93@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0269', 'team-nir-083', 'Varun Sahu', '+91 90000 00000', 'sahukarvarun23@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0270', 'team-nir-084', 'Aishwarya Aishu', '+91 90000 00000', 'aishwaryaishu762@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0271', 'team-nir-084', 'Member 2', '+91 90000 00000', 'likhitha2203@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0272', 'team-nir-084', 'Ashwini R G', '+91 90000 00000', 'ashwinirudrappa24@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0273', 'team-nir-084', 'Preetham', '+91 90000 00000', 'preethamd1415@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0274', 'team-nir-085', 'Harshita Shakya', '+91 90000 00000', 'shakyaharshita71@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0275', 'team-nir-085', 'Vaibhav Chindalia', '+91 90000 00000', 'vaibhav.chindalia.78@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0276', 'team-nir-085', 'Omi Agarwal', '+91 90000 00000', 'omiagarwal84@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0277', 'team-nir-085', 'Abhishek Iyer', '+91 90000 00000', 'iyerabhishek23@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0278', 'team-nir-086', 'Soumili Mitra', '+91 90000 00000', 'soumilimitra07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0279', 'team-nir-086', 'Rashmi G B', '+91 90000 00000', 'gbrashmi2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0280', 'team-nir-086', 'Suvarna Narawade', '+91 90000 00000', 'suvarnanarawade0@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0281', 'team-nir-086', 'Chandana Sree', '+91 90000 00000', 'chandanasreev11@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0282', 'team-nir-087', 'B Mahalakshmi', '+91 90000 00000', '24ug1byee065@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0283', 'team-nir-087', 'Member 2', '+91 90000 00000', '24ug1byee023@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0284', 'team-nir-087', 'Nagaveni Navalagatti', '+91 90000 00000', '24ug1byee024@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0285', 'team-nir-087', 'Ankitha S', '+91 90000 00000', '24ug1byee064@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0286', 'team-nir-088', 'Mahesh Kumar', '+91 90000 00000', 'rmaheshk71@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0287', 'team-nir-088', 'Nithin Kumar', '+91 90000 00000', 'nithinkumarm944@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0288', 'team-nir-088', 'Syeda Rafiya Kousar', '+91 90000 00000', 'syedarafiya5486@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0289', 'team-nir-088', 'Harsha Vardhan R', '+91 90000 00000', 'harshavardhan2873@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0290', 'team-nir-089', 'Santoshi SM', '+91 90000 00000', 'santoshi.24ece@cambridge.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0291', 'team-nir-089', 'Skandhana B', '+91 90000 00000', 'skandhana2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0292', 'team-nir-089', 'Siri Jagadeesh', '+91 90000 00000', 'sirijagadeesh07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0293', 'team-nir-089', 'Joshnavi', '+91 90000 00000', 'joshnavi138@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0294', 'team-nir-090', 'P Tharun', '+91 90000 00000', 'tharun226580@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0295', 'team-nir-091', 'Shivam Shantkumar', '+91 90000 00000', 'shivams7082@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0296', 'team-nir-091', 'sajjan vikas', '+91 90000 00000', 'sajjanvikas18@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0297', 'team-nir-091', 'Diva M', '+91 90000 00000', 'diva305379@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0298', 'team-nir-091', 'Yana Agrawal', '+91 90000 00000', 'agrawalyana90@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0299', 'team-nir-092', 'Shikta Roy', '+91 90000 00000', 'royshik4306@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0300', 'team-nir-092', 'Samiksha Mawani ECE-1', '+91 90000 00000', '24ug1byec071@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0301', 'team-nir-092', 'Thanushree B S ECE-1', '+91 90000 00000', '24ug1byec018@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0302', 'team-nir-093', 'Anshu RAJ', '+91 90000 00000', 'anshuraj9142@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0303', 'team-nir-094', 'Vishwas H K', '+91 90000 00000', 'vishwashk94@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0304', 'team-nir-094', 'Shreyas N D', '+91 90000 00000', 'shreyas.nd@cmr.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0305', 'team-nir-094', 'Mukund G', '+91 90000 00000', 'mukundg13aug07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0306', 'team-nir-094', 'Rinku Solanki', '+91 90000 00000', 'rinkusolanki2104@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0307', 'team-nir-095', 'MILANRAJ', '+91 90000 00000', 'milanraj.23cs071@sode-edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0308', 'team-nir-095', 'Member 2', '+91 90000 00000', 'manya.23cs070@sode-edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0309', 'team-nir-095', 'MANYA MANYA', '+91 90000 00000', 'manya.23cs069@sode-edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0310', 'team-nir-095', 'RAHUL RAHUL', '+91 90000 00000', 'rahul.23cs110@sode-edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0311', 'team-nir-096', 'D.Kuldeep', '+91 90000 00000', 'kuldeepkumar111708@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0312', 'team-nir-096', 'HARSHAN DJ', '+91 90000 00000', 'harshan.2405028@srec.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0313', 'team-nir-096', 'Mithilan C', '+91 90000 00000', 'kuldeepkumar111707@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0314', 'team-nir-097', 'Karan allan', '+91 90000 00000', 'karanallanp@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0315', 'team-nir-097', 'Kishan Avinash', '+91 90000 00000', 'kishanavinash2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0316', 'team-nir-097', 'Naren Karthikeyan', '+91 90000 00000', 'narensuresh2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0317', 'team-nir-097', 'MOHITRAJ D', '+91 90000 00000', 'mohitraj1785@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0318', 'team-nir-098', 'Niharika B', '+91 90000 00000', 'bniharika2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0319', 'team-nir-098', 'Member 2', '+91 90000 00000', 'jeevithajeeva002@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0320', 'team-nir-098', 'Aditi P Rao', '+91 90000 00000', 'aditiprao13@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0321', 'team-nir-099', 'BHUVAN M H', '+91 90000 00000', 'bhuvanmh2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0322', 'team-nir-099', 'Bala Skandha C', '+91 90000 00000', 'balaskandhac99@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0323', 'team-nir-099', 'Harikrishna G', '+91 90000 00000', 'harikrishnag1422@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0324', 'team-nir-099', 'Puneeth M', '+91 90000 00000', 'puni50395@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0325', 'team-nir-100', 'VISHNU VARDHAN.M', '+91 90000 00000', 'itzvishnu46@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0326', 'team-nir-101', 'Anand raman', '+91 90000 00000', 'anand1742006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0327', 'team-nir-101', 'Member 2', '+91 90000 00000', 'thesu.h.jaswantbabu@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0328', 'team-nir-101', 'Jerry hyacin.J', '+91 90000 00000', 'jerryhyacin933@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0329', 'team-nir-102', 'Kartik Jain', '+91 90000 00000', 'mastryhub@jkartik.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0330', 'team-nir-103', 'Dhananjay s u', '+91 90000 00000', 'dhananjaysu06@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0331', 'team-nir-103', 'Talari Venkata Sai Navadeep', '+91 90000 00000', 'talarinavadeep4112@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0332', 'team-nir-103', 'Sannidhi k n', '+91 90000 00000', 'sannidhiknedu@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0333', 'team-nir-103', 'Partha A B', '+91 90000 00000', 'partha8smg@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0334', 'team-nir-104', 'Ajay Krishna', '+91 90000 00000', 'ajaykrishnad2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0335', 'team-nir-104', 'Pradeeni', '+91 90000 00000', 'pradeevino30@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0336', 'team-nir-104', 'Ananya J', '+91 90000 00000', 'ananya27127@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0337', 'team-nir-104', 'Vijitha S', '+91 90000 00000', '06vijitha@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0338', 'team-nir-105', 'MOHAMED * FAZIL * PASHA', '+91 90000 00000', 'mohamedfazilpasha786@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0339', 'team-nir-105', 'HARSHA H R', '+91 90000 00000', '1si24is035@sit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0340', 'team-nir-105', 'Preetham A K', '+91 90000 00000', 'preethamandhani@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0341', 'team-nir-106', 'Prime R S', '+91 90000 00000', 'rsprime265@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0342', 'team-nir-106', 'Sugumar K', '+91 90000 00000', 'sugumarkailasamathani@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0343', 'team-nir-107', 'Akash R', '+91 90000 00000', 'akashakashr505@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0344', 'team-nir-107', 'Akshath ch', '+91 90000 00000', 'akshathch567@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0345', 'team-nir-107', 'Akash P', '+91 90000 00000', 'akash191112@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0346', 'team-nir-107', 'Member 4', '+91 90000 00000', 'anaghajoshika@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0347', 'team-nir-108', 'Lokesh702', '+91 90000 00000', 'blackhut053@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0348', 'team-nir-108', 'Neela Koraddi', '+91 90000 00000', 'neelakoraddi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0349', 'team-nir-108', 'Shubham', '+91 90000 00000', 'shubhamsheelvant88@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0350', 'team-nir-108', 'Nikhil. A', '+91 90000 00000', 'nikhila_25beis@acharya.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0351', 'team-nir-109', 'Ruchita P Sarathy', '+91 90000 00000', 'ruchitapsarathy@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0352', 'team-nir-109', 'Prachi Agrawal', '+91 90000 00000', 'prachiagrwal2008@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0353', 'team-nir-109', 'Bhavana K', '+91 90000 00000', 'bhavana.k4747@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0354', 'team-nir-109', 'rohini 26', '+91 90000 00000', 'rohinigirish2626@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0355', 'team-nir-110', 'Sanjana P R', '+91 90000 00000', 'sanjanapr.25ds@cambridge.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0356', 'team-nir-110', 'thanushrees 25ds', '+91 90000 00000', 'thanushrees.25ds@cambridge.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0357', 'team-nir-110', 'sanikaas 25ds', '+91 90000 00000', 'sanikaas.25ds@cambridge.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0358', 'team-nir-111', 'Aadya Karibasappa Bankapur', '+91 90000 00000', 'aadyabankapur@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0359', 'team-nir-111', 'VIJAYALAKSHMI J KORI', '+91 90000 00000', 'vijayalakshmijk44@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0360', 'team-nir-111', 'Aishwarya Byadgi', '+91 90000 00000', 'aishwaryabyadgi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0361', 'team-nir-111', 'Shubham s', '+91 90000 00000', 'shubham.s062003@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0362', 'team-nir-112', 'Benak S Gowda', '+91 90000 00000', 'gowdabenaks@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0363', 'team-nir-112', 'Harsha V', '+91 90000 00000', 'harsha.v.1011@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0364', 'team-nir-112', 'Mithun kumar', '+91 90000 00000', 'mithunkumarar3@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0365', 'team-nir-113', 'Rajan Parmar', '+91 90000 00000', 'parmarrajan347@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0366', 'team-nir-114', 'Amrutha K', '+91 90000 00000', 'amruthak8b.stdominics@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0367', 'team-nir-114', 'RASHMIKA K', '+91 90000 00000', 'rashmikakk09@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0368', 'team-nir-114', 'Suhas bhat', '+91 90000 00000', 'sxhxs08@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0369', 'team-nir-114', 'Vedanth J Gowda', '+91 90000 00000', 'vedanthjgowda07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0370', 'team-nir-115', 'Kartikay Sahni', '+91 90000 00000', 'kartikaysahni19@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0371', 'team-nir-115', 'Sai Bhavesh', '+91 90000 00000', 'saibhaveshmurthy@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0372', 'team-nir-115', 'Parth Warrier', '+91 90000 00000', 'parthwarrier7g@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0373', 'team-nir-115', 'Arhan', '+91 90000 00000', 'arhanattri16@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0374', 'team-nir-116', 'N A Srinivasa', '+91 90000 00000', '24ug1bycs1018@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0375', 'team-nir-116', 'Mohammed Meraj Khan CSE-14-2024-28', '+91 90000 00000', '24ug1bycs994@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0376', 'team-nir-116', 'Gowreesh CSE-14-2024-28', '+91 90000 00000', '24ug1bycs1042@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0377', 'team-nir-117', 'G Snehalatha', '+91 90000 00000', 'g.snehalatha18@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0378', 'team-nir-117', 'Anika Manjunatha', '+91 90000 00000', 'anikamanjunatha57@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0379', 'team-nir-117', 'Manya Mahendar', '+91 90000 00000', 'manyamahendar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0380', 'team-nir-117', 'Jyothi K S', '+91 90000 00000', 'jyothiks303@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0381', 'team-nir-118', 'Poojalakshmi H CSE-3', '+91 90000 00000', '24ug1bycs848@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0382', 'team-nir-119', 'Mohan Aralikatti', '+91 90000 00000', 'mohan.r.aralikatti@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0383', 'team-nir-120', 'Shruti G', '+91 90000 00000', 'shrutigklr@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0384', 'team-nir-120', 'Binitha E', '+91 90000 00000', 'binithaee32@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0385', 'team-nir-120', 'Achyutha M', '+91 90000 00000', 'achyutham43@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0386', 'team-nir-121', 'PRADEEPA BAI', '+91 90000 00000', 'pradeepabala30@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0387', 'team-nir-121', 'Joshna Giribabu', '+91 90000 00000', 'joshnagiribabu@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0388', 'team-nir-121', 'Dhakshina Muthanandam', '+91 90000 00000', 'dhhaksshiii@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0389', 'team-nir-121', 'Dharshini karikalan', '+91 90000 00000', 'dharshu1120@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0390', 'team-nir-122', 'Ayushman Patro', '+91 90000 00000', 'work.ayush2k6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0391', 'team-nir-122', 'Preksha.A. Pujar', '+91 90000 00000', 'vanishree.pujar902@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0392', 'team-nir-122', 'K Sai Srigandha', '+91 90000 00000', 'saisrigandha1work@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0393', 'team-nir-122', 'Shriram Upadhya', '+91 90000 00000', '1dt25ec131@dsatm.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0394', 'team-nir-123', 'Selva Kailash', '+91 90000 00000', 'selvakailash95@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0395', 'team-nir-123', 'madhunila', '+91 90000 00000', 'madhunila2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0396', 'team-nir-123', 'Sasinathan T', '+91 90000 00000', 'sasinathantp@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0397', 'team-nir-123', 'Sribalaji G', '+91 90000 00000', 'sribalajigunasekaran@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0398', 'team-nir-124', 'MOHAMMED DANYAL', '+91 90000 00000', '1nt24is131.mohammed@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0399', 'team-nir-124', 'Mohamed Mohideen A', '+91 90000 00000', 'mohamed.a.mohideen@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0400', 'team-nir-124', 'Bhargav', '+91 90000 00000', 'bhargav.nirmith@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0401', 'team-nir-125', 'partha sarathi A', '+91 90000 00000', 'parthasarathia23@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0402', 'team-nir-126', 'Sudhindra M Acharya', '+91 90000 00000', 'sudhindramacharya@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0403', 'team-nir-126', 'Vamshi Krishna K M', '+91 90000 00000', 'vamshikrishms@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0404', 'team-nir-126', 'Charan N', '+91 90000 00000', 'charan.nswamy07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0405', 'team-nir-126', 'Sai Kumar', '+91 90000 00000', 'ksai44590@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0406', 'team-nir-127', 'Vaishnavi S', '+91 90000 00000', 'vaishnavi.s5317@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0407', 'team-nir-127', 'Nithin Gowda H J', '+91 90000 00000', 'nithingowdahj213@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0408', 'team-nir-127', 'Soujanya', '+91 90000 00000', 'soujanyasou500@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0409', 'team-nir-127', 'Member 4', '+91 90000 00000', 'wolfeyes106@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0410', 'team-nir-128', 'Asahari Hr', '+91 90000 00000', 'hrasahari@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0411', 'team-nir-129', 'dushyant vasupaalli', '+91 90000 00000', 'dushyantvasupalli@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0412', 'team-nir-129', 'Rachana', '+91 90000 00000', 'rachanap0108@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0413', 'team-nir-129', 'V S KIRAN', '+91 90000 00000', 'vskiran53@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0414', 'team-nir-130', 'KARTHIK M S', '+91 90000 00000', 'karthiknaik777111@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0415', 'team-nir-130', 'Harshavardhan E', '+91 90000 00000', 'vardhaneharsha77@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0416', 'team-nir-130', 'Rohith Rawal', '+91 90000 00000', 'rohi657797@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0417', 'team-nir-130', 'Prateek Shetty', '+91 90000 00000', 'shettyprateek045@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0418', 'team-nir-131', 'Dishant Mohapatra', '+91 90000 00000', 'dkmison21@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0419', 'team-nir-131', 'Member 2', '+91 90000 00000', 'anishrajpradhan007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0420', 'team-nir-131', 'Subhraza Supratick', '+91 90000 00000', 'subhrazasupratick@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0421', 'team-nir-131', 'Dilshad Ali', '+91 90000 00000', 'dilshadalikhanji123@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0422', 'team-nir-132', 'Megh Bari', '+91 90000 00000', 'barimegh1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0423', 'team-nir-132', 'samarth bhirud', '+91 90000 00000', 'samarthbhirud480@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0424', 'team-nir-132', 'Dhruv Save', '+91 90000 00000', 'dhruvsave2311@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0425', 'team-nir-133', 'Bushra Fathima', '+91 90000 00000', 'f.bushra1006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0426', 'team-nir-133', 'Chinmayi K', '+91 90000 00000', 'chinmayi.kiran2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0427', 'team-nir-133', 'janani manivel', '+91 90000 00000', 'ijustkilledyourmom3000@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0428', 'team-nir-133', 'Aishwarya P.S', '+91 90000 00000', 'aishwaryakalluraya@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0429', 'team-nir-134', 'SAGAR N', '+91 90000 00000', '1nt24cs238.sagar@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0430', 'team-nir-134', 'Sharan Sanadi', '+91 90000 00000', '1nt24cs258.sharan@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0431', 'team-nir-134', 'Member 3', '+91 90000 00000', '1nt24cs189.omkar@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0432', 'team-nir-134', 'Spoorthi M G', '+91 90000 00000', '1nt24cs291.spoorthi@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0433', 'team-nir-135', 'NANDINI MAHESH PATIL ECE-1-2025-29', '+91 90000 00000', '25ug1byec009@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0434', 'team-nir-135', 'Thanvi shetty', '+91 90000 00000', 'thanvishettymandarthi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0435', 'team-nir-135', 'Prathvi Gouda', '+91 90000 00000', 'goudaprathvi28@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0436', 'team-nir-136', 'Vijay K S', '+91 90000 00000', 'vijayks.official27@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0437', 'team-nir-136', 'Harini Prakash', '+91 90000 00000', 'hariniprakash018@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0438', 'team-nir-136', 'Deeksha Rathod', '+91 90000 00000', 'deeksharathod81@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0439', 'team-nir-136', 'Rahul N', '+91 90000 00000', 'rahulanekal06052007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0440', 'team-nir-137', 'Chetan Ik', '+91 90000 00000', 'chetanik838@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0441', 'team-nir-137', 'Poorvik TD', '+91 90000 00000', 'poorviktd13@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0442', 'team-nir-137', 'Aditya', '+91 90000 00000', 'adityahiremath50@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0443', 'team-nir-138', 'Subharup Nandi', '+91 90000 00000', 'subharupn@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0444', 'team-nir-138', 'Sandeep', '+91 90000 00000', 'sand.eepn1910@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0445', 'team-nir-139', 'Nikhil B Rao', '+91 90000 00000', 'nikhilbrao04@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0446', 'team-nir-140', 'Faheemah M', '+91 90000 00000', 'faheemahm2020@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0447', 'team-nir-140', 'Ananya V Shahapur', '+91 90000 00000', 'ananyashahapur@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0448', 'team-nir-140', 'Harshitha N', '+91 90000 00000', 'ncharshitha2005@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0449', 'team-nir-141', 'YASHWANTH M', '+91 90000 00000', 'yashwanthm.it2024@citchennai.net', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0450', 'team-nir-142', 'Rachana Shende', '+91 90000 00000', '24ug1bycs123@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0451', 'team-nir-142', 'Luzain Sara', '+91 90000 00000', 'saraluzain7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0452', 'team-nir-142', 'Vaishnavi H CSE-10', '+91 90000 00000', '24ug1bycs112@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0453', 'team-nir-143', 'Piyush Priyadarshi', '+91 90000 00000', 'piyushhh100@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0454', 'team-nir-143', 'Aryan Kumar', '+91 90000 00000', 'imaryankr21@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0455', 'team-nir-144', 'Harish Kumar V', '+91 90000 00000', 'vharishkumar2866@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0456', 'team-nir-144', 'K Y K Govardhana', '+91 90000 00000', 'govardhanakyk@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0457', 'team-nir-144', 'Manushree', '+91 90000 00000', 'manushreedevang@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0458', 'team-nir-144', 'Dayana', '+91 90000 00000', 'dayanaaaaab11@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0459', 'team-nir-145', 'Udit Kumar', '+91 90000 00000', 'iamudt19@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0460', 'team-nir-145', 'Piyush Raj CSBS', '+91 90000 00000', '24ug1bybs025@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0461', 'team-nir-145', 'Pratyush Visu', '+91 90000 00000', 'pratyushvisu@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0462', 'team-nir-145', 'Ruchi Sao', '+91 90000 00000', '0103ruchi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0463', 'team-nir-146', 'Kush Tayal', '+91 90000 00000', 'kushtayal2020@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0464', 'team-nir-146', 'Ashrit Anshuman Pradhan', '+91 90000 00000', 'ashrit39@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0465', 'team-nir-146', 'Tulsi Patil', '+91 90000 00000', 'tulsipatil62@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0466', 'team-nir-146', 'Krishna Yadav', '+91 90000 00000', 'krishnayadav18037@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0467', 'team-nir-147', 'Sandhya Omkar', '+91 90000 00000', 'sandhyaomkar6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0468', 'team-nir-147', 'Sahana M N', '+91 90000 00000', 'sahanamnsahanamn15@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0469', 'team-nir-147', 'Shreya C', '+91 90000 00000', 'shreyachandrashekar04@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0470', 'team-nir-147', 'Shilpa Shilpa', '+91 90000 00000', 'shilpashilpa32140@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0471', 'team-nir-148', 'Sai Harshith', '+91 90000 00000', '1609harshith@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0472', 'team-nir-148', 'Sumukha R', '+91 90000 00000', '1nt24ec160.sumukha@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0473', 'team-nir-148', 'R Varshini', '+91 90000 00000', 'rvarshini1975@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0474', 'team-nir-148', 'Mithun Chakravarthy', '+91 90000 00000', 'chakrasmithun0015@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0475', 'team-nir-149', 'Jagruthi Reddy B', '+91 90000 00000', 'jagruthireddyb83@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0476', 'team-nir-149', 'Avanya KV', '+91 90000 00000', 'avanyaramesh2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0477', 'team-nir-149', 'P.N.Sanjay Sriraj', '+91 90000 00000', 'sanjaysriraj.282006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0478', 'team-nir-149', 'PV Tanusha', '+91 90000 00000', '24ug1bycs222@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0479', 'team-nir-150', 'Vidhya Shree AK', '+91 90000 00000', 'vidhyavidhu1309@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0480', 'team-nir-150', 'Tejaswini C', '+91 90000 00000', '310624205285@eec.srmrmp.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0481', 'team-nir-150', 'VIJAY KRISHNA V', '+91 90000 00000', 'vijaykrishna.v18@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0482', 'team-nir-151', 'Birendra Kumar', '+91 90000 00000', 'virendrax01@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0483', 'team-nir-151', 'Ritika Raj', '+91 90000 00000', 'ritikaasinghh1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0484', 'team-nir-151', 'Prithvi Kumar', '+91 90000 00000', 'prithvikumar828116@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0485', 'team-nir-152', 'Tanush kr gupta', '+91 90000 00000', 'krtanushgupta@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0486', 'team-nir-153', 'Koushik rawal', '+91 90000 00000', 'praveenkoushikrawal@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0487', 'team-nir-153', 'NAVEEN BATHINI', '+91 90000 00000', 'naveen984964@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0488', 'team-nir-153', 'Sigi Reddy Mani Bhushan', '+91 90000 00000', 'duogamer2803@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0489', 'team-nir-154', 'Prajakta Patil', '+91 90000 00000', 'prajaktaptl12344@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0490', 'team-nir-154', 'Srushti Pandit', '+91 90000 00000', 'srushtiipandit796@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0491', 'team-nir-154', 'yash vd', '+91 90000 00000', 'yashvd6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0492', 'team-nir-154', 'ATHREY DESHPANDE', '+91 90000 00000', 'deshpandeathrey8@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0493', 'team-nir-155', 'Dheeraj M R', '+91 90000 00000', 'dheerajmr0305@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0494', 'team-nir-156', 'Shashank Singh', '+91 90000 00000', 'singhshashank1027@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0495', 'team-nir-156', 'Harshitha', '+91 90000 00000', 'harshithashreeraj@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0496', 'team-nir-156', 'Badri Nath', '+91 90000 00000', 'badrinath8ajps@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0497', 'team-nir-156', 'Aakib Ali', '+91 90000 00000', 'aaquibali1401@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0498', 'team-nir-157', 'Harisha S', '+91 90000 00000', '310625106081@eec.srmrmp.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0499', 'team-nir-157', '310625106127 LENYA GLADSTONE/ECE/B-Sec/2025-2029', '+91 90000 00000', '310625106127@eec.srmrmp.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0500', 'team-nir-157', 'Harshini v', '+91 90000 00000', 'harshini.v0407@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0501', 'team-nir-158', 'Bhumika U', '+91 90000 00000', 'bhumikaumesh237@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0502', 'team-nir-158', 'Likhitha C', '+91 90000 00000', 'likhithanaik02@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0503', 'team-nir-158', 'Jeevitha HN', '+91 90000 00000', 'jeevithahn15@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0504', 'team-nir-159', 'Saicharan', '+91 90000 00000', 'dsaicharan072@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0505', 'team-nir-159', 'Lokesh Kumar Sahu', '+91 90000 00000', 'lokeshsahu2804@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0506', 'team-nir-159', 'Vinay Kumar', '+91 90000 00000', 'vk3089790@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0507', 'team-nir-160', 'vishwas CM', '+91 90000 00000', 'vishwascmv1478@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0508', 'team-nir-160', 'Shreeniketh V', '+91 90000 00000', 'shreenikethv@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0509', 'team-nir-160', 'Samarth', '+91 90000 00000', 'santoshsalunke1136@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0510', 'team-nir-160', 'Member 4', '+91 90000 00000', '1ms24ee023@msrit.edu', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0511', 'team-nir-161', 'Rohit Kumar Yadav', '+91 90000 00000', '24ug1bybs030@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0512', 'team-nir-162', 'Yash Vardhan Singh', '+91 90000 00000', 'yashvardhansingh0507@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0513', 'team-nir-162', 'ABHINAV JOLY A ECE-3-2025-29', '+91 90000 00000', '25ug1byec020@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0514', 'team-nir-162', 'Shaun Thomas', '+91 90000 00000', 'shaunthomas1116@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0515', 'team-nir-162', 'Aadya Chirayu Naik', '+91 90000 00000', 'aadyanaik30@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0516', 'team-nir-163', 'Tarun', '+91 90000 00000', 'ktarunkumar1832@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0517', 'team-nir-163', 'Tejas B M', '+91 90000 00000', 'tejasbm037@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0518', 'team-nir-163', 'Pavithra H', '+91 90000 00000', 'pavithrahemakeshwarappa05@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0519', 'team-nir-163', 'Vaishnavi K A', '+91 90000 00000', 'vaishnavika28@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0520', 'team-nir-164', 'Purvika D', '+91 90000 00000', 'contact.purvika@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0521', 'team-nir-164', 'Ritvik N Shettigar', '+91 90000 00000', 'ritviknshettigar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0522', 'team-nir-164', 'Sanath sanath', '+91 90000 00000', 'ssanath529@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0523', 'team-nir-165', 'Prakash Patel', '+91 90000 00000', 'prakashpatel5009@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0524', 'team-nir-165', 'PREM H R', '+91 90000 00000', 'hrprem04@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0525', 'team-nir-165', 'Prajval', '+91 90000 00000', 'prajval26112005@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0526', 'team-nir-166', 'Kunal S C', '+91 90000 00000', 'kunalsc06@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0527', 'team-nir-166', 'Ullas S', '+91 90000 00000', 'ullas.vyasa07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0528', 'team-nir-166', 'Vishwas M H', '+91 90000 00000', 'vishwasmh14@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0529', 'team-nir-166', 'Nischal V Bhat', '+91 90000 00000', 'nischal.v.bhat@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0530', 'team-nir-167', 'Sharath Kumar.L', '+91 90000 00000', '30sharathkumar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0531', 'team-nir-167', 'Vara prasad.N', '+91 90000 00000', 'varaprasad.n2004@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0532', 'team-nir-167', 'Prajna Naik', '+91 90000 00000', 'prajnanaik9761@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0533', 'team-nir-167', 'Member 4', '+91 90000 00000', 'mayurmsuryavansi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0534', 'team-nir-168', 'UDIT SINGHI', '+91 90000 00000', 'uditsinghi930@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0535', 'team-nir-168', 'Aanya Vishwakarma', '+91 90000 00000', 'aanyavishwakarma780@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0536', 'team-nir-168', 'Alisha Anthony', '+91 90000 00000', 'alishaanthony447@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0537', 'team-nir-169', 'Avinash .k', '+91 90000 00000', 'avinashssnsantosh@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0538', 'team-nir-169', 'Sanskriti Chauhan CSE-10', '+91 90000 00000', '24ug1bycs070@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0539', 'team-nir-169', 'Mounika AIML-3', '+91 90000 00000', '24ug1byai270@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0540', 'team-nir-169', 'Manasa Chandarkar AIML-3', '+91 90000 00000', '24ug1byai105@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0541', 'team-nir-170', 'Sathviksa', '+91 90000 00000', 'sathviksa837@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0542', 'team-nir-170', 'Amai Shetty', '+91 90000 00000', 'amaishettyb@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0543', 'team-nir-170', 'Shyama Subrahmanya Sharma K', '+91 90000 00000', 'www.shyamak2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0544', 'team-nir-170', 'LAVISH XP', '+91 90000 00000', 'lavishshetty6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0545', 'team-nir-171', 'K Vaishnavi', '+91 90000 00000', 'vaishnavivaish0908@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0546', 'team-nir-171', 'Inchara e', '+91 90000 00000', 'incharae532@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0547', 'team-nir-171', 'Subrahmanya Antredi', '+91 90000 00000', '24ug1byee009@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0548', 'team-nir-171', 'Bhargavi MN', '+91 90000 00000', '25ug1bycs0198@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0549', 'team-nir-172', 'Tharun Ramesh', '+91 90000 00000', 'rameshtharun067@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0550', 'team-nir-173', 'V NANDA KISHORE NAIK', '+91 90000 00000', 'nandakishorevankadoth@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0551', 'team-nir-173', 'P DEEPTHI JAIN', '+91 90000 00000', 'deeprash.1208@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0552', 'team-nir-173', 'PAILA DIVYESH REDDY', '+91 90000 00000', 'divyeshreddy1024@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0553', 'team-nir-174', 'Kishore P.T.', '+91 90000 00000', 'kishore.8176@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0554', 'team-nir-174', 'Sathya Selvan S', '+91 90000 00000', 's.s.sathyaselvans@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0555', 'team-nir-174', 'Karthick jeeva', '+91 90000 00000', '310625102007@eec.srmrmp.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0556', 'team-nir-174', 'Vc Vikkas', '+91 90000 00000', 'vcvikkas25@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0557', 'team-nir-175', 'Vishruth N', '+91 90000 00000', 'vishruthn515@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0558', 'team-nir-175', 'Maansi Dubey', '+91 90000 00000', 'maansidubey27@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0559', 'team-nir-175', 'Pranathi Girimaji', '+91 90000 00000', '24ug1byec017@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0560', 'team-nir-176', 'PREETHI A', '+91 90000 00000', '5008775preethi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0561', 'team-nir-176', 'Suhas Gowda', '+91 90000 00000', 'suhasgowda10205@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0562', 'team-nir-176', 'Nihar Srinath', '+91 90000 00000', '5166744.nihar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0563', 'team-nir-176', 'Harsha Hariharan', '+91 90000 00000', 'sriharshan151@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0564', 'team-nir-177', 'samanvitha g nayak', '+91 90000 00000', 'samanvithagnayak@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0565', 'team-nir-177', 'Alisha Fernandes', '+91 90000 00000', 'alishaferna11@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0566', 'team-nir-177', 'nekyo', '+91 90000 00000', 'rudraatodariya@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0567', 'team-nir-178', 'Khush Chadha', '+91 90000 00000', 'khushhc2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0568', 'team-nir-178', 'Suraj Rajesh', '+91 90000 00000', 'surajrajesh067@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0569', 'team-nir-178', 'Rajat AN', '+91 90000 00000', 'anrajat2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0570', 'team-nir-179', 'Kartikey Varshney', '+91 90000 00000', 'varshneykartikey600@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0571', 'team-nir-179', 'adithya kumar', '+91 90000 00000', 'adithyakumar6845@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0572', 'team-nir-179', 'Damarasinghu Harshavardhan', '+91 90000 00000', 'harsha98908@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0573', 'team-nir-179', 'Kamakhya Anupam Sharma', '+91 90000 00000', 'sasukeisreal612@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0574', 'team-nir-180', 'Aswin', '+91 90000 00000', 'harunaswin77@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0575', 'team-nir-180', 'ARUNVISAL M ECE', '+91 90000 00000', 'arunvisal.2402022@srec.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0576', 'team-nir-180', 'DHARUN PRASATH S ECE', '+91 90000 00000', 'dharunprasath.2402035@srec.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0577', 'team-nir-181', 'Abhishek Samal', '+91 90000 00000', 'abhisheksamal192800@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0578', 'team-nir-181', 'S Dilleswari', '+91 90000 00000', 'sdilleswari20@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0579', 'team-nir-181', 'N Jayant Rao', '+91 90000 00000', 'njayantrao@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0580', 'team-nir-182', 'Thota Laasya Reddy', '+91 90000 00000', 'sanmatigk@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0581', 'team-nir-182', 'Thota Laasya Reddy', '+91 90000 00000', 'laasyathota21@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0582', 'team-nir-182', 'Dhee', '+91 90000 00000', '24ug1byai016@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0583', 'team-nir-183', 'Mohmmad Mafaz A', '+91 90000 00000', 'mdmafazameenbeg@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0584', 'team-nir-183', 'Member 2', '+91 90000 00000', 'gurammanavarl@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0585', 'team-nir-183', 'Yusuf Doddamani', '+91 90000 00000', 'yusufdoddamani30@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0586', 'team-nir-184', 'Parth', '+91 90000 00000', '1nt23is152.parth@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0587', 'team-nir-184', 'sahil saurav', '+91 90000 00000', 'sahilsaurav10@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0588', 'team-nir-184', 'Nilesh Mani', '+91 90000 00000', 'maninilesh718@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0589', 'team-nir-184', 'Kshitij Singh', '+91 90000 00000', 'kshitijsingh496@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0590', 'team-nir-185', 'manoj HG', '+91 90000 00000', 'manojhg321@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0591', 'team-nir-185', 'Dileep M K', '+91 90000 00000', 'dileep.m.k126@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0592', 'team-nir-185', 'CHINMAY J C', '+91 90000 00000', 'chinmaychoudhari510@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0593', 'team-nir-185', 'Sneha', '+91 90000 00000', 'acharyasneha2005@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0594', 'team-nir-186', 'Shiva ganeshSR', '+91 90000 00000', 'srshivaganesh@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0595', 'team-nir-186', 'Kaushal K', '+91 90000 00000', 'kaushalkumar.23ci057@amceducation.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0596', 'team-nir-186', 'Anurag Mishra', '+91 90000 00000', 'anuragmishra.10a@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0597', 'team-nir-186', 'Shufwath Raqeeb S', '+91 90000 00000', 'shufwathraqeeb8753@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0598', 'team-nir-187', 'Trisha N Kadur', '+91 90000 00000', 'trisha.kadur@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0599', 'team-nir-187', 'Pranav S', '+91 90000 00000', 'pranav6367@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0600', 'team-nir-187', 'Shubham Jyoti Nayak', '+91 90000 00000', 'shubhamjyotinayak123@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0601', 'team-nir-187', 'Nathen JV', '+91 90000 00000', 'silentcoyote23@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0602', 'team-nir-188', 'Anish', '+91 90000 00000', 'anish.madhyastha@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0603', 'team-nir-188', 'Talish Jain', '+91 90000 00000', 'talishjain@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0604', 'team-nir-188', 'Sparsha Swaminathan', '+91 90000 00000', 'sparshaswaminathan27@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0605', 'team-nir-189', 'Kannan Arumugam s', '+91 90000 00000', 'ks123858@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0606', 'team-nir-189', 'Abishek Raj', '+91 90000 00000', 'abishekraj.0707@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0607', 'team-nir-189', 'Divyasri Srinivasan', '+91 90000 00000', 'divyasri63.md@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0608', 'team-nir-190', 'Afzan khan', '+91 90000 00000', 'khanafzankhan79@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0609', 'team-nir-191', 'Omkar', '+91 90000 00000', 'odkshirasagar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0610', 'team-nir-191', 'Tarun Agdi', '+91 90000 00000', 'agditarun2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0611', 'team-nir-192', 'Utsav B raikar', '+91 90000 00000', 'ubraikar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0612', 'team-nir-192', 'Indu R Pawar', '+91 90000 00000', 'indupawar6334@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0613', 'team-nir-192', 'Bindu R Pawar', '+91 90000 00000', 'bindurpawar44@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0614', 'team-nir-192', 'Sujan R V', '+91 90000 00000', 'sujanrv1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0615', 'team-nir-193', 'Vaishnavi Hegde', '+91 90000 00000', 'vaishnavihegde6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0616', 'team-nir-193', 'SIDDHANT M S CSE-11-2025-29', '+91 90000 00000', '25ug1bycs0321@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0617', 'team-nir-193', 'Manudh Vedat', '+91 90000 00000', 'manudh.vedat@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0618', 'team-nir-193', 'Chetana subhash rao', '+91 90000 00000', 'chethanasubhashrao@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0619', 'team-nir-194', 'Shreelekha', '+91 90000 00000', 'shreelekha877@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0620', 'team-nir-194', 'Member 2', '+91 90000 00000', 'priyapriyah350@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0621', 'team-nir-195', 'RISHIKA RANJAN', '+91 90000 00000', 'rishikaranjanhps@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0622', 'team-nir-195', 'Prajwal', '+91 90000 00000', 'prajwalgokhale29@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0623', 'team-nir-195', 'Niharika Nawani', '+91 90000 00000', 'niharikanawani717@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0624', 'team-nir-195', 'Subhranshu', '+91 90000 00000', 'sadmango2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0625', 'team-nir-196', 'Shraddha Binish', '+91 90000 00000', 'knightf502@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0626', 'team-nir-196', 'Subhash Raj P', '+91 90000 00000', '8ac18subhashrajp@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0627', 'team-nir-196', 'Mehal Ramesh', '+91 90000 00000', 'mehalramesh24@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0628', 'team-nir-196', 'Meghana S', '+91 90000 00000', 'meghashanu17@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0629', 'team-nir-197', 'Mitish Manoj P', '+91 90000 00000', 'horaciapagani01@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0630', 'team-nir-198', 'Devesh Kumar Singh', '+91 90000 00000', '24ug1bycs394@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0631', 'team-nir-198', 'Jeetanshu', '+91 90000 00000', 'jeetanshu409@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0632', 'team-nir-198', 'Vivek Sharma', '+91 90000 00000', 'us896592@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0633', 'team-nir-199', 'Harini S', '+91 90000 00000', '310625102005@eec.srmrmp.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0634', 'team-nir-199', 'Member 2', '+91 90000 00000', '310625102022@eec.srmrmp.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0635', 'team-nir-199', 'KARTHICK JEEVA B', '+91 90000 00000', 'karthijeeva0737@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0636', 'team-nir-200', 'Sanskar Tyagi', '+91 90000 00000', 'sanskartyagi593@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0637', 'team-nir-200', 'Deepak Dhanna', '+91 90000 00000', 'deepakdhanna71@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0638', 'team-nir-200', 'Sanyam Singhai', '+91 90000 00000', 'singhaisanyam64@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0639', 'team-nir-200', 'Member 4', '+91 90000 00000', 'sreyasala558@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0640', 'team-nir-201', 'Susnata Maity', '+91 90000 00000', '12e010031@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0641', 'team-nir-201', 'Saikat Khanra', '+91 90000 00000', 'khanrasaikat21@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0642', 'team-nir-201', 'Raj Shaw', '+91 90000 00000', 'rajextreme756@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0643', 'team-nir-201', 'G.S. Vibeesh Velavan', '+91 90000 00000', 'vs1813@srmist.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0644', 'team-nir-202', 'Aakarsh Roshan Sharma', '+91 90000 00000', 'aakarsh0662@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0645', 'team-nir-202', 'Rohit M Hudge', '+91 90000 00000', 'hudge.rohit01@outlook.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0646', 'team-nir-202', 'Devansh Jindal', '+91 90000 00000', 'jindaldevansh86@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0647', 'team-nir-203', 'Dinesh D', '+91 90000 00000', 'dinesh200719@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0648', 'team-nir-203', 'GIRIDHARAN M', '+91 90000 00000', 'ggiridharan097@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0649', 'team-nir-203', 'Jasmine Shelma T', '+91 90000 00000', 'jasmineshelma19@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0650', 'team-nir-203', 'Aishwarya', '+91 90000 00000', 'aishwaryasivakumar20@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0651', 'team-nir-204', 'Mukesh Kumar R', '+91 90000 00000', 'mukeshkumar16rmk@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0652', 'team-nir-205', 'Vansh Baranwal', '+91 90000 00000', 'vanshbaranwal21@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0653', 'team-nir-205', 'D venkata abhishek', '+91 90000 00000', 'd.abhishek9035@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0654', 'team-nir-205', 'Nimish Sharma', '+91 90000 00000', 'nimishsharma0211@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0655', 'team-nir-205', 'SIDDHI VINAYAK', '+91 90000 00000', 'siddhiv171@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0656', 'team-nir-206', 'B S ASHVIND', '+91 90000 00000', 'bsashvind2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0657', 'team-nir-206', 'Rohan mudgal', '+91 90000 00000', 'mudgalrohanmys@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0658', 'team-nir-206', 'SaiHarshith Dalavai', '+91 90000 00000', 'dalavaisaiharshith123@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0659', 'team-nir-207', 'Tanushree K', '+91 90000 00000', 'tanushreekavalpure@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0660', 'team-nir-207', 'Member 2', '+91 90000 00000', 'jonathanjohndavid418@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0661', 'team-nir-207', 'Amra Qureshi', '+91 90000 00000', 'amraqureshi67@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0662', 'team-nir-207', 'Gautam N Chipkar', '+91 90000 00000', 'gautamchipkar46@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0663', 'team-nir-208', 'Pratham Patil', '+91 90000 00000', 'pratham8070@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0664', 'team-nir-209', 'Ayush Kumar Yadav', '+91 90000 00000', 'ayushyadav170707@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0665', 'team-nir-209', 'Archit Kumar', '+91 90000 00000', 'architk760@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0666', 'team-nir-209', 'Parasmani Kushwaha', '+91 90000 00000', 'parasmanikushwaha4@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0667', 'team-nir-209', 'Dhruv Bansal', '+91 90000 00000', 'dhruvbansal0728@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0668', 'team-nir-210', 'Chinnushree C Gowda', '+91 90000 00000', 'csg3610@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0669', 'team-nir-210', 'Supraj U Shivajji', '+91 90000 00000', 'suprajushivajji@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0670', 'team-nir-210', 'Shrinidhi Dambal', '+91 90000 00000', 'shrinidhi1113@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0671', 'team-nir-211', 'ShadowQuant', '+91 90000 00000', 'theshadowquant@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0672', 'team-nir-211', 'Pratham R Raikar', '+91 90000 00000', 'prathamrraikar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0673', 'team-nir-211', 'savya v vernekar', '+91 90000 00000', 'savyavvernekar6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0674', 'team-nir-212', 'Mahi Suhalka', '+91 90000 00000', 'mahi.suhalka03@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0675', 'team-nir-213', 'Koushik M', '+91 90000 00000', 'koushikmahadev3@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0676', 'team-nir-214', 'Adarsha Angadi', '+91 90000 00000', 'katakanahalliadarsh@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0677', 'team-nir-214', 'Suraj Jutti', '+91 90000 00000', 'avsurajrj.8a@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0678', 'team-nir-214', 'Yatin Arora', '+91 90000 00000', 'meenaarora080@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0679', 'team-nir-214', 'U KARAN DEV', '+91 90000 00000', '09karandev@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0680', 'team-nir-215', 'Rashi Singh', '+91 90000 00000', 'rashi1912singh@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0681', 'team-nir-215', 'Rakshitha M', '+91 90000 00000', 'rakshitha28042006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0682', 'team-nir-215', 'Rajdeep Singh', '+91 90000 00000', 'rajdeep2006ss@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0683', 'team-nir-215', 'Isha Surana', '+91 90000 00000', 'ishasurana0106@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0684', 'team-nir-216', 'VNL NIKHITA', '+91 90000 00000', 'vnln3108@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0685', 'team-nir-216', 'NEELI KUNDANA VENI', '+91 90000 00000', 'neelikundanaveni@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0686', 'team-nir-216', 'Abhinav Nerusu', '+91 90000 00000', 'abhinavnerusu2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0687', 'team-nir-216', 'KILARI AARSHANGINI NAGAVALLI', '+91 90000 00000', 'anagavallikilari@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0688', 'team-nir-217', 'Krisha Mistry', '+91 90000 00000', 'krishamistry29@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0689', 'team-nir-217', 'vraj patadia', '+91 90000 00000', 'vrajpatadia7878@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0690', 'team-nir-218', 'SATHYAM SHARMA L', '+91 90000 00000', 'dudesharma3115@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0691', 'team-nir-218', 'Someswarnadh', '+91 90000 00000', 'someshwarndhsomesh@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0692', 'team-nir-219', 'Adithya S P', '+91 90000 00000', 'adithyasp1668@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0693', 'team-nir-219', 'Rithesh S ECE-3-2024-28', '+91 90000 00000', '24ug1byec192@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0694', 'team-nir-219', 'Harshit N M', '+91 90000 00000', '24ug1byec160@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0695', 'team-nir-219', 'PREETHAM GOWDA', '+91 90000 00000', 'gowdapreetham9377@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0696', 'team-nir-220', 'Sreedhana R', '+91 90000 00000', 'rsreedhana05@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0697', 'team-nir-220', 'Rohan Maigur', '+91 90000 00000', 'rohanmaigur710@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0698', 'team-nir-220', 'Rachana Panibhate', '+91 90000 00000', 'rachanapanibhate21@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0699', 'team-nir-221', 'karthik Kotakonda', '+91 90000 00000', 'karthikkotakonda123@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0700', 'team-nir-221', 'Dhruti Avutu', '+91 90000 00000', 'dhrutiavutu@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0701', 'team-nir-221', 'Lasya Perumalla', '+91 90000 00000', 'lasyaperumalla08@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0702', 'team-nir-222', 'JAMI DINESH', '+91 90000 00000', 'dineshjami3344@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0703', 'team-nir-223', 'Yadava HC', '+91 90000 00000', 'yadavahc333@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0704', 'team-nir-224', 'HETHYSHI.M.S', '+91 90000 00000', '25ug1byec113@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0705', 'team-nir-224', 'Member 2', '+91 90000 00000', 'ratnamjoshitha@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0706', 'team-nir-224', 'Member 3', '+91 90000 00000', '25ug1bycs0582@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0707', 'team-nir-224', 'Member 4', '+91 90000 00000', '25ug1bycs1012@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0708', 'team-nir-225', 'Janhvi Dwivedi', '+91 90000 00000', 'janhvid2024@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0709', 'team-nir-225', 'Ankita Kushwaha', '+91 90000 00000', 'ankitakushwaha3641@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0710', 'team-nir-225', 'TANISHKA Sayyad', '+91 90000 00000', 'tanishkasayyad852@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0711', 'team-nir-226', 'FAIZAN AHMED', '+91 90000 00000', 'btechcse2026@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0712', 'team-nir-226', 'Saikat Shil', '+91 90000 00000', 'saikatshil294@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0713', 'team-nir-226', 'HARISH K', '+91 90000 00000', 'littlehearthari2024@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0714', 'team-nir-227', 'Gnanapriya kr', '+91 90000 00000', '24ug1bycs145@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0715', 'team-nir-227', 'Vaishnavi K', '+91 90000 00000', 'vaishnaviparvathi4@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0716', 'team-nir-227', 'Bindu Y G', '+91 90000 00000', '24ug1bycs846@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0717', 'team-nir-227', 'anjali ag', '+91 90000 00000', 'anjali.ag2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0718', 'team-nir-228', 'Pikki Gouthami', '+91 90000 00000', 'pikkigouthami3@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0719', 'team-nir-228', 'Manoj', '+91 90000 00000', 'm419460610@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0720', 'team-nir-228', 'Maha Maha.S', '+91 90000 00000', 'mahasmaha97@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0721', 'team-nir-229', 'JAI HARINI P', '+91 90000 00000', 'jaiharini2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0722', 'team-nir-229', 'Dharan J S', '+91 90000 00000', 'dharanjs07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0723', 'team-nir-229', 'DHARUN THANDESH', '+91 90000 00000', 'dharunthandesh4@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0724', 'team-nir-229', 'Jagadish', '+91 90000 00000', 'jagadishsoundar07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0725', 'team-nir-230', 'Kolipaka Abhichandra', '+91 90000 00000', 'kolipakaabhichandra991@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0726', 'team-nir-230', 'Santhosh Kumar Yadav', '+91 90000 00000', 'santoshyadav408799@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0727', 'team-nir-230', 'Aditya', '+91 90000 00000', 'adityapadhiary2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0728', 'team-nir-230', 'Praveen Mydukuri', '+91 90000 00000', 'praveenmydukuri1308@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0729', 'team-nir-231', 'Vishwanath Hooli', '+91 90000 00000', 'vishwanathhooli4@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0730', 'team-nir-231', 'Sharada Shiledar', '+91 90000 00000', 'sharadashiledar003@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0731', 'team-nir-232', 'Aziz M Nadaf', '+91 90000 00000', 'azizmnadaf26@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0732', 'team-nir-232', 'Sania M Nadaf', '+91 90000 00000', 'sania.m.nadaf03@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0733', 'team-nir-232', 'Asif M Nadaf', '+91 90000 00000', 'asifmn860@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0734', 'team-nir-233', 'Komala A.G', '+91 90000 00000', 'agkomala98@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0735', 'team-nir-233', 'Preetham Piku', '+91 90000 00000', 'preethampiku@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0736', 'team-nir-233', 'Bhagath patil L.V', '+91 90000 00000', 'bhagathpatil21@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0737', 'team-nir-233', 'Meghana Sr', '+91 90000 00000', 'srmegha2009@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0738', 'team-nir-234', 'Meer Ahmed', '+91 90000 00000', 'ahmedmeer1975@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0739', 'team-nir-234', 'MOHAMMED NADIR', '+91 90000 00000', 'mdnadir117@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0740', 'team-nir-235', 'ARYAN S PAWAR', '+91 90000 00000', 'pawararyanasp@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0741', 'team-nir-235', 'Shreyas Basapur', '+91 90000 00000', 'shreyasbasapur06@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0742', 'team-nir-235', 'Sharath S', '+91 90000 00000', 'sharathswamy06@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0743', 'team-nir-236', 'TEJASHWINI S', '+91 90000 00000', 'thejaswinishetty324@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0744', 'team-nir-237', 'Jishnu K', '+91 90000 00000', '24ug1byec156@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0745', 'team-nir-237', 'Sayed Simnan', '+91 90000 00000', '24ug1byec173@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0746', 'team-nir-237', 'Naman Basavaraj Sindhur', '+91 90000 00000', '24ug1byec183@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0747', 'team-nir-238', 'Krishanu Gharami', '+91 90000 00000', 'krishanugharami24@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0748', 'team-nir-238', 'Saumya Chandrakar', '+91 90000 00000', 'saumyachandrakar115@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0749', 'team-nir-238', 'Anant jain', '+91 90000 00000', 'anantjainabcd@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0750', 'team-nir-239', 'ritik sahu', '+91 90000 00000', 'ritiksahu122405@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0751', 'team-nir-239', 'Sumit Raj Singh', '+91 90000 00000', 'sumitrajsingh2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0752', 'team-nir-239', 'Aman Singh Parihar', '+91 90000 00000', 'amansinghparihar708@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0753', 'team-nir-240', 'Vashisht patel', '+91 90000 00000', 'vashishtpatel2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0754', 'team-nir-240', 'Darshan Shetty', '+91 90000 00000', 'darshanshetty28196@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0755', 'team-nir-240', 'Rakesh MG', '+91 90000 00000', 'rakeshmg13@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0756', 'team-nir-241', 'Kamal Kodali', '+91 90000 00000', 'kodalikamal1908@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0757', 'team-nir-242', 'Vishal GF', '+91 90000 00000', 'gfvishal391@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0758', 'team-nir-242', 'Rahul U', '+91 90000 00000', 'rahuluu39@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0759', 'team-nir-242', 'Akash Kumar', '+91 90000 00000', 'akashmk335@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0760', 'team-nir-242', 'Shreya Hangal', '+91 90000 00000', 'shreyahangal9@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0761', 'team-nir-243', 'Kishan  N R', '+91 90000 00000', 'kishannr93@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0762', 'team-nir-243', 'Pranav S Londhe', '+91 90000 00000', 'pranavslondhe0@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0763', 'team-nir-243', 'Monisha G V', '+91 90000 00000', 'monishagv7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0764', 'team-nir-243', 'Lavanya NK', '+91 90000 00000', 'lavanyanklavanya9@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0765', 'team-nir-244', 'Deeksha B', '+91 90000 00000', 'bdeeksha675@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0766', 'team-nir-244', 'Sneha Raghavendra Nazare', '+91 90000 00000', 'snehanazare777@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0767', 'team-nir-244', 'Varsha M', '+91 90000 00000', 'varshamurugesh2207@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0768', 'team-nir-244', 'Manogna R sharma', '+91 90000 00000', 'rmanogna00@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0769', 'team-nir-245', 'Ismaiel', '+91 90000 00000', 'sydismaiel10@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0770', 'team-nir-245', 'Sai Manikanta', '+91 90000 00000', 'smani12022006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0771', 'team-nir-246', 'Bhagya N K', '+91 90000 00000', 'bhagyank.25cse@cambridge.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0772', 'team-nir-246', 'rajalasravani 25cse', '+91 90000 00000', 'rajalasravani.25cse@cambridge.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0773', 'team-nir-246', 'Amulya M', '+91 90000 00000', 'amulyam.25cse@cambridge.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0774', 'team-nir-247', 'Nithyashree K.K', '+91 90000 00000', 'kknithyashree2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0775', 'team-nir-247', 'Rakkshithaa V', '+91 90000 00000', 'rakkshithaa1306@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0776', 'team-nir-247', 'R.Praveena', '+91 90000 00000', 'praveenabakiya@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0777', 'team-nir-248', 'Sricharan S Sharma', '+91 90000 00000', 'sricharan15ssharma@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0778', 'team-nir-248', 'Hasini M', '+91 90000 00000', 'hasini.m006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0779', 'team-nir-248', 'Abhay Bhat', '+91 90000 00000', 'abhayhattiangadi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0780', 'team-nir-248', 'Chandas N', '+91 90000 00000', 'chnydv1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0781', 'team-nir-249', 'Ankitha Narayan', '+91 90000 00000', '25ug1bycs0343@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0782', 'team-nir-249', 'DHANYASHREE K P', '+91 90000 00000', '25ug1bycs0145@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0783', 'team-nir-249', 'Chatura Meka', '+91 90000 00000', '25ug1bycs0011@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0784', 'team-nir-250', 'Sparsha', '+91 90000 00000', 'sparshasgyt@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0785', 'team-nir-250', 'Sourish Das', '+91 90000 00000', 'iamsourish8@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0786', 'team-nir-250', 'Samanway Sarkar', '+91 90000 00000', 'sarkarsamanway1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0787', 'team-nir-250', 'Ritendu Sarkar', '+91 90000 00000', 'ritendu.sarkar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0788', 'team-nir-251', 'Shubham Pawaskar', '+91 90000 00000', 'shubhampawaskar53@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0789', 'team-nir-251', 'Rishitha Galagali', '+91 90000 00000', 'rishugalagali@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0790', 'team-nir-252', 'SHREEJU BHAMARE', '+91 90000 00000', 'shreejubhamare@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0791', 'team-nir-252', 'Dewang Sonawane', '+91 90000 00000', 'dewangsonawane6002@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0792', 'team-nir-252', 'Devendra Pardeshi', '+91 90000 00000', 'devendrapardeshi85@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0793', 'team-nir-252', 'Devashri Deore', '+91 90000 00000', 'devashrideore@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0794', 'team-nir-253', 'Lakshmi J Shastry', '+91 90000 00000', 'lakshmijshastry@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0795', 'team-nir-253', 'Member 2', '+91 90000 00000', '24ug1bybs028@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0796', 'team-nir-253', 'Member 3', '+91 90000 00000', 'prajwalveereshsmg@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0797', 'team-nir-253', 'kshitiz khandelwal', '+91 90000 00000', 'kshitiz.k.1403@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0798', 'team-nir-254', 'Afreen E Yahya', '+91 90000 00000', 'afreeneyahya@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0799', 'team-nir-254', 'Saanvi Singh', '+91 90000 00000', 'saanvisingh158@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0800', 'team-nir-254', 'Riddhima Pandey', '+91 90000 00000', 'riddhima0507@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0801', 'team-nir-254', 'Vaishnavi S Devarmani', '+91 90000 00000', 'vaishdevarmani2020@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0802', 'team-nir-255', '', '+91 90000 00000', '24ug1byai118@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0803', 'team-nir-256', 'P S Charitha', '+91 90000 00000', 'charitha.padamati@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0804', 'team-nir-256', 'Ranjini N M', '+91 90000 00000', 'ranjininm18@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0805', 'team-nir-256', 'Varsha Vernekar', '+91 90000 00000', 'varshapv122007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0806', 'team-nir-257', 'Kalanthika S', '+91 90000 00000', 'kalanthikasrini@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0807', 'team-nir-257', 'Hasini KV', '+91 90000 00000', 'hasinikanchi16@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0808', 'team-nir-257', 'Neha K', '+91 90000 00000', 'neha.k13017@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0809', 'team-nir-257', 'Pavithra', '+91 90000 00000', 'pavi.472006.reddy@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0810', 'team-nir-258', 'Yuvasri S', '+91 90000 00000', 'yuva83614@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0811', 'team-nir-258', 'Thivya B', '+91 90000 00000', 'bthivya1101@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0812', 'team-nir-258', 'K.Swetha', '+91 90000 00000', 'sweachandru@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0813', 'team-nir-258', 'Winston Sanjay S', '+91 90000 00000', 'winstonsanjay6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0814', 'team-nir-259', 'Ananya S K', '+91 90000 00000', 'ananyagowda824@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0815', 'team-nir-259', 'Avani Kollur', '+91 90000 00000', '1nt24ec026.avani@nmit.ac.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0816', 'team-nir-259', 'Manya.M Poojari', '+91 90000 00000', 'manyampoojari@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0817', 'team-nir-260', 'Vasavi B', '+91 90000 00000', '24ug1byec079@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0818', 'team-nir-260', 'Navneet Arun', '+91 90000 00000', '24ug1byec024@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0819', 'team-nir-260', 'Achinth Hebbar', '+91 90000 00000', 'achinthhebbar@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0820', 'team-nir-261', 'Spandana', '+91 90000 00000', 'spandanag0327@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0821', 'team-nir-261', 'DHANYATHA K', '+91 90000 00000', 'eng25cs0090@dsu.edu.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0822', 'team-nir-261', 'Neha V Gupta', '+91 90000 00000', 'minna.nvg@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0823', 'team-nir-262', 'Pothur Abhinav', '+91 90000 00000', 'abhinav007it@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0824', 'team-nir-262', 'Sujay H', '+91 90000 00000', 'sujayh9591@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0825', 'team-nir-262', 'Sukesh R Gowda', '+91 90000 00000', 'sukeshmandya2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0826', 'team-nir-262', 'Tejus Mohan', '+91 90000 00000', 'tejusmohan@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0827', 'team-nir-263', 'Tanishq Trivedi', '+91 90000 00000', 'tanishqtrivedi20@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0828', 'team-nir-263', 'Haresh Karthik K', '+91 90000 00000', 'hareshkarthik2010@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0829', 'team-nir-263', 'Ruchir Nadikatla', '+91 90000 00000', 'ruchirnsb@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0830', 'team-nir-264', 'SRIVATSAN A', '+91 90000 00000', 'srivatsan687@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0831', 'team-nir-264', 'Keerthi', '+91 90000 00000', 'ks7676118@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0832', 'team-nir-264', 'Giritharan R', '+91 90000 00000', 'giridharanramesh3@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0833', 'team-nir-265', 'SUJAN H ACHARYA', '+91 90000 00000', 'sujanhacharya2002@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0834', 'team-nir-265', 'Yogeshwar Yogesh', '+91 90000 00000', 'yogeshwaryogesh143@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0835', 'team-nir-265', 'Chethan M', '+91 90000 00000', 'chethanmanjula2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0836', 'team-nir-265', 'Vikram Hn', '+91 90000 00000', 'hnvikram97@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0837', 'team-nir-266', 'Balaji .G.S', '+91 90000 00000', 'balajigs888@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0838', 'team-nir-266', 'Abhishek Kokkari', '+91 90000 00000', 'abhishekkokkari@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0839', 'team-nir-266', 'Suprith YS', '+91 90000 00000', 'suprithyedikeri@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0840', 'team-nir-266', 'Akash Gaonkar', '+91 90000 00000', 'akashgaonkar94489@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0841', 'team-nir-267', 'Bharath Varma', '+91 90000 00000', 'hiphopmusicradio25@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0842', 'team-nir-268', 'Bootharajan', '+91 90000 00000', 'bootharajaneee@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0843', 'team-nir-269', 'Drakshayani', '+91 90000 00000', 'drakshayani1509@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0844', 'team-nir-269', 'H G Dileep', '+91 90000 00000', 'hgdileepganji@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0845', 'team-nir-269', 'C Shashi Vardhan Reddy', '+91 90000 00000', 'shashivardhanreddy833@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0846', 'team-nir-270', 'Kushadhi J Yadav', '+91 90000 00000', 'kushadhijy.24@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0847', 'team-nir-270', 'Member 2', '+91 90000 00000', 'kedar25gamer@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0848', 'team-nir-270', 'Member 3', '+91 90000 00000', 'aadyabajpai156@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0849', 'team-nir-270', 'Member 4', '+91 90000 00000', 'kaushinidpsvi@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0850', 'team-nir-271', 'Kothakota Leela Vinayak', '+91 90000 00000', 'leelavinayakkothakota155@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0851', 'team-nir-271', 'Arkad Uday Varma', '+91 90000 00000', 'arkadudayvarma@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0852', 'team-nir-271', 'K venkata Tharun', '+91 90000 00000', 'kvenkatatharun555@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0853', 'team-nir-272', 'Vishal Raj', '+91 90000 00000', 'er.vishalraj01@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0854', 'team-nir-272', 'mohaneesh purbia', '+91 90000 00000', 'mohaneeshpurbia7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0855', 'team-nir-272', 'Yukta Manral', '+91 90000 00000', 'yukta.manral13@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0856', 'team-nir-272', 'Annapoorna S', '+91 90000 00000', 'andyspace27@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0857', 'team-nir-273', 'AKASH', '+91 90000 00000', 'akashs14102005@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0858', 'team-nir-273', 'Nirmala Meka', '+91 90000 00000', 'urmilameka6@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0859', 'team-nir-273', 'Nirmala M', '+91 90000 00000', 'nirmalameka03@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0860', 'team-nir-274', 'sheema sulthana shaik', '+91 90000 00000', 'sheemasulthana84@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0861', 'team-nir-274', 'Surya tejaswini Pallaganti', '+91 90000 00000', 'suryatejaswinipallaganti@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0862', 'team-nir-274', 'Pushpa Hasini Somisetty venkata', '+91 90000 00000', 'somisettypushpahasini07@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0863', 'team-nir-274', 'Member 4', '+91 90000 00000', 'narramokshitha850@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0864', 'team-nir-275', 'Naren Shahi', '+91 90000 00000', 'narenshahi110206@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0865', 'team-nir-275', 'Mohd Rihan', '+91 90000 00000', 'mohdrihan1457@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0866', 'team-nir-275', 'Hitesh Singh', '+91 90000 00000', 'thakurhitesh5789@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0867', 'team-nir-275', 'Dixha Raj', '+91 90000 00000', 'dixha0830@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0868', 'team-nir-276', 'Harshan A', '+91 90000 00000', 'aharshan011@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0869', 'team-nir-276', 'Hari Baalaji', '+91 90000 00000', 'haribaalaji147@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0870', 'team-nir-276', 'Jahir Deen A', '+91 90000 00000', 'jahirdeen2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0871', 'team-nir-276', 'Dos Bence', '+91 90000 00000', 'dosbence01@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0872', 'team-nir-277', 'R Pritika Gandhi', '+91 90000 00000', 'pritikagandhi8675@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0873', 'team-nir-277', 'Greeshma  Nair', '+91 90000 00000', '25ug1byec110@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0874', 'team-nir-277', 'Ashritha Karthikeyan', '+91 90000 00000', '25ug1byec104@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0875', 'team-nir-278', 'Akshat Ambast', '+91 90000 00000', 'akshatambast2007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0876', 'team-nir-279', 'Sharan K U', '+91 90000 00000', 'sharankugowda@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0877', 'team-nir-279', 'Member 2', '+91 90000 00000', 'sitaansh007@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0878', 'team-nir-279', 'Shubham Vishal Injatkar', '+91 90000 00000', '24ug1byec031@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0879', 'team-nir-279', 'Kriday Rastogi', '+91 90000 00000', 'kridayrastogi1@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0880', 'team-nir-280', 'Premithiews Barman', '+91 90000 00000', 'premithiewsb@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0881', 'team-nir-280', 'Abhilash Das', '+91 90000 00000', 'sunlightedsky7239@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0882', 'team-nir-280', 'Arman Khan', '+91 90000 00000', 'armankhan492003@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0883', 'team-nir-281', 'AKSHIKA SINGH', '+91 90000 00000', 'akshikasingh0627@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0884', 'team-nir-281', 'Akrithi Prashanth', '+91 90000 00000', 'akrithi21115@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0885', 'team-nir-281', 'Kaushik Sarma', '+91 90000 00000', 'kaushik007sarma@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0886', 'team-nir-281', 'Udbhav Slathia', '+91 90000 00000', 'udbhavslathia9d@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0887', 'team-nir-282', 'Ayush Roy', '+91 90000 00000', 'ayushhroy.7@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0888', 'team-nir-282', 'Sandipan Mandal', '+91 90000 00000', 'msandipan0208@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0889', 'team-nir-282', 'Saurabh Tripathi', '+91 90000 00000', 'tripathisaurabh9211@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0890', 'team-nir-283', 'Umesh Adabala', '+91 90000 00000', '5252515.umeshadabala@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0891', 'team-nir-283', 'Abhinav .A', '+91 90000 00000', 'ab182008june18@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0892', 'team-nir-283', 'Akshay.M', '+91 90000 00000', 'akshay.m2308@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0893', 'team-nir-284', 'GANESH T N BHUSHAN', '+91 90000 00000', 'ganeshtnbhushan@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0894', 'team-nir-285', 'RAJ SHEKHAR SINGH', '+91 90000 00000', 'rajshekhar9341@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0895', 'team-nir-285', 'Ayush Bhardwaj', '+91 90000 00000', 'ayushb16507@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0896', 'team-nir-285', 'Member 3', '+91 90000 00000', 'biradarmanjunath96@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0897', 'team-nir-286', 'Bhavna S', '+91 90000 00000', 'craftshower08@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0898', 'team-nir-286', 'Jumaynah Herial', '+91 90000 00000', 'jumaynahherial@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0899', 'team-nir-286', 'yuktha venkatesan', '+91 90000 00000', 'yukthavenkatesan1507@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0900', 'team-nir-287', 'Aishwarya Manoj', '+91 90000 00000', 'manojaishwarya27@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0901', 'team-nir-287', 'Likithashri', '+91 90000 00000', 'liki200tha@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0902', 'team-nir-287', 'SHUBHASHREE S', '+91 90000 00000', '25ug1byai158@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0903', 'team-nir-288', 'Vidhyasri K S', '+91 90000 00000', 'vidhyasriks2006@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0904', 'team-nir-288', 'sanjay s', '+91 90000 00000', 'sanjay.2007s17@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0905', 'team-nir-288', 'Sanjay S', '+91 90000 00000', 'sanjaysivasubramaniam255@gmail.com', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0906', 'team-nir-289', 'Ananya G P', '+91 90000 00000', '24ug1byai278@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0907', 'team-nir-289', 'Gurram Dhakshayani', '+91 90000 00000', '24ug1byai024@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.members (id, team_id, name, phone, email, present) VALUES ('m-nir-0908', 'team-nir-289', 'Member 3', '+91 90000 00000', '24ug1byai387@bmsit.in', false) ON CONFLICT (id) DO NOTHING;
COMMIT;

-- =============================================================================
-- NIRMAAN 2026 — Custom Scan Events Patch
-- Run this in: Supabase Dashboard → SQL Editor
--
-- This script creates the tables and RPC function required for the
-- "+ Event" custom scan feature. Run it once if you see the error:
--   "Could not find the function public.process_custom_scan(...)"
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: Create Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.custom_scan_events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  limit_rule  TEXT NOT NULL DEFAULT 'per_present_member',
  color       TEXT NOT NULL DEFAULT 'bg-nirmaan-amber',
  text_color  TEXT DEFAULT 'text-nirmaan-black',
  icon        TEXT DEFAULT 'Sparkles',
  active      BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_scan_records (
  id                 TEXT PRIMARY KEY,
  event_id           TEXT NOT NULL REFERENCES public.custom_scan_events(id) ON DELETE CASCADE,
  team_id            TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  count              INTEGER NOT NULL DEFAULT 1,
  present_member_ids JSONB,
  scanned_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_scan_events_active      ON public.custom_scan_events(active);
CREATE INDEX IF NOT EXISTS idx_custom_scan_records_event_team ON public.custom_scan_records(event_id, team_id);

-- -----------------------------------------------------------------------------
-- Step 2: Create process_custom_scan RPC (Atomic, Concurrency-Safe)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_custom_scan(
    p_qr_token           TEXT,
    p_event_id           TEXT,
    p_count              INTEGER DEFAULT 1,
    p_present_member_ids TEXT[]  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team            public.teams%ROWTYPE;
    v_event           public.custom_scan_events%ROWTYPE;
    v_present_count   INTEGER;
    v_total_members   INTEGER;
    v_current_count   INTEGER;
    v_new_total       INTEGER;
    v_requested_count INTEGER;
    v_clean_token     TEXT;
    v_new_record_id   TEXT;
BEGIN
    v_clean_token     := regexp_replace(trim(p_qr_token), '^NIRMAAN-PASS:', '', 'i');
    v_requested_count := GREATEST(1, COALESCE(p_count, 1));

    SELECT * INTO v_event
    FROM public.custom_scan_events
    WHERE id = p_event_id AND active = true
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_EVENT', 'message', 'Scan event not found or inactive.');
    END IF;

    SELECT * INTO v_team
    FROM public.teams
    WHERE qr_token = v_clean_token OR qr_token = trim(p_qr_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_QR', 'message', 'Invalid QR — Team not registered in system.');
    END IF;

    IF v_team.review_status = 'rejected' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'TOKEN_REVOKED', 'message', 'Team registration was rejected by organizers.');
    END IF;

    IF v_team.review_status = 'merged' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'TEAM_MERGED', 'message', 'Team registration was merged into another primary team.');
    END IF;

    SELECT COUNT(*) INTO v_total_members FROM public.members WHERE team_id = v_team.id;
    SELECT COUNT(*) INTO v_present_count FROM public.members WHERE team_id = v_team.id AND present = true;

    -- Rule: once_per_team
    IF v_event.limit_rule = 'once_per_team' THEN
        SELECT COALESCE(SUM(count), 0) INTO v_current_count
        FROM public.custom_scan_records WHERE event_id = v_event.id AND team_id = v_team.id;

        IF v_current_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_COMPLETED',
                'message', format('Team "%s" has already checked in for %s.', v_team.team_name, v_event.title),
                'team_id', v_team.id, 'team_name', v_team.team_name, 'college', v_team.college,
                'event_id', v_event.id, 'event_title', v_event.title, 'current_count', v_current_count);
        END IF;

        v_new_record_id := 'rec-' || gen_random_uuid()::text;
        INSERT INTO public.custom_scan_records (id, event_id, team_id, count, present_member_ids, scanned_at)
        VALUES (v_new_record_id, v_event.id, v_team.id, 1,
                CASE WHEN p_present_member_ids IS NOT NULL THEN to_jsonb(p_present_member_ids) ELSE NULL END, now());

        RETURN jsonb_build_object('success', true,
            'message', format('Check-in recorded for "%s" for %s!', v_team.team_name, v_event.title),
            'team_id', v_team.id, 'team_name', v_team.team_name, 'college', v_team.college,
            'checked_in', v_team.checked_in, 'event_id', v_event.id, 'event_title', v_event.title,
            'current_count', 1, 'new_count', 1, 'remaining_count', 0,
            'present_count', v_present_count, 'total_members', v_total_members);
    END IF;

    -- Rule: per_present_member
    IF v_event.limit_rule = 'per_present_member' THEN
        IF NOT v_team.checked_in THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'NOT_CHECKED_IN',
                'message', 'Team must complete on-desk registration check-in first.',
                'team_id', v_team.id, 'team_name', v_team.team_name, 'checked_in', false);
        END IF;

        IF v_present_count = 0 THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'NO_PRESENT_MEMBERS',
                'message', 'No members are marked present for this team.',
                'team_id', v_team.id, 'team_name', v_team.team_name, 'present_count', 0);
        END IF;

        SELECT COALESCE(SUM(count), 0) INTO v_current_count
        FROM public.custom_scan_records WHERE event_id = v_event.id AND team_id = v_team.id;

        IF v_current_count >= v_present_count THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'LIMIT_REACHED',
                'message', format('Maximum limit reached for %s (%s/%s).', v_event.title, v_current_count, v_present_count),
                'team_id', v_team.id, 'team_name', v_team.team_name,
                'event_id', v_event.id, 'event_title', v_event.title,
                'current_count', v_current_count, 'present_count', v_present_count, 'remaining_count', 0);
        END IF;

        v_requested_count := LEAST(v_requested_count, (v_present_count - v_current_count));

        v_new_record_id := 'rec-' || gen_random_uuid()::text;
        INSERT INTO public.custom_scan_records (id, event_id, team_id, count, present_member_ids, scanned_at)
        VALUES (v_new_record_id, v_event.id, v_team.id, v_requested_count,
                CASE WHEN p_present_member_ids IS NOT NULL THEN to_jsonb(p_present_member_ids) ELSE NULL END, now());

        v_new_total := v_current_count + v_requested_count;

        RETURN jsonb_build_object('success', true,
            'message', format('Recorded %s for %s (%s/%s total)', v_requested_count, v_event.title, v_new_total, v_present_count),
            'team_id', v_team.id, 'team_name', v_team.team_name, 'college', v_team.college,
            'checked_in', v_team.checked_in, 'event_id', v_event.id, 'event_title', v_event.title,
            'current_count', v_new_total, 'new_count', v_new_total,
            'remaining_count', (v_present_count - v_new_total),
            'present_count', v_present_count, 'total_members', v_total_members);
    END IF;

    -- Rule: unlimited
    SELECT COALESCE(SUM(count), 0) INTO v_current_count
    FROM public.custom_scan_records WHERE event_id = v_event.id AND team_id = v_team.id;

    v_new_record_id := 'rec-' || gen_random_uuid()::text;
    INSERT INTO public.custom_scan_records (id, event_id, team_id, count, present_member_ids, scanned_at)
    VALUES (v_new_record_id, v_event.id, v_team.id, v_requested_count,
            CASE WHEN p_present_member_ids IS NOT NULL THEN to_jsonb(p_present_member_ids) ELSE NULL END, now());

    v_new_total := v_current_count + v_requested_count;

    RETURN jsonb_build_object('success', true,
        'message', format('Recorded %s for %s (Total: %s)', v_requested_count, v_event.title, v_new_total),
        'team_id', v_team.id, 'team_name', v_team.team_name, 'college', v_team.college,
        'checked_in', v_team.checked_in, 'event_id', v_event.id, 'event_title', v_event.title,
        'current_count', v_new_total, 'new_count', v_new_total,
        'present_count', v_present_count, 'total_members', v_total_members);
END;
$$;

-- -----------------------------------------------------------------------------
-- Step 3: Grant permissions
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.process_custom_scan(TEXT, TEXT, INTEGER, TEXT[]) TO anon, authenticated;
GRANT ALL ON TABLE public.custom_scan_events  TO anon, authenticated;
GRANT ALL ON TABLE public.custom_scan_records TO anon, authenticated;

-- Verify
SELECT 'custom_scan_events'  AS table_name, COUNT(*) AS rows FROM public.custom_scan_events
UNION ALL
SELECT 'custom_scan_records', COUNT(*) FROM public.custom_scan_records;

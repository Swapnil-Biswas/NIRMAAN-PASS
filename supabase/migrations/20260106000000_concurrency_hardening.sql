-- =============================================================================
-- Migration: Concurrency Hardening & Atomic Stored Procedures
-- NIRMAAN-PASS 2026 Production Hardening
-- =============================================================================

-- Ensure necessary indexes exist
CREATE INDEX IF NOT EXISTS idx_teams_qr_token ON public.teams(qr_token);
CREATE INDEX IF NOT EXISTS idx_teams_review_status ON public.teams(review_status);
CREATE INDEX IF NOT EXISTS idx_members_team_id ON public.members(team_id);
CREATE INDEX IF NOT EXISTS idx_members_normalized_email ON public.members(normalized_email);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_custom_scan_records_event_team ON public.custom_scan_records(event_id, team_id);

-- -----------------------------------------------------------------------------
-- 1. Atomic Meal Scan RPC (Concurrency Safe with FOR UPDATE)
-- -----------------------------------------------------------------------------
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
    v_meal_lower TEXT;
BEGIN
    -- Sanitize token (trim prefix if formatted as NIRMAAN-PASS:token)
    v_clean_token := regexp_replace(trim(p_qr_token), '^NIRMAAN-PASS:', '', 'i');
    v_meal_lower := lower(trim(p_meal_type));

    -- Lock team row atomically for update to prevent race conditions
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

    -- Check review status
    IF v_team.review_status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_REVOKED',
            'message', 'This event pass has been rejected or disqualified by organizers.'
        );
    END IF;

    IF v_team.review_status = 'merged' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_MERGED',
            'message', 'This duplicate team pass was merged into another registration and is now inactive.'
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

    -- Determine current meal count and validate quota
    CASE v_meal_lower
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
        'meal_type', v_meal_lower,
        'present_count', v_present_count,
        'new_count', v_new_count,
        'remaining_count', (v_present_count - v_new_count),
        'message', format('Successfully served %s (%s/%s)', v_meal_lower, v_new_count, v_present_count)
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Atomic Coffee Scan RPC
-- -----------------------------------------------------------------------------
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

    IF v_team.review_status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_REVOKED',
            'message', 'This event pass has been rejected or disqualified by organizers.'
        );
    END IF;

    IF v_team.review_status = 'merged' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_MERGED',
            'message', 'This duplicate team pass was merged into another registration and is now inactive.'
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

-- -----------------------------------------------------------------------------
-- 3. Atomic On-Desk Registration RPC
-- -----------------------------------------------------------------------------
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

    IF v_team.review_status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_REVOKED',
            'message', 'This event pass has been rejected or disqualified by organizers.'
        );
    END IF;

    IF v_team.review_status = 'merged' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_MERGED',
            'message', 'This duplicate team pass was merged into another registration and is now inactive.'
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

-- -----------------------------------------------------------------------------
-- 4. Atomic Custom Scan Event RPC (Concurrency Safe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_custom_scan(
    p_qr_token TEXT,
    p_event_id TEXT,
    p_count INTEGER DEFAULT 1,
    p_present_member_ids TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team public.teams%ROWTYPE;
    v_event public.custom_scan_events%ROWTYPE;
    v_present_count INTEGER;
    v_total_members INTEGER;
    v_current_count INTEGER;
    v_new_total INTEGER;
    v_requested_count INTEGER;
    v_clean_token TEXT;
    v_new_record_id TEXT;
BEGIN
    v_clean_token := regexp_replace(trim(p_qr_token), '^NIRMAAN-PASS:', '', 'i');
    v_requested_count := GREATEST(1, COALESCE(p_count, 1));

    -- Lock custom event
    SELECT * INTO v_event
    FROM public.custom_scan_events
    WHERE id = p_event_id AND active = true
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_EVENT',
            'message', 'Scan event not found or inactive.'
        );
    END IF;

    -- Lock team row atomically
    SELECT * INTO v_team
    FROM public.teams
    WHERE qr_token = v_clean_token OR qr_token = trim(p_qr_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_QR',
            'message', 'Invalid QR — Team not registered in system.'
        );
    END IF;

    IF v_team.review_status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TOKEN_REVOKED',
            'message', 'Team registration was rejected by organizers.'
        );
    END IF;

    IF v_team.review_status = 'merged' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_MERGED',
            'message', 'Team registration was merged into another primary team.'
        );
    END IF;

    -- Fetch member counts
    SELECT COUNT(*) INTO v_total_members FROM public.members WHERE team_id = v_team.id;
    SELECT COUNT(*) INTO v_present_count FROM public.members WHERE team_id = v_team.id AND present = true;

    -- 1. Rule: once_per_team
    IF v_event.limit_rule = 'once_per_team' THEN
        SELECT COALESCE(SUM(count), 0) INTO v_current_count
        FROM public.custom_scan_records
        WHERE event_id = v_event.id AND team_id = v_team.id;

        IF v_current_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'ALREADY_COMPLETED',
                'message', format('Team "%s" has already checked in for %s.', v_team.team_name, v_event.title),
                'team_id', v_team.id,
                'team_name', v_team.team_name,
                'college', v_team.college,
                'checked_in', v_team.checked_in,
                'event_id', v_event.id,
                'event_title', v_event.title,
                'current_count', v_current_count
            );
        END IF;

        v_new_record_id := 'rec-' || gen_random_uuid()::text;
        INSERT INTO public.custom_scan_records (id, event_id, team_id, count, present_member_ids, scanned_at)
        VALUES (
            v_new_record_id,
            v_event.id,
            v_team.id,
            1,
            CASE WHEN p_present_member_ids IS NOT NULL THEN to_jsonb(p_present_member_ids) ELSE NULL END,
            now()
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', format('Check-in recorded for "%s" for %s!', v_team.team_name, v_event.title),
            'team_id', v_team.id,
            'team_name', v_team.team_name,
            'college', v_team.college,
            'checked_in', v_team.checked_in,
            'event_id', v_event.id,
            'event_title', v_event.title,
            'current_count', 1,
            'new_count', 1,
            'remaining_count', 0,
            'present_count', v_present_count,
            'total_members', v_total_members
        );
    END IF;

    -- 2. Rule: per_present_member
    IF v_event.limit_rule = 'per_present_member' THEN
        IF NOT v_team.checked_in THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'NOT_CHECKED_IN',
                'message', 'Team must complete on-desk registration check-in first.',
                'team_id', v_team.id,
                'team_name', v_team.team_name,
                'college', v_team.college,
                'checked_in', false
            );
        END IF;

        IF v_present_count = 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'NO_PRESENT_MEMBERS',
                'message', 'No members are marked present for this team.',
                'team_id', v_team.id,
                'team_name', v_team.team_name,
                'checked_in', true,
                'present_count', 0
            );
        END IF;

        SELECT COALESCE(SUM(count), 0) INTO v_current_count
        FROM public.custom_scan_records
        WHERE event_id = v_event.id AND team_id = v_team.id;

        IF v_current_count >= v_present_count THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'LIMIT_REACHED',
                'message', format('Maximum limit reached for %s (%s/%s present members received).', v_event.title, v_current_count, v_present_count),
                'team_id', v_team.id,
                'team_name', v_team.team_name,
                'event_id', v_event.id,
                'event_title', v_event.title,
                'current_count', v_current_count,
                'present_count', v_present_count,
                'remaining_count', 0
            );
        END IF;

        -- Cap requested count so remaining cannot go below 0
        v_requested_count := LEAST(v_requested_count, (v_present_count - v_current_count));

        v_new_record_id := 'rec-' || gen_random_uuid()::text;
        INSERT INTO public.custom_scan_records (id, event_id, team_id, count, present_member_ids, scanned_at)
        VALUES (
            v_new_record_id,
            v_event.id,
            v_team.id,
            v_requested_count,
            CASE WHEN p_present_member_ids IS NOT NULL THEN to_jsonb(p_present_member_ids) ELSE NULL END,
            now()
        );

        v_new_total := v_current_count + v_requested_count;

        RETURN jsonb_build_object(
            'success', true,
            'message', format('Recorded %s for %s (%s/%s total)', v_requested_count, v_event.title, v_new_total, v_present_count),
            'team_id', v_team.id,
            'team_name', v_team.team_name,
            'college', v_team.college,
            'checked_in', v_team.checked_in,
            'event_id', v_event.id,
            'event_title', v_event.title,
            'current_count', v_new_total,
            'new_count', v_new_total,
            'remaining_count', (v_present_count - v_new_total),
            'present_count', v_present_count,
            'total_members', v_total_members
        );
    END IF;

    -- 3. Rule: unlimited
    SELECT COALESCE(SUM(count), 0) INTO v_current_count
    FROM public.custom_scan_records
    WHERE event_id = v_event.id AND team_id = v_team.id;

    v_new_record_id := 'rec-' || gen_random_uuid()::text;
    INSERT INTO public.custom_scan_records (id, event_id, team_id, count, present_member_ids, scanned_at)
    VALUES (
        v_new_record_id,
        v_event.id,
        v_team.id,
        v_requested_count,
        CASE WHEN p_present_member_ids IS NOT NULL THEN to_jsonb(p_present_member_ids) ELSE NULL END,
        now()
    );

    v_new_total := v_current_count + v_requested_count;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Recorded %s for %s (Total: %s)', v_requested_count, v_event.title, v_new_total),
        'team_id', v_team.id,
        'team_name', v_team.team_name,
        'college', v_team.college,
        'checked_in', v_team.checked_in,
        'event_id', v_event.id,
        'event_title', v_event.title,
        'current_count', v_new_total,
        'new_count', v_new_total,
        'present_count', v_present_count,
        'total_members', v_total_members
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Updated Event Statistics RPC (Filter active teams only)
-- -----------------------------------------------------------------------------
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
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE checked_in = true),
           COALESCE(SUM(breakfast_count), 0),
           COALESCE(SUM(lunch_count), 0),
           COALESCE(SUM(dinner_count), 0),
           COALESCE(SUM(coffee_count), 0)
    INTO v_total_teams, v_checked_in_teams,
         v_breakfast_served, v_lunch_served, v_dinner_served, v_total_coffee
    FROM public.teams
    WHERE review_status IS NULL OR (review_status <> 'rejected' AND review_status <> 'merged');

    SELECT COUNT(*), COUNT(*) FILTER (WHERE m.present = true)
    INTO v_total_students, v_present_students
    FROM public.members m
    JOIN public.teams t ON m.team_id = t.id
    WHERE t.review_status IS NULL OR (t.review_status <> 'rejected' AND t.review_status <> 'merged');

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

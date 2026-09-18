-- =============================================================================
-- NIRMAAN 2026 — Fix RPC Permissions
-- Run this in: Supabase Dashboard → SQL Editor
-- 
-- This grants the anon and authenticated roles permission to call the
-- SECURITY DEFINER stored procedures. Without these grants, API calls
-- using the anon/publishable key get "permission denied" errors.
-- =============================================================================

-- Grant EXECUTE on all RPC functions to anon + authenticated roles
GRANT EXECUTE ON FUNCTION public.process_meal_scan(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_coffee_scan(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_registration(TEXT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_statistics() TO anon, authenticated;

-- Verify the grants were applied
SELECT
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('process_meal_scan', 'process_coffee_scan', 'process_registration', 'get_event_statistics')
ORDER BY routine_name, grantee;

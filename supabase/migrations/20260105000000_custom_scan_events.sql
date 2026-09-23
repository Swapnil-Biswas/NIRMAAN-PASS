-- =============================================================================
-- Migration: Dynamic Custom Scan Events & Records Schema
-- Compatible with PostgreSQL & Supabase
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.custom_scan_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  limit_rule TEXT NOT NULL DEFAULT 'per_present_member', -- 'once_per_team' | 'per_present_member' | 'unlimited'
  color TEXT NOT NULL DEFAULT 'bg-nirmaan-amber',
  text_color TEXT DEFAULT 'text-nirmaan-black',
  icon TEXT DEFAULT 'Sparkles',
  active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.custom_scan_records (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES public.custom_scan_events(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 1,
  present_member_ids JSONB,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_scan_events_active ON public.custom_scan_events(active);
CREATE INDEX IF NOT EXISTS idx_custom_scan_records_event_team ON public.custom_scan_records(event_id, team_id);

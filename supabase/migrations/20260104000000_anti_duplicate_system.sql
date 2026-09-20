-- Anti-duplicate and review system schema for NIRMAAN 2026
-- Enforces one registration per team with review status and normalized participant fields

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS canonical_name TEXT,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS duplicate_notes TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_match_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_into_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS normalized_phone TEXT,
  ADD COLUMN IF NOT EXISTS normalized_email TEXT;

-- Index for fast canonical team name + college duplicate lookup
CREATE INDEX IF NOT EXISTS idx_teams_canonical_name_college ON public.teams(canonical_name, college);
CREATE INDEX IF NOT EXISTS idx_teams_review_status ON public.teams(review_status);

-- Indexes on normalized phone and email for collision detection
CREATE INDEX IF NOT EXISTS idx_members_normalized_phone ON public.members(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_members_normalized_email ON public.members(normalized_email);

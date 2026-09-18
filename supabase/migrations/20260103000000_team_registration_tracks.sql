-- Store the problem track selected during public team registration.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS track TEXT;

CREATE INDEX IF NOT EXISTS idx_teams_track ON public.teams(track);

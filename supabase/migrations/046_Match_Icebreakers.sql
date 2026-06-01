-- Migration 046: Match Icebreakers
-- Adds two columns to user_matches so the Gemini-generated icebreaker is
-- stored permanently at match-creation time and never re-generated on
-- subsequent chat opens (zero repeated API costs).

ALTER TABLE public.user_matches
  ADD COLUMN IF NOT EXISTS icebreaker_text         TEXT,
  ADD COLUMN IF NOT EXISTS icebreaker_generated_at TIMESTAMPTZ;

-- Index for the common query: "fetch icebreaker for this match where it is NULL"
-- Used by the background job that retries failed generations.
CREATE INDEX IF NOT EXISTS idx_user_matches_icebreaker_pending
  ON public.user_matches (id)
  WHERE icebreaker_text IS NULL;

COMMENT ON COLUMN public.user_matches.icebreaker_text IS
  'AI-generated conversation starter, written once by Gemini at match time.
   NULL means generation is pending or failed (static fallback will be shown).';

COMMENT ON COLUMN public.user_matches.icebreaker_generated_at IS
  'Timestamp of successful Gemini generation. NULL if still pending.';

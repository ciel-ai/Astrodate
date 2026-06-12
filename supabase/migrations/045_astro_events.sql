-- Migration 045: Astro Events
-- Replaces the hardcoded Mercury Retrograde logic in the feed screen with a
-- database-driven table. Community managers can INSERT new rows in Supabase
-- Studio to push banners without a code deploy.

CREATE TABLE IF NOT EXISTS public.astro_events (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(50)  NOT NULL,   -- e.g. 'mercury_retrograde', 'venus_rx', 'eclipse'
  event_name  VARCHAR(100) NOT NULL,
  start_date  TIMESTAMPTZ  NOT NULL,
  end_date    TIMESTAMPTZ  NOT NULL,
  description TEXT,
  ui_config   JSONB,                   -- { "emoji": "☿", "cta": "Revisit old matches", "gradient": ["#1a1a2e","#e94560"] }
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Allow all authenticated users to read events (needed in the feed screen)
ALTER TABLE public.astro_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read astro events"
  ON public.astro_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins / service role may write
CREATE POLICY "Service role can manage astro events"
  ON public.astro_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for the "is there an active event right now?" query pattern
CREATE INDEX IF NOT EXISTS idx_astro_events_active
  ON public.astro_events (start_date, end_date);


-- ─── Seed: Mercury Retrograde dates 2025-2026 ─────────────────────────────────
INSERT INTO public.astro_events
  (event_type, event_name, start_date, end_date, description, ui_config)
VALUES
  (
    'mercury_retrograde', 'Mercury Retrograde — Aries',
    '2025-03-15 00:00:00+00', '2025-04-07 23:59:59+00',
    'Mercury turns retrograde in Aries. Communication may feel scattered — revisit, reflect, and reconnect.',
    '{
      "emoji": "☿",
      "banner_text": "Mercury is Retrograde 🌀",
      "cta": "Revisit old matches — the cosmos is nudging you.",
      "gradient_start": "#1a1a2e",
      "gradient_end": "#e94560",
      "text_color": "#ffffff"
    }'::JSONB
  ),
  (
    'mercury_retrograde', 'Mercury Retrograde — Leo/Virgo',
    '2025-07-18 00:00:00+00', '2025-08-11 23:59:59+00',
    'Mercury turns retrograde in Leo, moving into Virgo. Perfect time to revisit old conversations with fresh eyes.',
    '{
      "emoji": "☿",
      "banner_text": "Mercury is Retrograde 🌀",
      "cta": "Old sparks can reignite — who have you been meaning to message?",
      "gradient_start": "#2d1b69",
      "gradient_end": "#f5a623",
      "text_color": "#ffffff"
    }'::JSONB
  ),
  (
    'mercury_retrograde', 'Mercury Retrograde — Scorpio/Sagittarius',
    '2025-11-09 00:00:00+00', '2025-11-29 23:59:59+00',
    'Mercury retrograde in Scorpio deepens emotional honesty. Conversations that felt impossible may now flow.',
    '{
      "emoji": "☿",
      "banner_text": "Mercury is Retrograde 🌀",
      "cta": "The universe wants you to reconnect. Check your Likes tab.",
      "gradient_start": "#1a0533",
      "gradient_end": "#c0392b",
      "text_color": "#ffffff"
    }'::JSONB
  ),
  (
    'mercury_retrograde', 'Mercury Retrograde — Aries/Pisces',
    '2026-03-15 00:00:00+00', '2026-04-07 23:59:59+00',
    'Mercury stations retrograde again in Aries. Re-examine who caught your eye but slipped through your fingers.',
    '{
      "emoji": "☿",
      "banner_text": "Mercury is Retrograde 🌀",
      "cta": "Second chances are written in the stars right now.",
      "gradient_start": "#1a1a2e",
      "gradient_end": "#e94560",
      "text_color": "#ffffff"
    }'::JSONB
  );


-- ─── Helper RPC: get currently active events ──────────────────────────────────
-- Returns all events whose window contains the current timestamp.
-- The app calls this on mount; no client-side date math needed.
CREATE OR REPLACE FUNCTION get_active_astro_events()
RETURNS SETOF public.astro_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
    FROM public.astro_events
   WHERE now() BETWEEN start_date AND end_date
   ORDER BY start_date ASC;
$$;
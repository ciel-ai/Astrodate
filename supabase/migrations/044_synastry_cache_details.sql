-- Migration 044: Synastry Cache Details
-- Stores planet-by-planet synastry scores, summaries, and badges per pair.
-- Computed once on first profile-detail open; read from cache thereafter.
-- Primary key enforces (user_a_id < user_b_id) so each pair has exactly one row.

CREATE TABLE IF NOT EXISTS public.synastry_cache_details (
  user_a_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Planet-level scores (0-10, NULL means insufficient chart data)
  sun_score              NUMERIC(4,2),
  moon_score             NUMERIC(4,2),
  venus_score            NUMERIC(4,2),
  mars_score             NUMERIC(4,2),
  mercury_score          NUMERIC(4,2),

  -- Composite flag
  dominant_element_match BOOLEAN,

  -- Human-readable output for the UI
  compatibility_summary  TEXT,          -- e.g. "Your Venus signs suggest strong romantic reassurance"
  badges                 JSONB,         -- e.g. ["Twin Flames", "Fiery Passion"]

  computed_at            TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (user_a_id, user_b_id),
  CONSTRAINT check_user_order CHECK (user_a_id < user_b_id)
);

-- Index is implied by PK, but make it explicit for query planner
CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_lookup
  ON public.synastry_cache_details (user_a_id, user_b_id);

-- RLS: authenticated users may read any row (needed to show profile details)
ALTER TABLE public.synastry_cache_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read synastry cache"
  ON public.synastry_cache_details
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only backend (SECURITY DEFINER functions) may write rows
CREATE POLICY "Service role can write synastry cache"
  ON public.synastry_cache_details
  FOR ALL
  USING (auth.role() = 'service_role');


-- ─── Read-through RPC ──────────────────────────────────────────────────────────
-- Returns cached synastry details, computing and storing them on first call.
-- Caller passes two user UUIDs in any order; the function normalises the pair.
CREATE OR REPLACE FUNCTION get_synastry_detail(user_x UUID, user_y UUID)
RETURNS TABLE (
  sun_score              NUMERIC,
  moon_score             NUMERIC,
  venus_score            NUMERIC,
  mars_score             NUMERIC,
  mercury_score          NUMERIC,
  dominant_element_match BOOLEAN,
  compatibility_summary  TEXT,
  badges                 JSONB,
  computed_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_cached synastry_cache_details%ROWTYPE;
  a_rec    astro_details%ROWTYPE;
  b_rec    astro_details%ROWTYPE;

  v_sun     NUMERIC(4,2) := 5;
  v_moon    NUMERIC(4,2) := 5;
  v_venus   NUMERIC(4,2) := 5;
  v_mars    NUMERIC(4,2) := 5;
  v_mercury NUMERIC(4,2) := 5;
  v_elem    BOOLEAN      := FALSE;
  v_summary TEXT;
  v_badges  JSONB        := '[]'::JSONB;
BEGIN
  -- Normalise pair order
  IF user_x < user_y THEN
    v_a := user_x; v_b := user_y;
  ELSE
    v_a := user_y; v_b := user_x;
  END IF;

  -- Cache hit?
  SELECT * INTO v_cached
    FROM synastry_cache_details
   WHERE user_a_id = v_a AND user_b_id = v_b;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_cached.sun_score, v_cached.moon_score, v_cached.venus_score,
      v_cached.mars_score, v_cached.mercury_score,
      v_cached.dominant_element_match, v_cached.compatibility_summary,
      v_cached.badges, v_cached.computed_at;
    RETURN;
  END IF;

  -- Cache miss — compute scores
  SELECT * INTO a_rec FROM astro_details WHERE user_id = v_a LIMIT 1;
  SELECT * INTO b_rec FROM astro_details WHERE user_id = v_b LIMIT 1;

  IF a_rec IS NOT NULL AND b_rec IS NOT NULL THEN
    -- Delegate to existing matrix function (migration 029/030)
    v_sun     := COALESCE(get_sign_compatibility(a_rec.western_sign, b_rec.western_sign), 5);
    v_moon    := COALESCE(get_sign_compatibility(a_rec.indian_sign,  b_rec.indian_sign),  5);
    v_venus   := COALESCE(get_sign_compatibility(a_rec.venus_sign,   b_rec.venus_sign),   5);
    v_mars    := COALESCE(get_sign_compatibility(a_rec.mars_sign,    b_rec.mars_sign),    5);
    v_mercury := COALESCE(get_sign_compatibility(a_rec.mercury_sign, b_rec.mercury_sign), 5);
    v_elem    := COALESCE(a_rec.dominant_element = b_rec.dominant_element, FALSE);

    -- Build a human summary from the strongest signal
    v_summary := CASE
      WHEN v_venus >= 8 THEN 'Your Venus signs suggest strong romantic reassurance and deep love language alignment.'
      WHEN v_moon  >= 8 THEN 'Your Moon signs indicate exceptional emotional understanding and intuitive connection.'
      WHEN v_sun   >= 8 THEN 'Your Sun signs reflect a powerful core identity match — you naturally inspire each other.'
      WHEN v_mars  >= 8 THEN 'Your Mars signs show high physical chemistry and shared drive.'
      WHEN v_mercury >= 8 THEN 'Your Mercury signs promise effortless communication and lively intellectual exchange.'
      WHEN v_elem       THEN 'Matching dominant elements create a natural rhythm and elemental harmony between you.'
      ELSE 'Your charts reveal a unique blend of contrasts and complementary energies worth exploring.'
    END;

    -- Badges (stackable)
    IF v_sun >= 9 AND v_moon >= 9 THEN
      v_badges := v_badges || '["Twin Flames"]'::JSONB;
    END IF;
    IF v_venus >= 8 AND v_mars >= 8 THEN
      v_badges := v_badges || '["Fiery Passion"]'::JSONB;
    END IF;
    IF v_mercury >= 8 THEN
      v_badges := v_badges || '["Cosmic Conversationalists"]'::JSONB;
    END IF;
    IF v_elem THEN
      v_badges := v_badges || '["Elemental Match"]'::JSONB;
    END IF;
  ELSE
    v_summary := 'Complete your birth chart to unlock full compatibility insights.';
  END IF;

  -- Persist to cache
  INSERT INTO synastry_cache_details (
    user_a_id, user_b_id,
    sun_score, moon_score, venus_score, mars_score, mercury_score,
    dominant_element_match, compatibility_summary, badges
  ) VALUES (
    v_a, v_b,
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges
  )
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
    sun_score              = EXCLUDED.sun_score,
    moon_score             = EXCLUDED.moon_score,
    venus_score            = EXCLUDED.venus_score,
    mars_score             = EXCLUDED.mars_score,
    mercury_score          = EXCLUDED.mercury_score,
    dominant_element_match = EXCLUDED.dominant_element_match,
    compatibility_summary  = EXCLUDED.compatibility_summary,
    badges                 = EXCLUDED.badges,
    computed_at            = now();

  RETURN QUERY SELECT
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges, now()::TIMESTAMPTZ;
END;
$$;
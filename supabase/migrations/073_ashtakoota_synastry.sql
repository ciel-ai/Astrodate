-- Migration 073: Ashtakoota (Vedic) synastry scoring
-- Adds birth_timezone to astro_details (needed for server-side API calls).
-- Adds ashtakoota_score + ashtakoota_detail to synastry_cache_details.
-- Updates get_synastry_detail RPC to return the new columns.

-- ─── astro_details: store timezone ───────────────────────────────────────────
ALTER TABLE public.astro_details
  ADD COLUMN IF NOT EXISTS birth_timezone TEXT;

-- ─── synastry_cache_details: Ashtakoota columns ──────────────────────────────
ALTER TABLE public.synastry_cache_details
  ADD COLUMN IF NOT EXISTS ashtakoota_score   NUMERIC(5,2),   -- 0–36 gunas
  ADD COLUMN IF NOT EXISTS ashtakoota_detail  JSONB;          -- full koota breakdown

-- ─── get_synastry_detail: expose new columns ─────────────────────────────────
-- Must DROP first because the RETURNS TABLE signature is changing (new columns).
DROP FUNCTION IF EXISTS public.get_synastry_detail(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_synastry_detail(user_x UUID, user_y UUID)
RETURNS TABLE (
  sun_score              NUMERIC,
  moon_score             NUMERIC,
  venus_score            NUMERIC,
  mars_score             NUMERIC,
  mercury_score          NUMERIC,
  dominant_element_match BOOLEAN,
  compatibility_summary  TEXT,
  badges                 JSONB,
  computed_at            TIMESTAMPTZ,
  ashtakoota_score       NUMERIC,
  ashtakoota_detail      JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_cached public.synastry_cache_details%ROWTYPE;
  a_rec public.astro_details%ROWTYPE;
  b_rec public.astro_details%ROWTYPE;
  v_sun     NUMERIC(4,2) := 5;
  v_moon    NUMERIC(4,2) := 5;
  v_venus   NUMERIC(4,2) := 5;
  v_mars    NUMERIC(4,2) := 5;
  v_mercury NUMERIC(4,2) := 5;
  v_elem    BOOLEAN      := false;
  v_summary TEXT;
  v_badges  JSONB        := '[]'::JSONB;
BEGIN
  IF user_x < user_y THEN
    v_a := user_x; v_b := user_y;
  ELSE
    v_a := user_y; v_b := user_x;
  END IF;

  -- Cache hit (planet scores already computed, Ashtakoota may or may not be present)
  SELECT * INTO v_cached
  FROM public.synastry_cache_details
  WHERE user_a_id = v_a
    AND user_b_id = v_b
    AND is_stale = false;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_cached.sun_score, v_cached.moon_score, v_cached.venus_score,
      v_cached.mars_score, v_cached.mercury_score,
      v_cached.dominant_element_match, v_cached.compatibility_summary,
      v_cached.badges, v_cached.computed_at,
      v_cached.ashtakoota_score, v_cached.ashtakoota_detail;
    RETURN;
  END IF;

  -- Cache miss — compute Western planet scores
  SELECT * INTO a_rec FROM public.astro_details WHERE user_id = v_a LIMIT 1;
  SELECT * INTO b_rec FROM public.astro_details WHERE user_id = v_b LIMIT 1;

  IF a_rec IS NOT NULL AND b_rec IS NOT NULL THEN
    v_sun     := COALESCE(public.get_sign_compatibility(a_rec.western_sign, b_rec.western_sign), 5);
    v_moon    := COALESCE(public.get_sign_compatibility(a_rec.indian_sign,  b_rec.indian_sign),  5);
    v_venus   := COALESCE(public.get_sign_compatibility(a_rec.venus_sign,   b_rec.venus_sign),   5);
    v_mars    := COALESCE(public.get_sign_compatibility(a_rec.mars_sign,    b_rec.mars_sign),    5);
    v_mercury := COALESCE(public.get_sign_compatibility(a_rec.mercury_sign, b_rec.mercury_sign), 5);
    v_elem    := COALESCE(a_rec.dominant_element = b_rec.dominant_element, false);

    v_summary := CASE
      WHEN v_venus >= 8 THEN 'Your Venus signs suggest strong romantic reassurance and deep love language alignment.'
      WHEN v_moon  >= 8 THEN 'Your Moon signs indicate exceptional emotional understanding and intuitive connection.'
      WHEN v_sun   >= 8 THEN 'Your Sun signs reflect a powerful core identity match — you naturally inspire each other.'
      WHEN v_mars  >= 8 THEN 'Your Mars signs show high physical chemistry and shared drive.'
      WHEN v_mercury >= 8 THEN 'Your Mercury signs promise effortless communication and lively intellectual exchange.'
      WHEN v_elem       THEN 'Matching dominant elements create a natural rhythm and elemental harmony between you.'
      ELSE 'Your charts reveal a unique blend of contrasts and complementary energies worth exploring.'
    END;

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

  -- Store planet scores; ashtakoota columns left NULL (filled by compute-synastry Edge Function)
  INSERT INTO public.synastry_cache_details (
    user_a_id, user_b_id,
    sun_score, moon_score, venus_score, mars_score, mercury_score,
    dominant_element_match, compatibility_summary, badges,
    computed_at, is_stale
  ) VALUES (
    v_a, v_b,
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges,
    now(), false
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
    computed_at            = now(),
    is_stale               = false;

  RETURN QUERY SELECT
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges, now()::TIMESTAMPTZ,
    NULL::NUMERIC, NULL::JSONB;
END;
$$;

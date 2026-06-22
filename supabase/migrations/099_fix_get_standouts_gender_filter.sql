-- Migration 098: Add gender preference filtering to get_standouts (Cosmic tab).
--
-- Bug: get_standouts had no gender preference filtering at all, so a male user
--      interested in women saw male profiles on the Cosmic tab.
--
-- Fix: Apply the same bidirectional gender filter used in get_final_matches
--      (migration 093) — the viewer's gender_preference must match the
--      candidate's gender AND the candidate's gender_preference must match
--      the viewer's own gender.

CREATE OR REPLACE FUNCTION public.get_standouts(input_user_id UUID)
RETURNS TABLE (
  match_user_id   UUID,
  full_name       TEXT,
  gender          TEXT,
  location        TEXT,
  astro_score     NUMERIC,
  western_sign    TEXT,
  dominant_element TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_gender_pref   TEXT;
  v_viewer_gender TEXT;
BEGIN
  -- Fetch viewer's own gender and their gender preference
  SELECT
    uprefs.gender_preference,
    prof.gender
  INTO v_gender_pref, v_viewer_gender
  FROM public.user_profiles prof
  LEFT JOIN public.user_preferences uprefs ON uprefs.user_id = prof.user_id
  WHERE prof.user_id = input_user_id;

  RETURN QUERY
  -- Direction 1: viewer is user_a in the synastry pair
  SELECT
    sc.user_b_id        AS match_user_id,
    up.full_name,
    up.gender,
    up.location,
    sc.astro_score,
    ad.western_sign,
    ad.dominant_element
  FROM public.synastry_cache sc
  JOIN  public.user_profiles   up        ON up.user_id        = sc.user_b_id
  LEFT JOIN public.astro_details     ad        ON ad.user_id        = sc.user_b_id
  LEFT JOIN public.user_preferences  cand_pref ON cand_pref.user_id = sc.user_b_id
  WHERE sc.user_a_id = input_user_id
    AND sc.astro_score >= 0.60
    AND sc.is_stale = false
    AND up.updated_at > now() - INTERVAL '30 days'
    AND sc.user_b_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
    -- Viewer's preference: viewer must want the candidate's gender
    AND (
      v_gender_pref IS NULL
      OR lower(v_gender_pref) IN ('everyone', 'all', '')
      OR lower(up.gender) = lower(v_gender_pref)
    )
    -- Candidate's preference: candidate must also want the viewer's gender
    AND (
      cand_pref.gender_preference IS NULL
      OR lower(cand_pref.gender_preference) IN ('everyone', 'all', '')
      OR lower(cand_pref.gender_preference) = lower(v_viewer_gender)
    )

  UNION ALL

  -- Direction 2: viewer is user_b in the synastry pair
  SELECT
    sc.user_a_id        AS match_user_id,
    up.full_name,
    up.gender,
    up.location,
    sc.astro_score,
    ad.western_sign,
    ad.dominant_element
  FROM public.synastry_cache sc
  JOIN  public.user_profiles   up        ON up.user_id        = sc.user_a_id
  LEFT JOIN public.astro_details     ad        ON ad.user_id        = sc.user_a_id
  LEFT JOIN public.user_preferences  cand_pref ON cand_pref.user_id = sc.user_a_id
  WHERE sc.user_b_id = input_user_id
    AND sc.astro_score >= 0.60
    AND sc.is_stale = false
    AND up.updated_at > now() - INTERVAL '30 days'
    AND sc.user_a_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
    -- Viewer's preference
    AND (
      v_gender_pref IS NULL
      OR lower(v_gender_pref) IN ('everyone', 'all', '')
      OR lower(up.gender) = lower(v_gender_pref)
    )
    -- Candidate's preference
    AND (
      cand_pref.gender_preference IS NULL
      OR lower(cand_pref.gender_preference) IN ('everyone', 'all', '')
      OR lower(cand_pref.gender_preference) = lower(v_viewer_gender)
    )

  ORDER BY astro_score DESC
  LIMIT 20;
END;
$$;

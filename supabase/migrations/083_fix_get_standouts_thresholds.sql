-- Migration 082: Fix get_standouts thresholds so Cosmic tab returns results
--
-- Problems fixed:
--   1. astro_score >= 0.75 threshold eliminates ~85% of compatible pairs.
--      Realistic top-tier scores land at 0.79-0.82; average good matches at 0.57-0.65.
--      Lowering to 0.60 shows meaningful matches without sacrificing quality.
--   2. updated_at > now() - 7 days filter is too aggressive for a growing app;
--      users inactive for 8+ days disappear entirely. Extended to 30 days.

CREATE OR REPLACE FUNCTION public.get_standouts(input_user_id UUID)
RETURNS TABLE (
  match_user_id UUID,
  full_name TEXT,
  gender TEXT,
  location TEXT,
  astro_score NUMERIC,
  western_sign TEXT,
  dominant_element TEXT
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    sc.user_b_id AS match_user_id,
    up.full_name,
    up.gender,
    up.location,
    sc.astro_score,
    ad.western_sign,
    ad.dominant_element
  FROM public.synastry_cache sc
  JOIN public.user_profiles up ON up.user_id = sc.user_b_id
  LEFT JOIN public.astro_details ad ON ad.user_id = sc.user_b_id
  WHERE sc.user_a_id = input_user_id
    AND sc.astro_score >= 0.60
    AND sc.is_stale = false
    AND up.updated_at > now() - INTERVAL '30 days'
    AND sc.user_b_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
  UNION ALL
  SELECT
    sc.user_a_id AS match_user_id,
    up.full_name,
    up.gender,
    up.location,
    sc.astro_score,
    ad.western_sign,
    ad.dominant_element
  FROM public.synastry_cache sc
  JOIN public.user_profiles up ON up.user_id = sc.user_a_id
  LEFT JOIN public.astro_details ad ON ad.user_id = sc.user_a_id
  WHERE sc.user_b_id = input_user_id
    AND sc.astro_score >= 0.60
    AND sc.is_stale = false
    AND up.updated_at > now() - INTERVAL '30 days'
    AND sc.user_a_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
  ORDER BY astro_score DESC
  LIMIT 20;
$$;

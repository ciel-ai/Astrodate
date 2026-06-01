-- RPC called from frontend to get today's daily pick for the current user
CREATE OR REPLACE FUNCTION public.get_my_daily_pick()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result json;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'picked_user_id',   dp.picked_user_id,
    'astro_score',      dp.astro_score,
    'pick_date',        dp.pick_date,
    'full_name',        up.full_name,
    'gender',           up.gender,
    'location',         up.location,
    'western_sign',     ad.western_sign,
    'indian_sign',      ad.indian_sign,
    'dominant_element', ad.dominant_element
  )
  INTO v_result
  FROM public.daily_picks dp
  JOIN public.user_profiles up ON up.user_id = dp.picked_user_id
  LEFT JOIN public.astro_details ad ON ad.user_id = dp.picked_user_id
  WHERE dp.user_id = v_user_id
    AND dp.pick_date = CURRENT_DATE
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- Standouts RPC: profiles with high astro_score + recently active
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
    AND sc.astro_score >= 0.75
    AND up.updated_at > now() - INTERVAL '7 days'
    AND sc.user_b_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
  UNION ALL
  -- also check where user is user_b in the cache (symmetric pair)
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
    AND sc.astro_score >= 0.75
    AND up.updated_at > now() - INTERVAL '7 days'
    AND sc.user_a_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
  ORDER BY astro_score DESC
  LIMIT 20;
$$;

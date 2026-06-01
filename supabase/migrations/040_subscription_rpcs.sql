CREATE OR REPLACE FUNCTION public.get_my_membership()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'user_id',              v_user_id,
    'plan_id',              pc.id,
    'plan_slug',            pc.plan_slug,
    'plan_name',            pc.plan_name,
    'plan_badge',           pc.plan_badge,
    'features',             pc.features,
    'status',               us.status,
    'current_period_end',   us.current_period_end,
    'is_active',            (
      us.status = 'active' AND (
        us.current_period_end IS NULL OR  -- lifetime
        us.current_period_end > now()
      )
    )
  )
  INTO v_result
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due')
  ORDER BY us.created_at DESC
  LIMIT 1;

  -- Return free plan if no active subscription
  IF v_result IS NULL THEN
    SELECT json_build_object(
      'user_id',              v_user_id,
      'plan_id',              id,
      'plan_slug',            plan_slug,
      'plan_name',            plan_name,
      'plan_badge',           plan_badge,
      'features',             features,
      'status',               null,
      'current_period_end',   null,
      'is_active',            false
    )
    INTO v_result
    FROM public.plan_catalog
    WHERE plan_slug = 'free'
    LIMIT 1;
  END IF;

  RETURN v_result;
END;
$$;

-- Check super_like quota for current user against their plan
CREATE OR REPLACE FUNCTION public.check_super_like_quota()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quota_limit INT;
  v_used INT;
  v_features JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  -- Get plan features (active sub or free)
  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features FROM public.plan_catalog WHERE plan_slug = 'free';
  END IF;

  v_quota_limit := COALESCE((v_features->>'super_likes_per_day')::INT, 1);

  -- 999 = unlimited
  IF v_quota_limit >= 999 THEN
    RETURN json_build_object('allowed', true, 'used', 0, 'limit', 999, 'unlimited', true);
  END IF;

  -- Get today's used count (reset if quota_date is not today)
  SELECT CASE WHEN quota_date = CURRENT_DATE THEN used_count ELSE 0 END
  INTO v_used
  FROM public.super_like_quota
  WHERE user_id = v_user_id;

  v_used := COALESCE(v_used, 0);

  IF v_used >= v_quota_limit THEN
    RETURN json_build_object('allowed', false, 'used', v_used, 'limit', v_quota_limit, 'reason', 'quota_exceeded');
  END IF;

  -- Increment
  INSERT INTO public.super_like_quota (user_id, quota_date, used_count)
  VALUES (v_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN super_like_quota.quota_date = CURRENT_DATE
          THEN super_like_quota.used_count + 1
          ELSE 1  -- reset for new day
        END,
        quota_date = CURRENT_DATE,
        updated_at = now();

  RETURN json_build_object('allowed', true, 'used', v_used + 1, 'limit', v_quota_limit);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_super_like_quota_status()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quota_limit INT;
  v_used INT;
  v_features JSONB;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC LIMIT 1;
  IF v_features IS NULL THEN
    SELECT features INTO v_features FROM public.plan_catalog WHERE plan_slug = 'free';
  END IF;
  v_quota_limit := COALESCE((v_features->>'super_likes_per_day')::INT, 1);
  IF v_quota_limit >= 999 THEN
    RETURN json_build_object('allowed', true, 'used', 0, 'limit', 999, 'unlimited', true);
  END IF;
  SELECT CASE WHEN quota_date = CURRENT_DATE THEN used_count ELSE 0 END
  INTO v_used FROM public.super_like_quota WHERE user_id = v_user_id;
  v_used := COALESCE(v_used, 0);
  RETURN json_build_object('allowed', v_used < v_quota_limit, 'used', v_used, 'limit', v_quota_limit);
END;
$$;

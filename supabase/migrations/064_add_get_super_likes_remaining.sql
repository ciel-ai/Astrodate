-- Migration 064: get_super_likes_remaining(p_user_id UUID) RETURNS INT
-- Returns GREATEST(0, limit - used) for the given user based on their active plan.
-- Uses the same plan/quota logic as check_super_like_quota and get_super_like_quota_status.
-- SECURITY DEFINER so the client can call it without direct table access.

CREATE OR REPLACE FUNCTION public.get_super_likes_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features  JSONB;
  v_limit     INT;
  v_used      INT;
BEGIN
  -- Resolve the user's active plan features (falls back to free tier)
  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM public.plan_catalog
    WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'super_likes_per_day')::INT, 1);

  -- Unlimited plan — return a sentinel that the client treats as "no limit"
  IF v_limit >= 999 THEN
    RETURN 999;
  END IF;

  -- Today's used count (0 if no row yet or row is from a previous day)
  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.super_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

-- Allow authenticated users to call this for their own user_id.
-- The function is SECURITY DEFINER so it can read plan_catalog and super_like_quota
-- without the caller needing direct SELECT on those tables.
GRANT EXECUTE ON FUNCTION public.get_super_likes_remaining(UUID) TO authenticated;

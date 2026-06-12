-- Migration 071: check_super_like_quota(p_user_id UUID) RETURNS BOOLEAN
-- Returns TRUE if the user has at least one super like remaining today, FALSE if quota exhausted.
-- Mirrors the plan/quota logic in get_super_likes_remaining (migration 064).

CREATE OR REPLACE FUNCTION public.check_super_like_quota(p_user_id UUID)
RETURNS BOOLEAN
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

  -- Unlimited plan — always allow
  IF v_limit >= 999 THEN
    RETURN TRUE;
  END IF;

  -- Today's used count
  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.super_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN v_used < v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_super_like_quota(UUID) TO authenticated;

-- Migration 083: Fix super-like quota enforcement.
--
-- Problems fixed:
--   1. check_super_like_quota(p_user_id UUID) from migration 071 was read-only
--      (no increment) so quota was never actually consumed.
--   2. Both 064 and 071 read features->>'super_likes_per_day' but migration 074
--      seeded the key as 'weekly_stars' (now 'daily_super_likes'), so every
--      plan fell back to COALESCE(NULL, 1) = 1 regardless of tier.
--
-- Fix: replace the broken check function with consume_super_like() which does
--      an atomic check + increment, and update get_super_likes_remaining() to
--      use the correct 'daily_super_likes' key.

-- ─── 1. Drop the broken read-only overload ───────────────────────────────────
DROP FUNCTION IF EXISTS public.check_super_like_quota(UUID);

-- ─── 2. consume_super_like — atomic check + increment ────────────────────────
CREATE OR REPLACE FUNCTION public.consume_super_like(p_user_id UUID)
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
  -- Resolve active plan features (falls back to free tier)
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

  -- -1 means unlimited (paid tiers)
  v_limit := COALESCE((v_features->>'daily_super_likes')::INT, 1);
  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN TRUE;
  END IF;

  -- Today's used count (0 if first use or new day)
  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.super_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  -- Atomic upsert — resets count on new day
  INSERT INTO public.super_like_quota (user_id, quota_date, used_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN super_like_quota.quota_date = CURRENT_DATE
          THEN super_like_quota.used_count + 1
          ELSE 1
        END,
        quota_date  = CURRENT_DATE,
        updated_at  = now();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_super_like(UUID) TO authenticated;

-- ─── 3. Fix get_super_likes_remaining to use daily_super_likes key ────────────
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

  v_limit := COALESCE((v_features->>'daily_super_likes')::INT, 1);
  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_super_likes_remaining(UUID) TO authenticated;

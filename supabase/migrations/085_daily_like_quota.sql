-- Migration 085: Daily like quota enforcement.
--
-- The plan_catalog already seeds daily_likes: Free=10, Astro+/AstroX=-1 (unlimited).
-- This migration wires the enforcement layer: a quota table + atomic consume_like()
-- function that the client calls before saving a regular like.

-- ─── 1. Daily like quota tracker ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_like_quota (
  user_id    UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date DATE  NOT NULL DEFAULT CURRENT_DATE,
  used_count INT   NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_like_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own like quota" ON public.daily_like_quota
  FOR ALL USING (auth.uid() = user_id);

-- ─── 2. consume_like — atomic check + increment ───────────────────────────────
-- Returns TRUE if the like is allowed (and the quota is incremented).
-- Returns FALSE if the daily cap is reached — client should show upgrade sheet.
-- -1 in features.daily_likes means unlimited (paid tiers).
CREATE OR REPLACE FUNCTION public.consume_like(p_user_id UUID)
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

  -- Free default is 10; -1 = unlimited
  v_limit := COALESCE((v_features->>'daily_likes')::INT, 10);
  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN TRUE;
  END IF;

  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.daily_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  -- Atomic upsert — resets count on new day
  INSERT INTO public.daily_like_quota (user_id, quota_date, used_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN daily_like_quota.quota_date = CURRENT_DATE
          THEN daily_like_quota.used_count + 1
          ELSE 1
        END,
        quota_date  = CURRENT_DATE,
        updated_at  = now();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_like(UUID) TO authenticated;

-- ─── 3. get_likes_remaining — for displaying counter in UI ───────────────────
CREATE OR REPLACE FUNCTION public.get_likes_remaining(p_user_id UUID)
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

  v_limit := COALESCE((v_features->>'daily_likes')::INT, 10);
  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;

  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.daily_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_likes_remaining(UUID) TO authenticated;

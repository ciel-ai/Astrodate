-- 1. Add signal_score to synastry_cache
ALTER TABLE public.synastry_cache
  ADD COLUMN IF NOT EXISTS signal_score NUMERIC DEFAULT 0;

-- 2. get_signal_score: weighted sum with time decay
CREATE OR REPLACE FUNCTION public.get_signal_score(p_viewer_id UUID, p_target_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  score NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(
    s.signal_weight *
    CASE
      WHEN s.created_at >= now() - INTERVAL '7 days'  THEN 1.0
      WHEN s.created_at >= now() - INTERVAL '30 days' THEN 0.5
      ELSE 0.2
    END
  ), 0)
  INTO score
  FROM public.user_signals s
  WHERE s.user_id = p_viewer_id
    AND s.target_user_id = p_target_id;
  RETURN ROUND(score::NUMERIC, 4);
END;
$$;

-- 3. record_signal: inserts event + upserts synastry_cache signal_score
CREATE OR REPLACE FUNCTION public.record_signal(
  p_user_id UUID,
  p_target_id UUID,
  p_signal_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_weight NUMERIC;
  v_a UUID;
  v_b UUID;
  v_new_signal_score NUMERIC;
BEGIN
  -- Lookup weight
  SELECT base_weight INTO v_weight
  FROM public.signal_weight_config
  WHERE signal_type = p_signal_type;

  IF v_weight IS NULL THEN
    RETURN; -- Unknown signal type, silently skip
  END IF;

  -- Insert event log
  INSERT INTO public.user_signals (user_id, target_user_id, signal_type, signal_weight)
  VALUES (p_user_id, p_target_id, p_signal_type, v_weight);

  -- Upsert synastry_cache signal_score
  -- Enforce user_a < user_b for the CHECK constraint
  v_a := LEAST(p_user_id, p_target_id);
  v_b := GREATEST(p_user_id, p_target_id);

  v_new_signal_score := public.get_signal_score(p_user_id, p_target_id);

  INSERT INTO public.synastry_cache (user_a_id, user_b_id, astro_score, signal_score, computed_at)
  VALUES (v_a, v_b, 0, v_new_signal_score, now())
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE
    SET signal_score = EXCLUDED.signal_score,
        computed_at  = now();
END;
$$;

-- Requires pg_cron. Enable it in Supabase Dashboard > Database > Extensions before running this migration.
-- Wrap in DO block so migration does not fail if pg_cron is not yet enabled.

DO $$
BEGIN
  -- Only schedule if cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Nightly activity decay: reduce score by 10% for users inactive > 48h
    PERFORM cron.schedule(
      'activity-decay-nightly',
      '0 2 * * *',
      $$
        UPDATE public.user_profiles
        SET updated_at = updated_at  -- touch to keep index fresh
        WHERE updated_at < now() - INTERVAL '48 hours';
      $$
    );

    -- Daily picks generation: midnight, top AstroScore match per user
    PERFORM cron.schedule(
      'daily-picks-midnight',
      '0 0 * * *',
      $$
        INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
        SELECT DISTINCT ON (sc.user_a_id)
          sc.user_a_id,
          sc.user_b_id,
          sc.astro_score,
          CURRENT_DATE
        FROM public.synastry_cache sc
        JOIN public.user_profiles up ON up.user_id = sc.user_b_id
        WHERE up.updated_at > now() - INTERVAL '7 days'
          AND sc.astro_score IS NOT NULL
        ORDER BY sc.user_a_id, sc.astro_score DESC
        ON CONFLICT (user_id, pick_date) DO NOTHING;

        -- Also populate for user_b_id as viewer (cache is directional)
        INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
        SELECT DISTINCT ON (sc.user_b_id)
          sc.user_b_id,
          sc.user_a_id,
          sc.astro_score,
          CURRENT_DATE
        FROM public.synastry_cache sc
        JOIN public.user_profiles up ON up.user_id = sc.user_a_id
        WHERE up.updated_at > now() - INTERVAL '7 days'
          AND sc.astro_score IS NOT NULL
        ORDER BY sc.user_b_id, sc.astro_score DESC
        ON CONFLICT (user_id, pick_date) DO NOTHING;
      $$
    );

  END IF;
END
$$;

-- Manual trigger function so picks can be generated on-demand (e.g. for testing)
CREATE OR REPLACE FUNCTION public.generate_daily_picks_now()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE inserted INT := 0;
BEGIN
  INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
  SELECT DISTINCT ON (sc.user_a_id)
    sc.user_a_id, sc.user_b_id, sc.astro_score, CURRENT_DATE
  FROM public.synastry_cache sc
  JOIN public.user_profiles up ON up.user_id = sc.user_b_id
  WHERE up.updated_at > now() - INTERVAL '7 days'
    AND sc.astro_score IS NOT NULL
  ORDER BY sc.user_a_id, sc.astro_score DESC
  ON CONFLICT (user_id, pick_date) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

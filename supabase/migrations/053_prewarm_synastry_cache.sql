-- Migration 053: Safe async synastry cache prewarming
-- Phase 1 beta: enqueue a maximum of 25 likely candidates after onboarding,
-- then let an Edge Function process small batches without blocking the app.

-- Performance indexes for pair lookups in both pair directions.
CREATE INDEX IF NOT EXISTS idx_synastry_cache_user_a_id
  ON public.synastry_cache (user_a_id);

CREATE INDEX IF NOT EXISTS idx_synastry_cache_user_b_id
  ON public.synastry_cache (user_b_id);

CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_user_a_id
  ON public.synastry_cache_details (user_a_id);

CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_user_b_id
  ON public.synastry_cache_details (user_b_id);

-- Stale flags avoid delete storms when birth/chart data changes.
ALTER TABLE public.synastry_cache
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.synastry_cache_details
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_synastry_cache_fresh_lookup
  ON public.synastry_cache (user_a_id, user_b_id, computed_at DESC)
  WHERE is_stale = false;

CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_fresh_lookup
  ON public.synastry_cache_details (user_a_id, user_b_id, computed_at DESC)
  WHERE is_stale = false;

-- Lightweight, retry-safe queue. One active job per unordered pair.
CREATE TABLE IF NOT EXISTS public.synastry_prewarm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_a_id UUID GENERATED ALWAYS AS (LEAST(user_id, candidate_user_id)) STORED,
  pair_b_id UUID GENERATED ALWAYS AS (GREATEST(user_id, candidate_user_id)) STORED,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT synastry_prewarm_jobs_no_self CHECK (user_id <> candidate_user_id),
  CONSTRAINT synastry_prewarm_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'processed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_synastry_prewarm_jobs_active_pair
  ON public.synastry_prewarm_jobs (pair_a_id, pair_b_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_synastry_prewarm_jobs_status_created
  ON public.synastry_prewarm_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_synastry_prewarm_jobs_user_status
  ON public.synastry_prewarm_jobs (user_id, status, created_at DESC);

ALTER TABLE public.synastry_prewarm_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages synastry prewarm jobs"
  ON public.synastry_prewarm_jobs;

CREATE POLICY "Service role manages synastry prewarm jobs"
  ON public.synastry_prewarm_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Helper: intentionally simple location priority for Phase 1.
-- TODO: Replace string normalization with geohash buckets, PostGIS, or real distance scoring.
CREATE OR REPLACE FUNCTION public.synastry_location_priority(
  viewer_location TEXT,
  candidate_location TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN viewer_location IS NULL OR candidate_location IS NULL THEN 1
    WHEN lower(trim(viewer_location)) = lower(trim(candidate_location)) THEN 0
    ELSE 1
  END;
$$;

-- Mark cache rows stale instead of deleting them when astro data changes.
CREATE OR REPLACE FUNCTION public.mark_synastry_cache_stale_for_astro_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.synastry_cache
  SET is_stale = true
  WHERE user_a_id = v_user_id OR user_b_id = v_user_id;

  UPDATE public.synastry_cache_details
  SET is_stale = true
  WHERE user_a_id = v_user_id OR user_b_id = v_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_synastry_cache_stale_on_astro_change
  ON public.astro_details;

CREATE TRIGGER trg_mark_synastry_cache_stale_on_astro_change
AFTER INSERT OR UPDATE OR DELETE ON public.astro_details
FOR EACH ROW
EXECUTE FUNCTION public.mark_synastry_cache_stale_for_astro_change();

-- Enqueue only. No synastry computation happens here.
CREATE OR REPLACE FUNCTION public.enqueue_synastry_prewarm(p_user_id UUID)
RETURNS TABLE(enqueued_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot enqueue prewarm for another user';
  END IF;

  WITH viewer AS (
    SELECT
      up.user_id,
      up.gender,
      up.location,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age,
      COALESCE(pref.min_age, 18) AS min_age,
      COALESCE(pref.max_age, 65) AS max_age,
      NULLIF(lower(trim(COALESCE(pref.gender_preference, ''))), '') AS gender_preference
    FROM public.user_profiles up
    LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
    LEFT JOIN public.user_preferences pref ON pref.user_id = up.user_id
    WHERE up.user_id = p_user_id
  ),
  candidate_activity AS (
    SELECT us.user_id, MAX(us.created_at) AS last_signal_at
    FROM public.user_signals us
    GROUP BY us.user_id
  ),
  ranked_candidates AS (
    SELECT
      c.user_id AS candidate_user_id
    FROM viewer v
    JOIN public.user_profiles c ON c.user_id <> v.user_id
    LEFT JOIN public.astro_details cad ON cad.user_id = c.user_id
    LEFT JOIN public.user_preferences cpref ON cpref.user_id = c.user_id
    LEFT JOIN public.user_online_status os ON os.user_id = c.user_id
    LEFT JOIN candidate_activity ca ON ca.user_id = c.user_id
    LEFT JOIN public.synastry_cache sc
      ON sc.user_a_id = LEAST(v.user_id, c.user_id)
     AND sc.user_b_id = GREATEST(v.user_id, c.user_id)
     AND sc.is_stale = false
     AND sc.computed_at >= now() - INTERVAL '7 days'
    WHERE cad.user_id IS NOT NULL
      AND sc.user_a_id IS NULL
      AND c.user_id NOT IN (
        SELECT ul.liked_user_id
        FROM public.user_likes ul
        WHERE ul.user_id = v.user_id
      )
      AND (
        v.gender_preference IS NULL
        OR v.gender_preference IN ('any', 'all', 'everyone')
        OR lower(COALESCE(c.gender, '')) = v.gender_preference
      )
      AND (
        cpref.gender_preference IS NULL
        OR lower(trim(cpref.gender_preference)) IN ('any', 'all', 'everyone', '')
        OR lower(COALESCE(v.gender, '')) = lower(trim(cpref.gender_preference))
      )
      AND (
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, cad.birth_date))::INT
          BETWEEN v.min_age AND v.max_age
      )
      AND (
        v.age IS NULL
        OR v.age BETWEEN COALESCE(cpref.min_age, 18) AND COALESCE(cpref.max_age, 65)
      )
    ORDER BY
      CASE WHEN os.is_online THEN 0 ELSE 1 END,
      public.synastry_location_priority(v.location, c.location),
      COALESCE(os.last_seen, ca.last_signal_at, c.created_at) DESC
    LIMIT 25
  ),
  inserted AS (
    INSERT INTO public.synastry_prewarm_jobs (user_id, candidate_user_id)
    SELECT p_user_id, candidate_user_id
    FROM ranked_candidates
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted;
END;
$$;

-- Atomic small-batch claim helper for Edge Function workers.
CREATE OR REPLACE FUNCTION public.claim_synastry_prewarm_jobs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(id UUID, user_id UUID, candidate_user_id UUID, retry_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.synastry_prewarm_jobs j
    WHERE j.status = 'pending'
       OR (j.status = 'failed' AND j.retry_count < 3)
    ORDER BY j.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 10)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.synastry_prewarm_jobs j
  SET status = 'processing',
      last_error = NULL
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.id, j.user_id, j.candidate_user_id, j.retry_count;
END;
$$;

-- One-pair processor. The Edge Function calls this per claimed job to keep
-- transactions tiny and retry boundaries obvious.
CREATE OR REPLACE FUNCTION public.process_synastry_prewarm_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.synastry_prewarm_jobs%ROWTYPE;
  v_a UUID;
  v_b UUID;
  v_existing public.synastry_cache%ROWTYPE;
  v_astro_score NUMERIC;
BEGIN
  SELECT * INTO v_job
  FROM public.synastry_prewarm_jobs
  WHERE id = p_job_id
    AND status = 'processing';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'job_not_processing');
  END IF;

  v_a := LEAST(v_job.user_id, v_job.candidate_user_id);
  v_b := GREATEST(v_job.user_id, v_job.candidate_user_id);

  SELECT * INTO v_existing
  FROM public.synastry_cache
  WHERE user_a_id = v_a
    AND user_b_id = v_b
    AND is_stale = false
    AND computed_at >= now() - INTERVAL '7 days';

  IF FOUND THEN
    UPDATE public.synastry_prewarm_jobs
    SET status = 'processed',
        processed_at = now()
    WHERE id = p_job_id;

    RETURN jsonb_build_object('status', 'cache_fresh', 'astro_score', v_existing.astro_score);
  END IF;

  v_astro_score := public.compute_astro_score(v_job.user_id, v_job.candidate_user_id);

  INSERT INTO public.synastry_cache (
    user_a_id,
    user_b_id,
    astro_score,
    signal_score,
    computed_at,
    is_stale
  )
  VALUES (
    v_a,
    v_b,
    v_astro_score,
    public.get_signal_score(v_job.user_id, v_job.candidate_user_id),
    now(),
    false
  )
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
    astro_score = EXCLUDED.astro_score,
    signal_score = GREATEST(
      COALESCE(public.synastry_cache.signal_score, 0),
      COALESCE(EXCLUDED.signal_score, 0)
    ),
    computed_at = now(),
    is_stale = false;

  PERFORM *
  FROM public.get_synastry_detail(v_job.user_id, v_job.candidate_user_id);

  UPDATE public.synastry_cache_details
  SET is_stale = false,
      computed_at = now()
  WHERE user_a_id = v_a
    AND user_b_id = v_b;

  UPDATE public.synastry_prewarm_jobs
  SET status = 'processed',
      processed_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('status', 'processed', 'astro_score', v_astro_score);
EXCEPTION WHEN OTHERS THEN
  UPDATE public.synastry_prewarm_jobs
  SET status = CASE WHEN retry_count + 1 >= 3 THEN 'failed' ELSE 'pending' END,
      retry_count = retry_count + 1,
      last_error = left(SQLERRM, 1000),
      processed_at = CASE WHEN retry_count + 1 >= 3 THEN now() ELSE processed_at END
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'status', 'retry_scheduled',
    'error', SQLERRM
  );
END;
$$;

-- Refresh compute functions used by the worker/feed with explicit search_path.
CREATE OR REPLACE FUNCTION public.compute_astro_score(user_a UUID, user_b UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_row RECORD;
  b_row RECORD;
  sun_score NUMERIC := 0.5;
  venus_score NUMERIC := 0.5;
  mars_score NUMERIC := 0.5;
  nakshatra_score NUMERIC := 0.5;
  element_bonus NUMERIC := 0.0;
  final_score NUMERIC;
BEGIN
  SELECT western_sign, indian_sign, nakshatra_name, venus_sign, mars_sign, mercury_sign, dominant_element
  INTO a_row FROM public.astro_details WHERE user_id = user_a;
  IF NOT FOUND THEN RETURN 0.5; END IF;

  SELECT western_sign, indian_sign, nakshatra_name, venus_sign, mars_sign, mercury_sign, dominant_element
  INTO b_row FROM public.astro_details WHERE user_id = user_b;
  IF NOT FOUND THEN RETURN 0.5; END IF;

  sun_score := public.get_western_sign_score(a_row.western_sign, b_row.western_sign);
  venus_score := (
    public.get_western_sign_score(a_row.venus_sign, b_row.western_sign) +
    public.get_western_sign_score(b_row.venus_sign, a_row.western_sign)
  ) / 2.0;
  mars_score := public.get_western_sign_score(a_row.mars_sign, b_row.mars_sign);
  nakshatra_score := public.get_nakshatra_score(a_row.nakshatra_name, b_row.nakshatra_name);

  IF a_row.dominant_element IS NOT NULL AND b_row.dominant_element IS NOT NULL
     AND a_row.dominant_element = b_row.dominant_element THEN
    element_bonus := 0.05;
  END IF;

  final_score := (
    (sun_score * 0.30) +
    (venus_score * 0.30) +
    (mars_score * 0.20) +
    (nakshatra_score * 0.20)
  ) + element_bonus;

  RETURN LEAST(ROUND(final_score::NUMERIC, 4), 1.0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_synastry_detail(user_x UUID, user_y UUID)
RETURNS TABLE (
  sun_score              NUMERIC,
  moon_score             NUMERIC,
  venus_score            NUMERIC,
  mars_score             NUMERIC,
  mercury_score          NUMERIC,
  dominant_element_match BOOLEAN,
  compatibility_summary  TEXT,
  badges                 JSONB,
  computed_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_cached public.synastry_cache_details%ROWTYPE;
  a_rec public.astro_details%ROWTYPE;
  b_rec public.astro_details%ROWTYPE;
  v_sun     NUMERIC(4,2) := 5;
  v_moon    NUMERIC(4,2) := 5;
  v_venus   NUMERIC(4,2) := 5;
  v_mars    NUMERIC(4,2) := 5;
  v_mercury NUMERIC(4,2) := 5;
  v_elem    BOOLEAN      := false;
  v_summary TEXT;
  v_badges  JSONB        := '[]'::JSONB;
BEGIN
  IF user_x < user_y THEN
    v_a := user_x; v_b := user_y;
  ELSE
    v_a := user_y; v_b := user_x;
  END IF;

  SELECT * INTO v_cached
  FROM public.synastry_cache_details
  WHERE user_a_id = v_a
    AND user_b_id = v_b
    AND is_stale = false;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_cached.sun_score, v_cached.moon_score, v_cached.venus_score,
      v_cached.mars_score, v_cached.mercury_score,
      v_cached.dominant_element_match, v_cached.compatibility_summary,
      v_cached.badges, v_cached.computed_at;
    RETURN;
  END IF;

  SELECT * INTO a_rec FROM public.astro_details WHERE user_id = v_a LIMIT 1;
  SELECT * INTO b_rec FROM public.astro_details WHERE user_id = v_b LIMIT 1;

  IF a_rec IS NOT NULL AND b_rec IS NOT NULL THEN
    v_sun     := COALESCE(public.get_sign_compatibility(a_rec.western_sign, b_rec.western_sign), 5);
    v_moon    := COALESCE(public.get_sign_compatibility(a_rec.indian_sign,  b_rec.indian_sign),  5);
    v_venus   := COALESCE(public.get_sign_compatibility(a_rec.venus_sign,   b_rec.venus_sign),   5);
    v_mars    := COALESCE(public.get_sign_compatibility(a_rec.mars_sign,    b_rec.mars_sign),    5);
    v_mercury := COALESCE(public.get_sign_compatibility(a_rec.mercury_sign, b_rec.mercury_sign), 5);
    v_elem    := COALESCE(a_rec.dominant_element = b_rec.dominant_element, false);

    v_summary := CASE
      WHEN v_venus >= 8 THEN 'Your Venus signs suggest strong romantic reassurance and deep love language alignment.'
      WHEN v_moon  >= 8 THEN 'Your Moon signs indicate exceptional emotional understanding and intuitive connection.'
      WHEN v_sun   >= 8 THEN 'Your Sun signs reflect a powerful core identity match - you naturally inspire each other.'
      WHEN v_mars  >= 8 THEN 'Your Mars signs show high physical chemistry and shared drive.'
      WHEN v_mercury >= 8 THEN 'Your Mercury signs promise effortless communication and lively intellectual exchange.'
      WHEN v_elem       THEN 'Matching dominant elements create a natural rhythm and elemental harmony between you.'
      ELSE 'Your charts reveal a unique blend of contrasts and complementary energies worth exploring.'
    END;

    IF v_sun >= 9 AND v_moon >= 9 THEN
      v_badges := v_badges || '["Twin Flames"]'::JSONB;
    END IF;
    IF v_venus >= 8 AND v_mars >= 8 THEN
      v_badges := v_badges || '["Fiery Passion"]'::JSONB;
    END IF;
    IF v_mercury >= 8 THEN
      v_badges := v_badges || '["Cosmic Conversationalists"]'::JSONB;
    END IF;
    IF v_elem THEN
      v_badges := v_badges || '["Elemental Match"]'::JSONB;
    END IF;
  ELSE
    v_summary := 'Complete your birth chart to unlock full compatibility insights.';
  END IF;

  INSERT INTO public.synastry_cache_details (
    user_a_id, user_b_id,
    sun_score, moon_score, venus_score, mars_score, mercury_score,
    dominant_element_match, compatibility_summary, badges,
    computed_at, is_stale
  ) VALUES (
    v_a, v_b,
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges,
    now(), false
  )
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
    sun_score              = EXCLUDED.sun_score,
    moon_score             = EXCLUDED.moon_score,
    venus_score            = EXCLUDED.venus_score,
    mars_score             = EXCLUDED.mars_score,
    mercury_score          = EXCLUDED.mercury_score,
    dominant_element_match = EXCLUDED.dominant_element_match,
    compatibility_summary  = EXCLUDED.compatibility_summary,
    badges                 = EXCLUDED.badges,
    computed_at            = now(),
    is_stale               = false;

  RETURN QUERY SELECT
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges, now()::TIMESTAMPTZ;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_final_matches(input_user_id UUID)
RETURNS TABLE (
  match_user_id UUID,
  full_name TEXT,
  gender TEXT,
  age INT,
  location TEXT,
  final_match_score NUMERIC,
  personality_score NUMERIC,
  indian_score NUMERIC,
  western_score NUMERIC,
  indian_recommendation TEXT,
  western_report TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      up.user_id AS cand_id,
      up.full_name,
      up.gender,
      up.location,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age
    FROM public.user_profiles up
    LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
    WHERE up.user_id <> input_user_id
      AND up.user_id NOT IN (
        SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
      )
  ),
  scored AS (
    SELECT
      c.cand_id,
      c.full_name,
      c.gender,
      c.age,
      c.location,
      ROUND(
        COALESCE(
          (
            SELECT sc.astro_score
            FROM public.synastry_cache sc
            WHERE sc.user_a_id = LEAST(input_user_id, c.cand_id)
              AND sc.user_b_id = GREATEST(input_user_id, c.cand_id)
              AND sc.is_stale = false
              AND sc.computed_at >= now() - INTERVAL '7 days'
          ),
          public.compute_astro_score(input_user_id, c.cand_id)
        ) * 50,
      2) AS western_score,
      ROUND(public.compute_personality_score(input_user_id, c.cand_id) * 30, 2) AS personality_score,
      ROUND(public.get_nakshatra_score(
        (SELECT nakshatra_name FROM public.astro_details WHERE user_id = input_user_id),
        (SELECT nakshatra_name FROM public.astro_details WHERE user_id = c.cand_id)
      ) * 20, 2) AS indian_score,
      COALESCE(
        (SELECT sc.signal_score
         FROM public.synastry_cache sc
         WHERE sc.user_a_id = LEAST(input_user_id, c.cand_id)
           AND sc.user_b_id = GREATEST(input_user_id, c.cand_id)
           AND sc.is_stale = false),
        public.get_signal_score(input_user_id, c.cand_id)
      ) AS raw_signal_score
    FROM candidates c
  )
  SELECT
    s.cand_id AS match_user_id,
    s.full_name,
    s.gender,
    s.age,
    s.location,
    ROUND(
      ((s.western_score + s.personality_score + s.indian_score) * 0.85)
      + (LEAST(s.raw_signal_score, 15.0) * 1.0),
    2) AS final_match_score,
    s.personality_score,
    s.indian_score,
    s.western_score,
    CASE
      WHEN s.indian_score >= 16 THEN 'Excellent Nakshatra Match'
      WHEN s.indian_score >= 12 THEN 'Good Nakshatra Match'
      WHEN s.indian_score >= 8  THEN 'Average Match'
      ELSE 'Challenging Match'
    END AS indian_recommendation,
    CASE
      WHEN s.western_score >= 40 THEN 'Highly Compatible'
      WHEN s.western_score >= 30 THEN 'Good Compatibility'
      WHEN s.western_score >= 20 THEN 'Some Compatibility'
      ELSE 'Low Compatibility'
    END AS western_report
  FROM scored s
  ORDER BY final_match_score DESC
  LIMIT 50;
END;
$$;

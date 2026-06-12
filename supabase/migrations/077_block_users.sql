-- 1. Create block_users table
CREATE TABLE IF NOT EXISTS public.block_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE public.block_users ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist before creating
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can select own blocks') THEN 
    DROP POLICY "Users can select own blocks" ON public.block_users;
  END IF; 
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own blocks') THEN 
    DROP POLICY "Users can insert own blocks" ON public.block_users;
  END IF; 
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own blocks') THEN 
    DROP POLICY "Users can delete own blocks" ON public.block_users;
  END IF; 
END $$;

CREATE POLICY "Users can select own blocks" ON public.block_users
  FOR SELECT USING (blocker_id = auth.uid());

CREATE POLICY "Users can insert own blocks" ON public.block_users
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can delete own blocks" ON public.block_users
  FOR DELETE USING (blocker_id = auth.uid());

-- 2. Create RPC block_user(p_blocked_id uuid) SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into block_users
  INSERT INTO public.block_users (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- Delete from user_matches (unmatch logic)
  DELETE FROM public.user_matches
  WHERE (user1_id = auth.uid() AND user2_id = p_blocked_id)
     OR (user2_id = auth.uid() AND user1_id = p_blocked_id);
END;
$$;

-- 3. Create RPC get_blocked_user_ids() SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_blocked_user_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT blocked_id
  FROM public.block_users
  WHERE blocker_id = auth.uid();
END;
$$;

-- Grant permissions for new RPCs
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_blocked_user_ids() TO authenticated;

-- 4. Redefine get_fallback_feed with blocking filters
CREATE OR REPLACE FUNCTION public.get_fallback_feed(input_user_id UUID)
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
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    up.user_id AS match_user_id,
    up.full_name,
    up.gender,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age,
    up.location,
    -- Decay score by recency rank so feed still has signal
    ROUND(GREATEST(10.0 - (ROW_NUMBER() OVER (ORDER BY up.updated_at DESC) * 0.2), 1.0)::NUMERIC, 2) AS final_match_score,
    0::NUMERIC AS personality_score,
    0::NUMERIC AS indian_score,
    0::NUMERIC AS western_score,
    'Unscored'::TEXT AS indian_recommendation,
    'Unscored'::TEXT AS western_report
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  WHERE up.user_id <> input_user_id
    AND up.user_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocked_id FROM public.block_users WHERE blocker_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocker_id FROM public.block_users WHERE blocked_id = input_user_id
    )
  ORDER BY up.updated_at DESC
  LIMIT 50;
$$;

-- 5. Redefine get_final_matches with blocking filters
CREATE OR REPLACE FUNCTION public.get_final_matches(input_user_id UUID)
RETURNS TABLE (
  match_user_id         UUID,
  full_name             TEXT,
  gender                TEXT,
  age                   INT,
  location              TEXT,
  final_match_score     NUMERIC,
  personality_score     NUMERIC,
  indian_score          NUMERIC,
  western_score         NUMERIC,
  indian_recommendation TEXT,
  western_report        TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_western_sign      TEXT;
  v_venus_sign        TEXT;
  v_mars_sign         TEXT;
  v_nakshatra         TEXT;
  v_dominant_elem     TEXT;
  v_min_age           INT;
  v_max_age           INT;
  v_gender_pref       TEXT;
  v_location          TEXT;
  v_preferred_elems   TEXT[];
  v_blocked_signs     TEXT[];
  v_introvert_ext     TEXT;
  v_hobbies           TEXT[];
  v_looking_for       TEXT;
  v_planning_style    TEXT;
  v_show_care         TEXT;
BEGIN
  -- Step 1: Fetch viewer's astro data
  SELECT
    COALESCE(ad.western_sign,     ''),
    COALESCE(ad.venus_sign,       ''),
    COALESCE(ad.mars_sign,        ''),
    COALESCE(ad.nakshatra_name,   ''),
    COALESCE(ad.dominant_element, '')
  INTO v_western_sign, v_venus_sign, v_mars_sign, v_nakshatra, v_dominant_elem
  FROM public.astro_details ad
  WHERE ad.user_id = input_user_id;

  -- Step 2: Fetch viewer's preferences (LEFT JOIN to handle missing prefs row)
  SELECT
    COALESCE(up.min_age, 18),
    COALESCE(up.max_age, 65),
    up.gender_preference,
    COALESCE(up.location, prof.location),
    COALESCE(up.preferred_elements, '{}'),
    COALESCE(up.blocked_signs,      '{}')
  INTO v_min_age, v_max_age, v_gender_pref, v_location, v_preferred_elems, v_blocked_signs
  FROM public.user_profiles prof
  LEFT JOIN public.user_preferences up ON up.user_id = prof.user_id
  WHERE prof.user_id = input_user_id;

  -- Fallback defaults
  v_min_age           := COALESCE(v_min_age, 18);
  v_max_age           := COALESCE(v_max_age, 65);
  v_preferred_elems   := COALESCE(v_preferred_elems, '{}');
  v_blocked_signs     := COALESCE(v_blocked_signs,   '{}');

  -- Step 3: Fetch viewer's personality data
  SELECT
    s1.introvert_extrovert,
    COALESCE(s1.hobbies, '{}'),
    s1.looking_for,
    pq.what_best_describes_your_planning_style,
    pq.how_do_you_show_care_in_a_relationship
  INTO v_introvert_ext, v_hobbies, v_looking_for, v_planning_style, v_show_care
  FROM public.section1_qns s1
  LEFT JOIN public.personality_qns pq ON pq.user_id = s1.user_id
  WHERE s1.user_id = input_user_id;

  -- Step 4: Score candidates
  RETURN QUERY
  WITH
  acted_on AS MATERIALIZED (
    SELECT liked_user_id
    FROM public.user_likes
    WHERE user_id = input_user_id
  ),
  candidates AS (
    SELECT
      up.user_id                                                        AS cand_id,
      up.full_name,
      up.gender,
      up.location                                                       AS cand_location,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT         AS age,
      COALESCE(ad.western_sign,     '')                                 AS cand_western_sign,
      COALESCE(ad.venus_sign,       '')                                 AS cand_venus_sign,
      COALESCE(ad.mars_sign,        '')                                 AS cand_mars_sign,
      COALESCE(ad.nakshatra_name,   '')                                 AS cand_nakshatra,
      COALESCE(ad.dominant_element, '')                                 AS cand_dominant_elem
    FROM public.user_profiles up
    LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
    WHERE
      up.user_id <> input_user_id
      AND up.user_id NOT IN (SELECT liked_user_id FROM acted_on)
      AND up.user_id NOT IN (SELECT blocked_id FROM public.block_users WHERE blocker_id = input_user_id)
      AND up.user_id NOT IN (SELECT blocker_id FROM public.block_users WHERE blocked_id = input_user_id)
      AND (
        ad.birth_date IS NULL
        OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))
           BETWEEN v_min_age AND v_max_age
      )
      AND (
        v_gender_pref IS NULL
        OR lower(v_gender_pref) IN ('everyone', 'all', '')
        OR lower(up.gender) = lower(v_gender_pref)
      )
      -- blocked_signs: exclude candidates whose western_sign is in the blocked list
      AND (
        array_length(v_blocked_signs, 1) IS NULL
        OR array_length(v_blocked_signs, 1) = 0
        OR NOT (COALESCE(ad.western_sign, '') = ANY(v_blocked_signs))
      )
      -- preferred_elements: if the user set element preferences, only show
      -- candidates whose dominant_element matches one of them.
      -- If no elements are selected the filter is open (show everyone).
      AND (
        array_length(v_preferred_elems, 1) IS NULL
        OR array_length(v_preferred_elems, 1) = 0
        OR COALESCE(ad.dominant_element, '') = ANY(v_preferred_elems)
      )
    ORDER BY
      CASE WHEN v_location IS NOT NULL AND up.location = v_location THEN 0 ELSE 1 END,
      up.updated_at DESC
    LIMIT 300
  ),
  cand_personality AS (
    SELECT
      s1.user_id,
      s1.introvert_extrovert,
      COALESCE(s1.hobbies, '{}')                                AS hobbies,
      s1.looking_for,
      pq.what_best_describes_your_planning_style                AS planning_style,
      pq.how_do_you_show_care_in_a_relationship                 AS show_care
    FROM public.section1_qns s1
    LEFT JOIN public.personality_qns pq ON pq.user_id = s1.user_id
    WHERE s1.user_id IN (SELECT cand_id FROM candidates)
  ),
  signal_scores AS (
    SELECT
      c.cand_id,
      COALESCE(
        (SELECT sc.signal_score
         FROM public.synastry_cache sc
         WHERE sc.user_a_id = LEAST(input_user_id, c.cand_id)
           AND sc.user_b_id = GREATEST(input_user_id, c.cand_id)),
        public.get_signal_score(input_user_id, c.cand_id)
      ) AS signal_score
    FROM candidates c
  ),
  scored AS (
    SELECT
      c.cand_id,
      c.full_name,
      c.gender,
      c.age,
      c.cand_location AS location,
      ROUND(
        LEAST(
          (
            (public.get_western_sign_score(v_western_sign, c.cand_western_sign) * 0.30)
          + ((public.get_western_sign_score(v_venus_sign, c.cand_western_sign)
             + public.get_western_sign_score(c.cand_venus_sign, v_western_sign)
             ) / 2.0 * 0.30)
          + (public.get_western_sign_score(v_mars_sign, c.cand_mars_sign) * 0.20)
          + (public.get_nakshatra_score(v_nakshatra, c.cand_nakshatra) * 0.20)
          + CASE WHEN v_dominant_elem <> '' AND c.cand_dominant_elem <> ''
                  AND v_dominant_elem = c.cand_dominant_elem THEN 0.05 ELSE 0.0 END
          ),
          1.0
        ) * 50,
      2) AS western_score,
      ROUND(public.get_nakshatra_score(v_nakshatra, c.cand_nakshatra) * 20, 2)
        AS indian_score,
      ROUND(
        CASE
          WHEN cp.user_id IS NULL THEN 0.5 * 30
          ELSE (
            (
              CASE WHEN v_introvert_ext IS NULL OR cp.introvert_extrovert IS NULL THEN NULL
                   WHEN v_introvert_ext = cp.introvert_extrovert THEN 0.6
                   ELSE 0.8 END
              +
              CASE WHEN array_length(v_hobbies,1) > 0 AND array_length(cp.hobbies,1) > 0
                   THEN 0.5 + (
                     (SELECT COUNT(*)::NUMERIC FROM unnest(v_hobbies) h WHERE h = ANY(cp.hobbies))
                     / GREATEST(array_length(v_hobbies,1), array_length(cp.hobbies,1))::NUMERIC
                     * 0.5)
                   ELSE NULL END
              +
              CASE WHEN v_looking_for IS NULL OR cp.looking_for IS NULL THEN NULL
                   WHEN v_looking_for = cp.looking_for THEN 0.9
                   ELSE 0.4 END
              +
              CASE WHEN v_planning_style IS NULL OR cp.planning_style IS NULL THEN NULL
                   WHEN v_planning_style = cp.planning_style THEN 0.7
                   ELSE 0.5 END
              +
              CASE WHEN v_show_care IS NULL OR cp.show_care IS NULL THEN NULL
                   WHEN v_show_care = cp.show_care THEN 0.8
                   ELSE 0.55 END
            )
            / NULLIF(
                (CASE WHEN v_introvert_ext IS NOT NULL AND cp.introvert_extrovert IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN array_length(v_hobbies,1) > 0 AND array_length(cp.hobbies,1) > 0 THEN 1 ELSE 0 END
               + CASE WHEN v_looking_for IS NOT NULL AND cp.looking_for IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN v_planning_style IS NOT NULL AND cp.planning_style IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN v_show_care IS NOT NULL AND cp.show_care IS NOT NULL THEN 1 ELSE 0 END),
              0)
          )
        END * 30,
      2) AS personality_score,
      COALESCE(ss.signal_score, 0) AS raw_signal_score
    FROM candidates c
    LEFT JOIN cand_personality cp ON cp.user_id = c.cand_id
    LEFT JOIN signal_scores    ss ON ss.cand_id = c.cand_id
  )
  SELECT
    s.cand_id                                                           AS match_user_id,
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
      WHEN s.indian_score >=  8 THEN 'Average Match'
      ELSE                           'Challenging Match'
    END AS indian_recommendation,
    CASE
      WHEN s.western_score >= 40 THEN 'Highly Compatible'
      WHEN s.western_score >= 30 THEN 'Good Compatibility'
      WHEN s.western_score >= 20 THEN 'Some Compatibility'
      ELSE                           'Low Compatibility'
    END AS western_report
  FROM scored s
  ORDER BY final_match_score DESC
  LIMIT 50;

END;
$$;

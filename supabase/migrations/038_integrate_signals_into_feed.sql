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
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
      ROUND(public.compute_astro_score(input_user_id, c.cand_id) * 50, 2)        AS western_score,
      ROUND(public.compute_personality_score(input_user_id, c.cand_id) * 30, 2)  AS personality_score,
      ROUND(public.get_nakshatra_score(
        (SELECT nakshatra_name FROM public.astro_details WHERE user_id = input_user_id),
        (SELECT nakshatra_name FROM public.astro_details WHERE user_id = c.cand_id)
      ) * 20, 2)                                                                   AS indian_score,
      -- Fast path: synastry_cache; slow path: compute live
      COALESCE(
        (SELECT sc.signal_score
         FROM public.synastry_cache sc
         WHERE sc.user_a_id = LEAST(input_user_id, c.cand_id)
           AND sc.user_b_id = GREATEST(input_user_id, c.cand_id)),
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
    -- 85% astro+personality, 15% behavioural signal (signal capped at 15 pts)
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

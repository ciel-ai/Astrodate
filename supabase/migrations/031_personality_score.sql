-- Called directly by get_final_matches RPC. Not exposed via Edge Function.
CREATE OR REPLACE FUNCTION public.compute_personality_score(user_a UUID, user_b UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  a1 RECORD; b1 RECORD;
  ap RECORD; bp RECORD;
  score NUMERIC := 0.0;
  factors INT := 0;
BEGIN
  SELECT * INTO a1 FROM public.section1_qns WHERE user_id = user_a;
  SELECT * INTO b1 FROM public.section1_qns WHERE user_id = user_b;
  SELECT * INTO ap FROM public.personality_qns WHERE user_id = user_a;
  SELECT * INTO bp FROM public.personality_qns WHERE user_id = user_b;

  -- If either has no data, return neutral
  IF a1 IS NULL OR b1 IS NULL THEN RETURN 0.5; END IF;

  -- 1. introvert_extrovert match (same = 0.6, different = 0.8 — opposites complement)
  IF a1.introvert_extrovert IS NOT NULL AND b1.introvert_extrovert IS NOT NULL THEN
    IF a1.introvert_extrovert = b1.introvert_extrovert THEN score := score + 0.6;
    ELSE score := score + 0.8; END IF;
    factors := factors + 1;
  END IF;

  -- 2. Shared hobbies overlap (score by overlap count / max possible)
  IF a1.hobbies IS NOT NULL AND b1.hobbies IS NOT NULL
     AND array_length(a1.hobbies, 1) > 0 AND array_length(b1.hobbies, 1) > 0 THEN
    DECLARE
      overlap INT := (SELECT COUNT(*) FROM unnest(a1.hobbies) h WHERE h = ANY(b1.hobbies));
      max_len INT := GREATEST(array_length(a1.hobbies, 1), array_length(b1.hobbies, 1));
    BEGIN
      score := score + LEAST(0.5 + (overlap::NUMERIC / max_len::NUMERIC * 0.5), 1.0);
      factors := factors + 1;
    END;
  END IF;

  -- 3. looking_for alignment (both want same thing = 0.9, different = 0.4)
  IF a1.looking_for IS NOT NULL AND b1.looking_for IS NOT NULL THEN
    IF a1.looking_for = b1.looking_for THEN score := score + 0.9;
    ELSE score := score + 0.4; END IF;
    factors := factors + 1;
  END IF;

  -- 4. Personality trait: planning_style (same = 0.7, different = 0.5)
  IF ap IS NOT NULL AND bp IS NOT NULL THEN
    IF ap.what_best_describes_your_planning_style IS NOT NULL
       AND bp.what_best_describes_your_planning_style IS NOT NULL THEN
      IF ap.what_best_describes_your_planning_style = bp.what_best_describes_your_planning_style
        THEN score := score + 0.7;
      ELSE score := score + 0.5; END IF;
      factors := factors + 1;
    END IF;
    -- 5. Relationship dynamic: how_do_you_show_care_in_a_relationship
    IF ap.how_do_you_show_care_in_a_relationship IS NOT NULL
       AND bp.how_do_you_show_care_in_a_relationship IS NOT NULL THEN
      IF ap.how_do_you_show_care_in_a_relationship = bp.how_do_you_show_care_in_a_relationship
        THEN score := score + 0.8;
      ELSE score := score + 0.55; END IF;
      factors := factors + 1;
    END IF;
  END IF;

  IF factors = 0 THEN RETURN 0.5; END IF;
  RETURN ROUND((score / factors::NUMERIC)::NUMERIC, 4);
END;
$$;

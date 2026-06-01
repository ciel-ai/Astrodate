CREATE OR REPLACE FUNCTION public.compute_astro_score(user_a UUID, user_b UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  SELECT * INTO a_row FROM get_astro_for_ranking(user_a);
  SELECT * INTO b_row FROM get_astro_for_ranking(user_b);
  IF a_row IS NULL OR b_row IS NULL THEN RETURN 0.5; END IF;
  -- Sun sign compatibility (weight 30%)
  sun_score := get_western_sign_score(a_row.western_sign, b_row.western_sign);
  -- Venus sign cross-compatibility: A venus vs B sun, B venus vs A sun (weight 30%)
  -- Venus shows what you're attracted to; Sun shows who you are
  venus_score := (
    get_western_sign_score(a_row.venus_sign, b_row.western_sign) +
    get_western_sign_score(b_row.venus_sign, a_row.western_sign)
  ) / 2.0;
  -- Mars sign compatibility (weight 20%)
  mars_score := get_western_sign_score(a_row.mars_sign, b_row.mars_sign);
  -- Nakshatra compatibility (weight 20%)
  nakshatra_score := get_nakshatra_score(a_row.nakshatra_name, b_row.nakshatra_name);
  -- Dominant element match bonus
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

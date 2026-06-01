CREATE OR REPLACE FUNCTION public.get_western_sign_score(sign_a TEXT, sign_b TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  element_a TEXT;
  element_b TEXT;
  modality_a TEXT;
  modality_b TEXT;
  score NUMERIC := 0.5;
BEGIN
  -- Map sign to element
  element_a := CASE lower(sign_a)
    WHEN 'aries' THEN 'fire' WHEN 'leo' THEN 'fire' WHEN 'sagittarius' THEN 'fire'
    WHEN 'taurus' THEN 'earth' WHEN 'virgo' THEN 'earth' WHEN 'capricorn' THEN 'earth'
    WHEN 'gemini' THEN 'air' WHEN 'libra' THEN 'air' WHEN 'aquarius' THEN 'air'
    WHEN 'cancer' THEN 'water' WHEN 'scorpio' THEN 'water' WHEN 'pisces' THEN 'water'
    ELSE NULL END;
  element_b := CASE lower(sign_b)
    WHEN 'aries' THEN 'fire' WHEN 'leo' THEN 'fire' WHEN 'sagittarius' THEN 'fire'
    WHEN 'taurus' THEN 'earth' WHEN 'virgo' THEN 'earth' WHEN 'capricorn' THEN 'earth'
    WHEN 'gemini' THEN 'air' WHEN 'libra' THEN 'air' WHEN 'aquarius' THEN 'air'
    WHEN 'cancer' THEN 'water' WHEN 'scorpio' THEN 'water' WHEN 'pisces' THEN 'water'
    ELSE NULL END;
  -- Map sign to modality
  modality_a := CASE lower(sign_a)
    WHEN 'aries' THEN 'cardinal' WHEN 'cancer' THEN 'cardinal' WHEN 'libra' THEN 'cardinal' WHEN 'capricorn' THEN 'cardinal'
    WHEN 'taurus' THEN 'fixed' WHEN 'leo' THEN 'fixed' WHEN 'scorpio' THEN 'fixed' WHEN 'aquarius' THEN 'fixed'
    WHEN 'gemini' THEN 'mutable' WHEN 'virgo' THEN 'mutable' WHEN 'sagittarius' THEN 'mutable' WHEN 'pisces' THEN 'mutable'
    ELSE NULL END;
  modality_b := CASE lower(sign_b)
    WHEN 'aries' THEN 'cardinal' WHEN 'cancer' THEN 'cardinal' WHEN 'libra' THEN 'cardinal' WHEN 'capricorn' THEN 'cardinal'
    WHEN 'taurus' THEN 'fixed' WHEN 'leo' THEN 'fixed' WHEN 'scorpio' THEN 'fixed' WHEN 'aquarius' THEN 'fixed'
    WHEN 'gemini' THEN 'mutable' WHEN 'virgo' THEN 'mutable' WHEN 'sagittarius' THEN 'mutable' WHEN 'pisces' THEN 'mutable'
    ELSE NULL END;
  IF element_a IS NULL OR element_b IS NULL THEN RETURN 0.5; END IF;
  -- Same sign: very high
  IF lower(sign_a) = lower(sign_b) THEN RETURN 0.85; END IF;
  -- Element compatibility
  IF element_a = element_b THEN score := 0.80;
  ELSIF (element_a = 'fire' AND element_b = 'air') OR (element_a = 'air' AND element_b = 'fire') THEN score := 0.75;
  ELSIF (element_a = 'earth' AND element_b = 'water') OR (element_a = 'water' AND element_b = 'earth') THEN score := 0.75;
  ELSIF (element_a = 'fire' AND element_b = 'earth') OR (element_a = 'earth' AND element_b = 'fire') THEN score := 0.40;
  ELSIF (element_a = 'fire' AND element_b = 'water') OR (element_a = 'water' AND element_b = 'fire') THEN score := 0.35;
  ELSIF (element_a = 'air' AND element_b = 'water') OR (element_a = 'water' AND element_b = 'air') THEN score := 0.45;
  ELSIF (element_a = 'earth' AND element_b = 'air') OR (element_a = 'air' AND element_b = 'earth') THEN score := 0.45;
  ELSE score := 0.50; END IF;
  -- Modality bonus
  IF modality_a IS NOT NULL AND modality_b IS NOT NULL THEN
    IF modality_a = modality_b THEN score := score + 0.05;
    ELSIF (modality_a = 'cardinal' AND modality_b = 'mutable') OR (modality_a = 'mutable' AND modality_b = 'cardinal') THEN score := score + 0.05;
    END IF;
  END IF;
  RETURN LEAST(score, 1.0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_nakshatra_score(nak_a TEXT, nak_b TEXT)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  group_a INT;
  group_b INT;
BEGIN
  IF nak_a IS NULL OR nak_b IS NULL THEN RETURN 0.5; END IF;
  IF lower(nak_a) = lower(nak_b) THEN RETURN 0.90; END IF;
  
  group_a := CASE lower(nak_a)
    WHEN 'ashwini' THEN 1 WHEN 'magha' THEN 1 WHEN 'mula' THEN 1
    WHEN 'bharani' THEN 2 WHEN 'purva phalguni' THEN 2 WHEN 'purva ashadha' THEN 2
    WHEN 'krittika' THEN 3 WHEN 'uttara phalguni' THEN 3 WHEN 'uttara ashadha' THEN 3
    WHEN 'rohini' THEN 4 WHEN 'hasta' THEN 4 WHEN 'shravana' THEN 4
    WHEN 'mrigashira' THEN 5 WHEN 'chitra' THEN 5 WHEN 'dhanishtha' THEN 5
    WHEN 'ardra' THEN 6 WHEN 'swati' THEN 6 WHEN 'shatabhisha' THEN 6
    WHEN 'punarvasu' THEN 7 WHEN 'vishakha' THEN 7 WHEN 'purva bhadrapada' THEN 7
    WHEN 'pushya' THEN 8 WHEN 'anuradha' THEN 8 WHEN 'uttara bhadrapada' THEN 8
    WHEN 'ashlesha' THEN 9 WHEN 'jyeshtha' THEN 9 WHEN 'revati' THEN 9
    ELSE 0 END;
    
  group_b := CASE lower(nak_b)
    WHEN 'ashwini' THEN 1 WHEN 'magha' THEN 1 WHEN 'mula' THEN 1
    WHEN 'bharani' THEN 2 WHEN 'purva phalguni' THEN 2 WHEN 'purva ashadha' THEN 2
    WHEN 'krittika' THEN 3 WHEN 'uttara phalguni' THEN 3 WHEN 'uttara ashadha' THEN 3
    WHEN 'rohini' THEN 4 WHEN 'hasta' THEN 4 WHEN 'shravana' THEN 4
    WHEN 'mrigashira' THEN 5 WHEN 'chitra' THEN 5 WHEN 'dhanishtha' THEN 5
    WHEN 'ardra' THEN 6 WHEN 'swati' THEN 6 WHEN 'shatabhisha' THEN 6
    WHEN 'punarvasu' THEN 7 WHEN 'vishakha' THEN 7 WHEN 'purva bhadrapada' THEN 7
    WHEN 'pushya' THEN 8 WHEN 'anuradha' THEN 8 WHEN 'uttara bhadrapada' THEN 8
    WHEN 'ashlesha' THEN 9 WHEN 'jyeshtha' THEN 9 WHEN 'revati' THEN 9
    ELSE 0 END;
    
  IF group_a = 0 OR group_b = 0 THEN RETURN 0.5; END IF;
  IF group_a = group_b THEN RETURN 0.75; END IF;
  RETURN 0.45;
END;
$$;

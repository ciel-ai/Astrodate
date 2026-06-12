CREATE TABLE IF NOT EXISTS public.western_zodiac_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sign_a text,
  sign_b text,
  compatibility_score numeric,
  description text
);

CREATE TABLE IF NOT EXISTS public."Indian_zodiac_match_scores" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nakshatra_a text,
  nakshatra_b text,
  match_score numeric,
  description text
);

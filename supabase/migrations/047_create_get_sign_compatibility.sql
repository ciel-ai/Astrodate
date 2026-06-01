-- Migration 047: Implement get_sign_compatibility
-- Adds a deterministic, symmetric, and production-safe function
-- that maps zodiac signs to elemental groups and returns a
-- compatibility score between 0.00 and 10.00.

BEGIN;

-- CREATE/REPLACE the compatibility function expected by migration 044
-- Signature: get_sign_compatibility(sign_a TEXT, sign_b TEXT) RETURNS NUMERIC
-- Behavior:
--  - Deterministic and symmetric (compatibility(a,b) == compatibility(b,a))
--  - Returns NULL for unknown or missing inputs so callers can COALESCE
--  - Score range: 0.00 .. 10.00
--  - Same sign -> 10.00
--  - Same element -> 8.00
--  - Fire <-> Air and Earth <-> Water -> 6.00 (traditionally complementary)
--  - Otherwise -> 2.00 (contrast but potentially interesting)
--  - Designed as a safe MVP; easy to extend later.

CREATE OR REPLACE FUNCTION public.get_sign_compatibility(sign_a TEXT, sign_b TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  a TEXT := lower(coalesce(sign_a, ''));
  b TEXT := lower(coalesce(sign_b, ''));
  elem_a TEXT;
  elem_b TEXT;
  score NUMERIC := NULL;
BEGIN
  -- Return NULL when either sign missing or empty
  IF a = '' OR b = '' THEN
    RETURN NULL;
  END IF;

  -- Normalise common sign names (accepts variants like 'aries', 'Aries', 'ARIES')
  -- Western & Indian names may be similar; unknown names result in NULL.
  CASE a
    WHEN 'aries' THEN elem_a := 'fire';
    WHEN 'leo' THEN elem_a := 'fire';
    WHEN 'sagittarius' THEN elem_a := 'fire';

    WHEN 'taurus' THEN elem_a := 'earth';
    WHEN 'virgo' THEN elem_a := 'earth';
    WHEN 'capricorn' THEN elem_a := 'earth';

    WHEN 'gemini' THEN elem_a := 'air';
    WHEN 'libra' THEN elem_a := 'air';
    WHEN 'aquarius' THEN elem_a := 'air';

    WHEN 'cancer' THEN elem_a := 'water';
    WHEN 'scorpio' THEN elem_a := 'water';
    WHEN 'pisces' THEN elem_a := 'water';

    ELSE elem_a := NULL;
  END CASE;

  CASE b
    WHEN 'aries' THEN elem_b := 'fire';
    WHEN 'leo' THEN elem_b := 'fire';
    WHEN 'sagittarius' THEN elem_b := 'fire';

    WHEN 'taurus' THEN elem_b := 'earth';
    WHEN 'virgo' THEN elem_b := 'earth';
    WHEN 'capricorn' THEN elem_b := 'earth';

    WHEN 'gemini' THEN elem_b := 'air';
    WHEN 'libra' THEN elem_b := 'air';
    WHEN 'aquarius' THEN elem_b := 'air';

    WHEN 'cancer' THEN elem_b := 'water';
    WHEN 'scorpio' THEN elem_b := 'water';
    WHEN 'pisces' THEN elem_b := 'water';

    ELSE elem_b := NULL;
  END CASE;

  -- If either element is unknown, return NULL so callers can choose a default
  IF elem_a IS NULL OR elem_b IS NULL THEN
    RETURN NULL;
  END IF;

  -- Same sign exact match => highest score
  IF a = b THEN
    score := 10.00;

  -- Same element group => strong compatibility
  ELSIF elem_a = elem_b THEN
    score := 8.00;

  -- Complimentary pairs: Fire <-> Air, Earth <-> Water => good compatibility
  ELSIF (elem_a = 'fire' AND elem_b = 'air') OR (elem_a = 'air' AND elem_b = 'fire') THEN
    score := 6.00;
  ELSIF (elem_a = 'earth' AND elem_b = 'water') OR (elem_a = 'water' AND elem_b = 'earth') THEN
    score := 6.00;

  -- Otherwise, a moderate/low baseline score (contrasts)
  ELSE
    score := 2.00;
  END IF;

  RETURN score;
END;
$$;

COMMIT;

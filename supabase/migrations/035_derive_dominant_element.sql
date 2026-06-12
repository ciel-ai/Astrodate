CREATE OR REPLACE FUNCTION public.derive_dominant_element(
  sun TEXT, moon TEXT, venus TEXT, mars TEXT, mercury TEXT, rising TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  fire_count INT := 0; earth_count INT := 0;
  air_count INT := 0;  water_count INT := 0;
  signs TEXT[] := ARRAY[sun, moon, venus, mars, mercury, rising];
  s TEXT;
BEGIN
  FOREACH s IN ARRAY signs LOOP
    IF s IS NULL THEN CONTINUE; END IF;
    CASE lower(s)
      WHEN 'aries' THEN fire_count := fire_count + 1;
      WHEN 'leo' THEN fire_count := fire_count + 1;
      WHEN 'sagittarius' THEN fire_count := fire_count + 1;
      WHEN 'taurus' THEN earth_count := earth_count + 1;
      WHEN 'virgo' THEN earth_count := earth_count + 1;
      WHEN 'capricorn' THEN earth_count := earth_count + 1;
      WHEN 'gemini' THEN air_count := air_count + 1;
      WHEN 'libra' THEN air_count := air_count + 1;
      WHEN 'aquarius' THEN air_count := air_count + 1;
      WHEN 'cancer' THEN water_count := water_count + 1;
      WHEN 'scorpio' THEN water_count := water_count + 1;
      WHEN 'pisces' THEN water_count := water_count + 1;
      ELSE NULL;
    END CASE;
  END LOOP;
  RETURN (SELECT val FROM (VALUES
    ('fire', fire_count), ('earth', earth_count),
    ('air', air_count), ('water', water_count)
  ) AS t(val, cnt) ORDER BY cnt DESC LIMIT 1);
END; $$;

UPDATE public.astro_details
SET dominant_element = public.derive_dominant_element(
  western_sign, indian_sign, venus_sign, mars_sign, mercury_sign, rising_sign
)
WHERE dominant_element IS NULL
  AND (western_sign IS NOT NULL OR venus_sign IS NOT NULL);

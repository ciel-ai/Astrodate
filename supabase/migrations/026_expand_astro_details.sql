ALTER TABLE public.astro_details
  ADD COLUMN IF NOT EXISTS venus_sign TEXT,
  ADD COLUMN IF NOT EXISTS mars_sign TEXT,
  ADD COLUMN IF NOT EXISTS mercury_sign TEXT,
  ADD COLUMN IF NOT EXISTS rising_sign TEXT,
  ADD COLUMN IF NOT EXISTS dominant_element TEXT,
  ADD COLUMN IF NOT EXISTS chart_json JSONB;

CREATE INDEX IF NOT EXISTS idx_astro_details_western_sign ON public.astro_details(western_sign);

CREATE OR REPLACE FUNCTION public.get_astro_for_ranking(p_user_id UUID)
RETURNS TABLE(
  western_sign TEXT, indian_sign TEXT, nakshatra_name TEXT,
  venus_sign TEXT, mars_sign TEXT, mercury_sign TEXT,
  rising_sign TEXT, dominant_element TEXT
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT western_sign, indian_sign, nakshatra_name, venus_sign, mars_sign,
         mercury_sign, rising_sign, dominant_element
  FROM public.astro_details WHERE user_id = p_user_id;
$$;

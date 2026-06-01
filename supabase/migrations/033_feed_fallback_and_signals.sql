-- 1. Create user_signals table (needed for Week 3 behavioural layer, create now)
CREATE TABLE IF NOT EXISTS public.user_signals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  likes_sent INT DEFAULT 0,
  super_likes_sent INT DEFAULT 0,
  messages_sent INT DEFAULT 0,
  activity_score NUMERIC DEFAULT 5.0,
  last_active TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own signals') THEN 
    CREATE POLICY "Users manage own signals" ON public.user_signals
      FOR ALL USING (auth.uid() = user_id);
  END IF; 
END $$;

-- 2. Create a SECURITY DEFINER fallback feed function
-- This is called by the frontend when get_final_matches returns empty (no astro data yet)
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
  ORDER BY up.updated_at DESC
  LIMIT 50;
$$;

-- 3. Synastry cache table (needed for Week 2 cache, Week 3 lookups)
CREATE TABLE IF NOT EXISTS public.synastry_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  astro_score NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);
ALTER TABLE public.synastry_cache ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users read synastry cache') THEN 
    CREATE POLICY "Authenticated users read synastry cache" ON public.synastry_cache
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF; 
END $$;

CREATE INDEX IF NOT EXISTS idx_synastry_cache_lookup ON public.synastry_cache(user_a_id, user_b_id);

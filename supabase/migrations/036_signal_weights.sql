-- DROP the old summary-style user_signals table (safe — no production data)
DROP TABLE IF EXISTS public.user_signals CASCADE;

-- Recreate as event log
CREATE TABLE public.user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_weight NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;
-- Users can only read their own signals (writes go through SECURITY DEFINER RPC)
CREATE POLICY "Users read own signals" ON public.user_signals
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_signals_pair ON public.user_signals(user_id, target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_created ON public.user_signals(created_at DESC);

-- Signal weight config table
CREATE TABLE IF NOT EXISTS public.signal_weight_config (
  signal_type TEXT PRIMARY KEY,
  base_weight NUMERIC NOT NULL,
  description TEXT
);
ALTER TABLE public.signal_weight_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read signal config" ON public.signal_weight_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed weights (INSERT, not UPSERT — table is fresh)
INSERT INTO public.signal_weight_config (signal_type, base_weight, description) VALUES
  ('view_profile',   0.5,  'User viewed a profile card'),
  ('view_long',      1.5,  'User viewed a profile for more than 5 seconds'),
  ('like',           3.0,  'User liked a profile'),
  ('super_like',     6.0,  'User super-liked a profile'),
  ('dislike',       -1.0,  'User disliked a profile'),
  ('message_sent',   5.0,  'User sent the first message'),
  ('message_replied',4.0,  'User replied to a message in session');

CREATE TABLE IF NOT EXISTS public.daily_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  picked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  astro_score NUMERIC,
  pick_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, pick_date)
);
ALTER TABLE public.daily_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own daily picks"
  ON public.daily_picks FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_daily_picks_user_date ON public.daily_picks(user_id, pick_date DESC);

-- Also add like icebreaker note column to user_likes
ALTER TABLE public.user_likes
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS photo_index INT;
-- note: 150 char max enforced at app layer

-- Also add shooting_star_log for quota tracking history
CREATE TABLE IF NOT EXISTS public.shooting_star_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.shooting_star_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shooting stars"
  ON public.shooting_star_log FOR ALL USING (auth.uid() = user_id);

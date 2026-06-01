CREATE TABLE IF NOT EXISTS public.user_online_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_online_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read online status"
  ON public.user_online_status FOR SELECT
  USING (true);

CREATE POLICY "Users can update own status"
  ON public.user_online_status FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

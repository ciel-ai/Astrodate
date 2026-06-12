CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users,
  receiver_id uuid REFERENCES auth.users,
  message_text text,
  is_read boolean DEFAULT false,
  channel_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own messages"
  ON public.messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users,
  reported_user_id uuid REFERENCES auth.users,
  channel_id text,
  category text,
  subcategory text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS public.swipe_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id uuid REFERENCES auth.users,
  swiped_id uuid REFERENCES auth.users,
  action_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.swipe_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own swipe actions"
  ON public.swipe_actions
  FOR SELECT
  USING (auth.uid() = swiper_id);

CREATE POLICY "Users can insert their own swipe actions"
  ON public.swipe_actions
  FOR INSERT
  WITH CHECK (auth.uid() = swiper_id);

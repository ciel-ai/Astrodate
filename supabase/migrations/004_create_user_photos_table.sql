CREATE TABLE IF NOT EXISTS public.user_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  photo_url text NOT NULL,
  display_order int DEFAULT 0 CHECK (display_order >= 0 AND display_order < 6),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own photos"
  ON public.user_photos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

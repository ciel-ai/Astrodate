DROP POLICY IF EXISTS "Anyone can check phone number existence" ON public.user_profiles;

CREATE POLICY "Authenticated users can read public profile fields"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

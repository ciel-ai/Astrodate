-- Add public policy to allow checking if phone number exists without authentication
-- This is needed for signup and login verification before user is authenticated

CREATE POLICY "Anyone can check phone number existence"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Migration 088: Allow authenticated users to view profile fields
-- This is necessary to show matches' hobbies, looking for, relationship status, and bio in the feed/details.

BEGIN;

DROP POLICY IF EXISTS "Allow logged-in read section1 responses" ON public.section1_qns;
CREATE POLICY "Allow logged-in read section1 responses"
  ON public.section1_qns
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow logged-in read onboarding responses" ON public.onboarding_responses;
CREATE POLICY "Allow logged-in read onboarding responses"
  ON public.onboarding_responses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

COMMIT;

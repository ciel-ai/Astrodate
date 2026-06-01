-- Migration 049: Harden RLS for public.section1_qns
-- Purpose: Ensure only owners (auth.uid() = user_id) can SELECT/INSERT/UPDATE/DELETE their questionnaire rows.

BEGIN;

-- Drop existing permissive policies if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'section1_qns'
      AND p.policyname = 'Users can read their own section1 responses'
  ) THEN
    EXECUTE 'ALTER TABLE public.section1_qns DROP POLICY "Users can read their own section1 responses"';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'section1_qns'
      AND p.policyname = 'Users can insert their own section1 responses'
  ) THEN
    EXECUTE 'ALTER TABLE public.section1_qns DROP POLICY "Users can insert their own section1 responses"';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'section1_qns'
      AND p.policyname = 'Users can update their own section1 responses'
  ) THEN
    EXECUTE 'ALTER TABLE public.section1_qns DROP POLICY "Users can update their own section1 responses"';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'section1_qns'
      AND p.policyname = 'Users can delete their own section1 responses'
  ) THEN
    EXECUTE 'ALTER TABLE public.section1_qns DROP POLICY "Users can delete their own section1 responses"';
  END IF;
END$$;

-- Create strict ownership-based policies
CREATE POLICY "Users can read own section1 responses"
  ON public.section1_qns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own section1 responses"
  ON public.section1_qns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own section1 responses"
  ON public.section1_qns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own section1 responses"
  ON public.section1_qns
  FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;

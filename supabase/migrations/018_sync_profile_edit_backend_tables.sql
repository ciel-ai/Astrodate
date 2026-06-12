-- Sync backend tables with profile edit flow used by app/(tabs)/profile.tsx
-- Safe to run multiple times.

-- Needed for personality_vector column type.
CREATE EXTENSION IF NOT EXISTS vector;

-- Keep user_profiles aligned with the app schema.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'Free',
  ADD COLUMN IF NOT EXISTS personality_vector public.vector,
  ADD COLUMN IF NOT EXISTS sexual_orientation TEXT;

-- Create onboarding_responses if it does not exist.
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  about_me TEXT,
  languages TEXT[] DEFAULT '{}',
  education TEXT,
  drinking TEXT,
  smoking TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- If table already exists but columns are missing, add them.
ALTER TABLE public.onboarding_responses
  ADD COLUMN IF NOT EXISTS about_me TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS drinking TEXT,
  ADD COLUMN IF NOT EXISTS smoking TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Index for fast lookups from profile screen.
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user_id
  ON public.onboarding_responses(user_id);

-- Enable RLS.
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Policies (created only if missing).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_responses'
      AND policyname = 'Users can read their own onboarding responses'
  ) THEN
    CREATE POLICY "Users can read their own onboarding responses"
      ON public.onboarding_responses
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_responses'
      AND policyname = 'Users can insert their own onboarding responses'
  ) THEN
    CREATE POLICY "Users can insert their own onboarding responses"
      ON public.onboarding_responses
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_responses'
      AND policyname = 'Users can update their own onboarding responses'
  ) THEN
    CREATE POLICY "Users can update their own onboarding responses"
      ON public.onboarding_responses
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'onboarding_responses'
      AND policyname = 'Users can delete their own onboarding responses'
  ) THEN
    CREATE POLICY "Users can delete their own onboarding responses"
      ON public.onboarding_responses
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMENT ON TABLE public.onboarding_responses IS 'Stores editable profile fields not in user_profiles/section1_qns (bio, languages, education, drinking, smoking).';

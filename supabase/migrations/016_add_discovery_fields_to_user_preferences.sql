-- Store all Discovery Preferences page fields in user_preferences
-- Safe to run multiple times.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS gender_preference text,
  ADD COLUMN IF NOT EXISTS sexual_orientation text;

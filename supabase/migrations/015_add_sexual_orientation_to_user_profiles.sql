-- Add sexual_orientation column to user_profiles for discovery preferences
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS sexual_orientation TEXT;

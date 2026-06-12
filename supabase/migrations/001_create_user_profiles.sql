-- Create user_profiles table to store user details from onboarding
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  gender TEXT,
  gender_detail TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can read their own profile
CREATE POLICY "Users can read their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy: users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: users can delete their own profile
CREATE POLICY "Users can delete their own profile"
  ON public.user_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create public policy: anyone can check if phone number exists (for signup/login verification)
CREATE POLICY "Anyone can check phone number existence"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Create index on phone_number for faster lookups
CREATE INDEX idx_user_profiles_phone ON public.user_profiles(phone_number);

-- Add comment to table
COMMENT ON TABLE public.user_profiles IS 'Stores user profile information from onboarding flow';

-- Create user_matches table to store mutual likes (matches) with channel IDs
CREATE TABLE IF NOT EXISTS public.user_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure a unique match between two users (order doesn't matter)
  -- Using a check constraint to ensure user1_id < user2_id for consistency
  CONSTRAINT user_matches_users_check CHECK (user1_id < user2_id),
  CONSTRAINT user_matches_unique UNIQUE (user1_id, user2_id)
);

-- Create index on user1_id for faster lookups
CREATE INDEX idx_user_matches_user1 ON public.user_matches(user1_id);

-- Create index on user2_id for faster lookups
CREATE INDEX idx_user_matches_user2 ON public.user_matches(user2_id);

-- Create index on channel_id for faster lookups
CREATE INDEX idx_user_matches_channel ON public.user_matches(channel_id);

-- Create composite index for finding matches for a user
CREATE INDEX idx_user_matches_user_lookup ON public.user_matches(user1_id, user2_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_matches ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own matches (where they are user1 or user2)
CREATE POLICY "Users can view own matches"
  ON public.user_matches
  FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Policy 2: Users can insert matches (system will handle this)
CREATE POLICY "Users can insert own matches"
  ON public.user_matches
  FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Policy 3: Users can update their own matches
CREATE POLICY "Users can update own matches"
  ON public.user_matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Add comment to table
COMMENT ON TABLE public.user_matches IS 'Stores mutual likes (matches) between users with unique channel IDs for messaging';

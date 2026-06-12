-- Create user_likes table to store user likes, dislikes, and super likes
CREATE TABLE IF NOT EXISTS public.user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'dislike', 'super_like')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure a user can only have one action per other user (prevent duplicates)
  UNIQUE(user_id, liked_user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_likes_user_id ON public.user_likes(user_id);

-- Create index on liked_user_id for faster lookups (to find who liked you)
CREATE INDEX idx_user_likes_liked_user_id ON public.user_likes(liked_user_id);

-- Create index on action_type for filtering
CREATE INDEX idx_user_likes_action_type ON public.user_likes(action_type);

-- Create composite index for checking mutual likes
CREATE INDEX idx_user_likes_user_liked ON public.user_likes(user_id, liked_user_id, action_type);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own likes/dislikes
CREATE POLICY "Users can view own likes"
  ON public.user_likes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can view who liked them (for matches)
CREATE POLICY "Users can view who liked them"
  ON public.user_likes
  FOR SELECT
  USING (auth.uid() = liked_user_id);

-- Policy 3: Users can insert their own likes/dislikes
CREATE POLICY "Users can insert own likes"
  ON public.user_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can update their own likes/dislikes (e.g., change dislike to like)
CREATE POLICY "Users can update own likes"
  ON public.user_likes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy 5: Users can delete their own likes/dislikes
CREATE POLICY "Users can delete own likes"
  ON public.user_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE public.user_likes IS 'Stores user likes, dislikes, and super likes for matching functionality';

-- Create user_prompts table to store Hinge-style prompt questions and answers
CREATE TABLE IF NOT EXISTS public.user_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL, -- 'prompt_1', 'prompt_2', 'prompt_3'
  question VARCHAR(100) NOT NULL,
  answer VARCHAR(300) NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure user only has one entry per prompt slot
  UNIQUE(user_id, prompt_id)
);

-- Enable Row Level Security (RLS) on user_prompts
ALTER TABLE public.user_prompts ENABLE ROW LEVEL SECURITY;

-- Select policy: Authenticated users can read prompts of others to display in the Discover feed
CREATE POLICY "Authenticated users can view prompts"
  ON public.user_prompts
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert policy: Users can only add their own prompts
CREATE POLICY "Users can insert own prompts"
  ON public.user_prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update policy: Users can only edit their own prompts
CREATE POLICY "Users can update own prompts"
  ON public.user_prompts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Delete policy: Users can delete their own prompts
CREATE POLICY "Users can delete own prompts"
  ON public.user_prompts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add performance index for user prompts lookup
CREATE INDEX IF NOT EXISTS idx_user_prompts_user_id ON public.user_prompts(user_id);

-- Modify user_likes table to support targeted likes on prompts with optional comments
ALTER TABLE public.user_likes
  ADD COLUMN IF NOT EXISTS prompt_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON TABLE public.user_prompts IS 'Stores Hinge-style prompts (questions and answers) for dating profiles';
COMMENT ON COLUMN public.user_likes.prompt_id IS 'Identifies the specific prompt ID that was liked, if any';
COMMENT ON COLUMN public.user_likes.comment IS 'Optional comment text sent alongside the profile/prompt like';

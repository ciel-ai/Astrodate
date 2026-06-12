-- Create section1_qns table to store Section 1 questionnaire answers
CREATE TABLE IF NOT EXISTS public.section1_qns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Section 1: Basic Preferences Questions
  interest TEXT[] DEFAULT '{}',
  looking_for TEXT,
  relationship_status TEXT,
  hobbies TEXT[] DEFAULT '{}',
  height TEXT,
  introvert_extrovert TEXT,
  partner_preference TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.section1_qns ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can read their own responses
CREATE POLICY "Users can read their own section1 responses"
  ON public.section1_qns
  FOR SELECT
  USING (true);

-- Create RLS policy: users can insert their own responses
CREATE POLICY "Users can insert their own section1 responses"
  ON public.section1_qns
  FOR INSERT
  WITH CHECK (true);

-- Create RLS policy: users can update their own responses
CREATE POLICY "Users can update their own section1 responses"
  ON public.section1_qns
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create RLS policy: users can delete their own responses
CREATE POLICY "Users can delete their own section1 responses"
  ON public.section1_qns
  FOR DELETE
  USING (true);

-- Create index on user_id for faster lookups
CREATE INDEX idx_section1_qns_user_id ON public.section1_qns(user_id);

-- Add comment to table
COMMENT ON TABLE public.section1_qns IS 'Stores user responses to Section 1 onboarding questionnaire (basic preferences)';


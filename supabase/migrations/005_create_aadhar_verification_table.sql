-- Create aadhar_verification table to store Aadhar number and verification status
CREATE TABLE IF NOT EXISTS public.aadhar_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Aadhar Details
  aadhar_number VARCHAR(12) NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.aadhar_verification ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can read their own aadhar verification
CREATE POLICY "Users can read their own aadhar verification"
  ON public.aadhar_verification
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy: users can insert their own aadhar verification
CREATE POLICY "Users can insert their own aadhar verification"
  ON public.aadhar_verification
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: users can update their own aadhar verification
CREATE POLICY "Users can update their own aadhar verification"
  ON public.aadhar_verification
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: users can delete their own aadhar verification
CREATE POLICY "Users can delete their own aadhar verification"
  ON public.aadhar_verification
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX idx_aadhar_verification_user_id ON public.aadhar_verification(user_id);

-- Add comment to table
COMMENT ON TABLE public.aadhar_verification IS 'Stores user Aadhar number and verification status';

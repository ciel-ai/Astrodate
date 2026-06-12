-- Create astro_details table to store birth details and astrological signs
CREATE TABLE IF NOT EXISTS public.astro_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Birth Details
  birth_date DATE NOT NULL,
  birth_time TIME NOT NULL,
  birth_location TEXT NOT NULL,
  birth_latitude DECIMAL(10, 8),
  birth_longitude DECIMAL(11, 8),
  
  -- Western Astrology
  western_sign TEXT,
  
  -- Indian/Vedic Astrology
  indian_sign TEXT,
  
  -- Nakshatra Details
  nakshatra_name TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.astro_details ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can read their own astro details
CREATE POLICY "Users can read their own astro details"
  ON public.astro_details
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy: users can insert their own astro details
CREATE POLICY "Users can insert their own astro details"
  ON public.astro_details
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: users can update their own astro details
CREATE POLICY "Users can update their own astro details"
  ON public.astro_details
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: users can delete their own astro details
CREATE POLICY "Users can delete their own astro details"
  ON public.astro_details
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX idx_astro_details_user_id ON public.astro_details(user_id);

-- Add comment to table
COMMENT ON TABLE public.astro_details IS 'Stores birth details and astrological signs (Western, Indian, and Nakshatra)';


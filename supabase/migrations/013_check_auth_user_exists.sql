-- Create RPC function to check if a phone number exists in auth.users table
-- This function has SECURITY DEFINER to access auth.users table
-- Handles phone numbers with or without + prefix (auth.users stores without +)
CREATE OR REPLACE FUNCTION public.check_auth_user_exists(input_phone TEXT)
RETURNS TABLE(
  user_id UUID,
  phone TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_phone TEXT;
BEGIN
  -- Normalize phone number: remove + prefix if present
  -- auth.users stores phone numbers without + prefix (e.g., 919080923457)
  normalized_phone := TRIM(LEADING '+' FROM input_phone);
  
  -- Check if phone number exists in auth.users table
  -- Try both with and without + prefix for compatibility
  RETURN QUERY
  SELECT 
    au.id AS user_id,
    au.phone AS phone,
    au.created_at
  FROM auth.users au
  WHERE au.phone = normalized_phone OR au.phone = input_phone
  LIMIT 1;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.check_auth_user_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_auth_user_exists(TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.check_auth_user_exists IS 'Checks if a phone number exists in auth.users table. Returns user_id, phone, and created_at if found.';

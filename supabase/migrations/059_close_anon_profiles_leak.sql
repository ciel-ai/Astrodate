-- Step 1: Make check_auth_user_exists the mandatory path by ensuring it exists
-- (already created in earlier migration — defensive check only)

-- Step 2: Drop the anon read policy added in 057
DROP POLICY IF EXISTS "Unauthenticated phone existence check" ON public.user_profiles;

-- Active SELECT policies after this migration:
-- "Users can read their own profile" USING (auth.uid() = user_id) -- own row only
-- All cross-user reads go through SECURITY DEFINER RPCs

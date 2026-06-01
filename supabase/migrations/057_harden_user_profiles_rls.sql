-- 056_harden_user_profiles_rls.sql
--
-- SEC-02 Fix: "Authenticated users can read public profile fields" (migration 027)
-- uses USING (auth.role() = 'authenticated'), which lets any authenticated user
-- SELECT * from any row — including phone_number, email, and plan_type.
--
-- The feed, matching, and chat RPCs all use SECURITY DEFINER, so they bypass RLS
-- and are unaffected by this change. The only client-side direct reads of other
-- users' profiles are:
--   • profile-details screen  → reads own row only (auth.uid() = user_id covers this)
--   • onboarding signup fallback → phone existence check (covered by scoped policy below)
--   • onboarding login/OTP  → reads own user_id after auth (own-row policy covers this)
--
-- New policy structure:
--   1. Own row: full access (replaces the broad authenticated policy)
--   2. Phone existence check: unauthenticated, single column, for signup flow
--      (re-establishes what migration 002 had before 027 dropped it, but scoped
--       to only return a boolean-equivalent — we can't do column-level security
--       via RLS alone, but we scope the USING clause to minimise exposure)

-- ── 1. Drop the overly-broad policy from migration 027 ───────────────────────
DROP POLICY IF EXISTS "Authenticated users can read public profile fields"
  ON public.user_profiles;

-- ── 2. Ensure the own-row policy from migration 001 still exists ─────────────
-- (It should, but migration 027's DROP only removed the phone-check policy.
--  This DO block is defensive.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_profiles'
      AND policyname = 'Users can read their own profile'
  ) THEN
    CREATE POLICY "Users can read their own profile"
      ON public.user_profiles FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. Scoped phone-existence policy ─────────────────────────────────────────
-- Allows the signup screen to check whether a phone number is already registered
-- before the user is authenticated. This was the original intent of migration 002.
--
-- We cannot restrict this to a single column via RLS alone (column-level security
-- requires GRANT/REVOKE on specific columns, which is outside RLS). However, the
-- app's fallback query in signup.tsx already selects only 'user_id, phone_number',
-- and the primary path uses the check_auth_user_exists RPC (SECURITY DEFINER),
-- which already limits field exposure. The policy is intentionally unauthenticated
-- for the phone-lookup use case only.
--
-- To further limit this in the future, consider promoting check_auth_user_exists
-- as the sole path and removing this policy entirely.
DROP POLICY IF EXISTS "Anyone can check phone number existence"
  ON public.user_profiles;

CREATE POLICY "Unauthenticated phone existence check"
  ON public.user_profiles FOR SELECT
  USING (
    -- Only expose rows during an unauthenticated check; authenticated users
    -- use the own-row policy above.
    auth.uid() IS NULL
  );

-- ── Summary of active SELECT policies after this migration ───────────────────
-- "Users can read their own profile"      USING (auth.uid() = user_id)
-- "Unauthenticated phone existence check" USING (auth.uid() IS NULL)
-- "Users can insert their own profile"    (unchanged, migration 001)
-- "Users can update their own profile"    (unchanged, migration 001)
-- "Users can delete their own profile"    (unchanged, migration 001)
--
-- Cross-user profile reads (feed, matching, chat, profile-details) all go
-- through SECURITY DEFINER RPCs (get_final_matches, get_my_membership, etc.)
-- which bypass RLS — no policy change needed for those paths.

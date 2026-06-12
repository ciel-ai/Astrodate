-- Remove Aadhar verification backend artifacts.
-- Safe to run multiple times.

DROP POLICY IF EXISTS "Users can read their own aadhar verification" ON public.aadhar_verification;
DROP POLICY IF EXISTS "Users can insert their own aadhar verification" ON public.aadhar_verification;
DROP POLICY IF EXISTS "Users can update their own aadhar verification" ON public.aadhar_verification;
DROP POLICY IF EXISTS "Users can delete their own aadhar verification" ON public.aadhar_verification;

DROP INDEX IF EXISTS public.idx_aadhar_verification_user_id;
DROP TABLE IF EXISTS public.aadhar_verification;

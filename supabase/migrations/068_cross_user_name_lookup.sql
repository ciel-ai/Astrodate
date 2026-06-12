-- Migration: 068_cross_user_name_lookup.sql
--
-- Problem: With migration 057/059 correctly removing broad authenticated reads
-- of user_profiles, client-side direct reads of other users' full_name and
-- location now silently return empty (RLS blocks them).
--
-- Affected call sites:
--   • notifications.tsx: 3x .select('full_name').eq('user_id', otherId)
--   • likes.tsx: 2x .select('user_id, full_name, location').in('user_id', userIds)
--
-- Solution: Two SECURITY DEFINER RPCs that enforce relationship-based access:
--   1. get_user_display_name(target_user_id)   → single user name lookup
--   2. get_users_display_info(target_user_ids) → batch name+location lookup
--      (only returns users the caller is matched with OR who liked the caller)
--
-- These bypass RLS safely because the function itself enforces who can see what.

BEGIN;

-- ─── 1. Single user name lookup ───────────────────────────────────────────────
-- Used by notifications.tsx to show sender name.
-- Returns full_name only if:
--   a) target is the caller themselves, OR
--   b) a match exists between caller and target, OR
--   c) target liked the caller (so caller can see liker name in notification)

CREATE OR REPLACE FUNCTION public.get_user_display_name(
  p_target_user_id UUID
)
RETURNS TABLE(user_id UUID, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id, up.full_name
  FROM public.user_profiles up
  WHERE up.user_id = p_target_user_id
    AND (
      -- Own profile
      auth.uid() = up.user_id
      -- Matched users
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (um.user1_id = auth.uid() AND um.user2_id = up.user_id)
           OR (um.user1_id = up.user_id AND um.user2_id = auth.uid())
      )
      -- Users who liked the caller (needed for notification enrichment)
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = up.user_id
          AND ul.liked_user_id = auth.uid()
      )
      -- Users the caller liked (for sent-like enrichment)
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = auth.uid()
          AND ul.liked_user_id = up.user_id
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;

-- ─── 2. Batch name + location lookup ─────────────────────────────────────────
-- Used by likes.tsx to enrich liker cards with name and location.
-- Returns rows only for users the caller has a relationship with.

CREATE OR REPLACE FUNCTION public.get_users_display_info(
  p_target_user_ids UUID[]
)
RETURNS TABLE(user_id UUID, full_name TEXT, location TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id, up.full_name, up.location
  FROM public.user_profiles up
  WHERE up.user_id = ANY(p_target_user_ids)
    AND (
      -- Own profile
      auth.uid() = up.user_id
      -- Matched users
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (um.user1_id = auth.uid() AND um.user2_id = up.user_id)
           OR (um.user1_id = up.user_id AND um.user2_id = auth.uid())
      )
      -- Users who liked the caller
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = up.user_id
          AND ul.liked_user_id = auth.uid()
      )
      -- Users the caller liked
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = auth.uid()
          AND ul.liked_user_id = up.user_id
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_display_info(UUID[]) TO authenticated;

COMMIT;

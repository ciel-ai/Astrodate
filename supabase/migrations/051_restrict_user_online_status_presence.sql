-- Migration 051: Harden user_online_status privacy and add safe presence RPCs
BEGIN;

-- Remove the unsafe broad SELECT policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'user_online_status'
      AND p.policyname = 'Anyone can read online status'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_online_status DROP POLICY "Anyone can read online status"';
  END IF;
END$$;

-- Restrict SELECT to self or matched/active chat relationships only
CREATE POLICY "Users can read own or matched online status"
  ON public.user_online_status
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE (
        (um.user1_id = auth.uid() AND um.user2_id = user_id)
        OR (um.user1_id = user_id AND um.user2_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (
        (m.sender_id = auth.uid() AND m.receiver_id = user_id)
        OR (m.sender_id = user_id AND m.receiver_id = auth.uid())
      )
    )
  );

-- Create a secure RPC to fetch another user's presence if a match or message relationship exists
CREATE OR REPLACE FUNCTION public.get_user_presence(p_target_user_id UUID)
RETURNS TABLE(user_id UUID, is_online BOOLEAN, last_seen TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.user_id, u.is_online, u.last_seen
  FROM public.user_online_status u
  WHERE u.user_id = p_target_user_id
    AND (
      auth.uid() = u.user_id
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (
          (um.user1_id = auth.uid() AND um.user2_id = u.user_id)
          OR (um.user1_id = u.user_id AND um.user2_id = auth.uid())
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.messages m
        WHERE (
          (m.sender_id = auth.uid() AND m.receiver_id = u.user_id)
          OR (m.sender_id = u.user_id AND m.receiver_id = auth.uid())
        )
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_matched_user_presence(p_target_user_ids UUID[])
RETURNS TABLE(user_id UUID, is_online BOOLEAN, last_seen TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.user_id, u.is_online, u.last_seen
  FROM public.user_online_status u
  WHERE u.user_id = ANY(p_target_user_ids)
    AND (
      auth.uid() = u.user_id
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (
          (um.user1_id = auth.uid() AND um.user2_id = u.user_id)
          OR (um.user1_id = u.user_id AND um.user2_id = auth.uid())
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.messages m
        WHERE (
          (m.sender_id = auth.uid() AND m.receiver_id = u.user_id)
          OR (m.sender_id = u.user_id AND m.receiver_id = auth.uid())
        )
      )
    );
END;
$$;

COMMIT;

-- Restore-on-unblock support.
--
-- Previously block_user() deleted the match, so unblocking could not bring the
-- conversation back. Now block_user() only records the block and KEEPS the
-- match, so unblockUser() (which deletes the block row) restores the match and
-- its messages automatically.
--
-- While a block exists, the pair is hidden from:
--   • discovery / feed  — existing block filters in get_final_matches /
--                          get_fallback_feed (migration 077)
--   • the chats list     — client-side filter in lib/matches.ts (getAllMatches)
-- and crucially, messaging is still prevented by the updated INSERT policy
-- below, so keeping the match around does NOT weaken blocking (Apple 1.2 /
-- Google UGC compliance preserved).

-- 1. block_user: record the block, but DO NOT delete the match.
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.block_users (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  -- Match is intentionally preserved so it can be restored on unblock.
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

-- 2. Messages INSERT: keep the match requirement AND reject sends when a block
--    exists between the two users in EITHER direction.
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE um.channel_id = messages.channel_id
        AND ((um.user1_id = auth.uid() AND um.user2_id = receiver_id)
             OR (um.user1_id = receiver_id AND um.user2_id = auth.uid()))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.block_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = receiver_id)
         OR (b.blocker_id = receiver_id AND b.blocked_id = auth.uid())
    )
  );

-- Migration 048: Fix RLS policies on public.messages to prevent sender spoofing
-- Drop the old permissive INSERT policy and create strict INSERT/UPDATE/DELETE policies

BEGIN;

-- Drop old INSERT policy if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'messages' AND p.policyname = 'Users can insert their own messages'
  ) THEN
    EXECUTE 'ALTER TABLE public.messages DROP POLICY "Users can insert their own messages"';
  END IF;
END$$;

-- Ensure SELECT remains available to participants (keep existing behavior)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'messages' AND p.policyname = 'Users can view own messages'
  ) THEN
    -- If the original SELECT policy was removed accidentally, recreate it to preserve read access
    EXECUTE $$
      CREATE POLICY "Users can view own messages"
        ON public.messages
        FOR SELECT
        USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
    $$;
  END IF;
END$$;

-- Create a safe INSERT policy: only allow inserts where the authenticated user is the sender
-- and the message's channel belongs to an existing match between sender and receiver.
CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE um.channel_id = channel_id
        AND ((um.user1_id = auth.uid() AND um.user2_id = receiver_id)
             OR (um.user1_id = receiver_id AND um.user2_id = auth.uid()))
    )
  );

-- Allow receivers to mark messages as read (UPDATE). Restrict updates to rows where
-- the authenticated user is the receiver. This prevents clients from updating arbitrary rows.
CREATE POLICY "Users can update messages (receivers mark read)"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Allow participants (sender or receiver) to delete messages for their conversation.
CREATE POLICY "Users can delete their own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

COMMIT;

BEGIN;

-- Drop old INSERT policy if present
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

-- Drop conflicting policies that already exist on production with different names
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update received messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

-- Recreate SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename = 'messages' 
    AND policyname = 'Users can view own messages'
  ) THEN
    CREATE POLICY "Users can view own messages"
      ON public.messages
      FOR SELECT
      USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  END IF;
END$$;

-- Safe INSERT policy
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

-- Allow receivers to mark messages as read
CREATE POLICY "Users can update messages (receivers mark read)"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Allow participants to delete messages
CREATE POLICY "Users can delete their own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

COMMIT;
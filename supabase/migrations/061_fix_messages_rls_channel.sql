-- Fix: qualify channel_id reference to prevent tautology
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE um.channel_id = messages.channel_id  -- qualified: was resolving to um.channel_id = um.channel_id
        AND ((um.user1_id = auth.uid() AND um.user2_id = receiver_id)
             OR (um.user1_id = receiver_id AND um.user2_id = auth.uid()))
    )
  );

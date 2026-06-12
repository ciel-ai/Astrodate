-- Allow the service role (edge functions) to insert and update user_subscriptions.
-- The table already has RLS enabled with a SELECT policy for users.
-- Without this, the razorpay-link edge function cannot create the initial
-- 'incomplete' subscription row even when using the service_role key.

CREATE POLICY "Service role can insert subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

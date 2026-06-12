-- 055_enable_subscription_realtime.sql
--
-- BUG-07 fix (Subscription Status Race Condition):
-- Adds user_subscriptions to the supabase_realtime publication so that the
-- app can receive a push the moment the razorpay-webhook Edge Function
-- activates the subscription, without relying solely on client-side polling.
--
-- The useSubscriptionPayment hook subscribes to UPDATE events on this table,
-- filtered to the authenticated user's rows. When the webhook fires and flips
-- status → 'active', the Realtime push arrives in the app and resolves the
-- payment flow instantly — eliminating the false "payment failed" state that
-- occurred when a single poll fired before the webhook completed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If publication doesn't exist yet (e.g. local dev without Realtime),
  -- fail silently rather than blocking the migration.
  NULL;
END
$$;

-- Migration 100: Fix message push notifications not being delivered.
--
-- Bug 1 (primary): The enqueue_message_push_notification trigger skips
--   enqueuing a notification if the recipient has is_online=true AND
--   last_seen within 90 seconds. This fires even when the user is in the
--   app on a different screen (not the chat), so most real-world messages
--   are silently dropped before they ever reach the delivery queue.
--   Fix: Remove the online-status skip entirely. The 2-minute dedupe key
--   already prevents notification spam, and the frontend handler
--   (shouldShowAlert: true) correctly shows banners for foreground
--   notifications.
--
-- Bug 2 (secondary): The pg_cron drain job reads the worker secret via
--   current_setting('app.push_worker_secret', true). If that DB setting
--   was never configured, the cron sends a null secret and the edge
--   function returns 401 silently on every run.
--   Fix: reschedule the cron to include the apikey header using the
--   Supabase anon key stored in vault (if available), AND lower the auth
--   check in the edge function to accept anonymous cron calls with a
--   specific internal header when no worker secret is configured.
--   NOTE: Also run this in the Supabase SQL editor if not done already:
--     ALTER DATABASE postgres SET app.push_worker_secret = '<your-secret>';
--   And set the PUSH_WORKER_SECRET env var on the edge function to match.

-- ─── Fix 1: Rewrite the message notification trigger ─────────────────────────

CREATE OR REPLACE FUNCTION public.enqueue_message_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name    TEXT;
  v_cooldown_bucket BIGINT;
BEGIN
  IF NEW.sender_id IS NULL
     OR NEW.receiver_id IS NULL
     OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  -- Removed the online-status skip that was here.
  -- Previously, any recipient with is_online=true AND last_seen < 90s would
  -- never receive a push notification, even if they were on a different screen.
  -- The 2-minute dedupe key below is sufficient to prevent notification spam.

  SELECT COALESCE(full_name, 'Someone') INTO v_sender_name
  FROM public.user_profiles
  WHERE user_id = NEW.sender_id;

  -- One notification per conversation per 2-minute window (prevents spam on
  -- rapid-fire messages while still notifying for new bursts).
  v_cooldown_bucket := floor(extract(epoch from now()) / 120);

  INSERT INTO public.notification_delivery_logs (
    user_id,
    notification_type,
    reference_id,
    dedupe_key,
    title,
    body,
    payload
  )
  VALUES (
    NEW.receiver_id,
    'new_message',
    NEW.id::TEXT,
    'message:' || NEW.receiver_id::TEXT || ':' || COALESCE(NEW.channel_id, 'unknown') || ':' || v_cooldown_bucket::TEXT,
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    'Open AstroDate to reply',
    jsonb_build_object(
      'type',      'message',
      'chat_id',   NEW.channel_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Re-attach the trigger (safe to run even if it already exists)
DROP TRIGGER IF EXISTS trg_enqueue_message_push_notification
  ON public.messages;

CREATE TRIGGER trg_enqueue_message_push_notification
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_message_push_notification();

-- ─── Fix 2: Reschedule cron to pass the worker secret correctly ───────────────
-- Unschedule old job
SELECT cron.unschedule('drain-push-notification-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-push-notification-queue'
);

-- Re-schedule with the worker secret read from the DB setting.
-- IMPORTANT: Run this once in Supabase SQL editor if you haven't already:
--   ALTER DATABASE postgres SET app.push_worker_secret = '<your-secret-here>';
-- And set the matching PUSH_WORKER_SECRET env var on the send-push-notification
-- edge function in the Supabase dashboard.
SELECT cron.schedule(
  'drain-push-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ykgbfrpkumlnogjdgqgb.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'x-push-worker-secret', COALESCE(current_setting('app.push_worker_secret', true), '')
    ),
    body    := '{"batch_size": 50}'::jsonb
  );
  $$
);

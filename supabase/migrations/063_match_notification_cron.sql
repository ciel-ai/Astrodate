-- Migration 063: Fix match notification copy + schedule push worker cron
-- The trigger + queue + edge function already exist from migration 054.
-- This migration:
--   1. Updates the notification message to "You and [Name] matched! ✨ Say hello"
--   2. Schedules a cron job every 60s to drain the notification queue

-- ─────────────────────────────────────────────
-- 1. Fix the match notification message copy
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_match_push_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user1_name TEXT;
  v_user2_name TEXT;
BEGIN
  SELECT COALESCE(full_name, 'Someone') INTO v_user1_name
  FROM public.user_profiles
  WHERE user_id = NEW.user1_id;

  SELECT COALESCE(full_name, 'Someone') INTO v_user2_name
  FROM public.user_profiles
  WHERE user_id = NEW.user2_id;

  INSERT INTO public.notification_delivery_logs (
    user_id,
    notification_type,
    reference_id,
    dedupe_key,
    title,
    body,
    payload
  )
  VALUES
  -- Notify user1: "You and [user2 name] matched!"
  (
    NEW.user1_id,
    'new_match',
    NEW.id::TEXT,
    'match:' || NEW.id::TEXT || ':' || NEW.user1_id::TEXT,
    'You and ' || v_user2_name || ' matched! ✨',
    'Say hello — don''t keep them waiting 💫',
    jsonb_build_object(
      'type',      'match',
      'chat_id',   NEW.channel_id,
      'match_id',  NEW.id,
      'sender_id', NEW.user2_id
    )
  ),
  -- Notify user2: "You and [user1 name] matched!"
  (
    NEW.user2_id,
    'new_match',
    NEW.id::TEXT,
    'match:' || NEW.id::TEXT || ':' || NEW.user2_id::TEXT,
    'You and ' || v_user1_name || ' matched! ✨',
    'Say hello — don''t keep them waiting 💫',
    jsonb_build_object(
      'type',      'match',
      'chat_id',   NEW.channel_id,
      'match_id',  NEW.id,
      'sender_id', NEW.user1_id
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (safe to run even if it already exists)
DROP TRIGGER IF EXISTS trg_enqueue_match_push_notifications ON public.user_matches;
CREATE TRIGGER trg_enqueue_match_push_notifications
AFTER INSERT ON public.user_matches
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_match_push_notifications();

-- ─────────────────────────────────────────────
-- 2. Schedule cron job to drain the push queue
--    Runs every 60 seconds via pg_cron + net extension.
--    Replace YOUR_PROJECT_REF and YOUR_PUSH_WORKER_SECRET below.
-- ─────────────────────────────────────────────

-- Enable required extensions (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old job if it exists
SELECT cron.unschedule('drain-push-notification-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-push-notification-queue'
);

-- Schedule: every 60 seconds, POST to the send-push-notification edge function
SELECT cron.schedule(
  'drain-push-notification-queue',
  '* * * * *',   -- every minute (pg_cron minimum granularity)
  $$
  SELECT net.http_post(
    url     := 'https://ykgbfrpkumlnogjdgqgb.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',          'application/json',
      'x-push-worker-secret',  current_setting('app.push_worker_secret', true)
    ),
    body    := '{"batch_size": 50}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────
-- 3. Store the worker secret as a DB setting
--    (set once; cron job reads it at runtime)
--    Run this separately in Supabase SQL editor with your real secret:
--
--    ALTER DATABASE postgres SET app.push_worker_secret = 'your-secret-here';
--
-- ─────────────────────────────────────────────

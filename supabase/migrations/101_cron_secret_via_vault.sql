-- Migration 101: Read push worker secret from Supabase Vault in the cron job.
--
-- Problem: ALTER DATABASE postgres SET app.push_worker_secret = '...' requires
-- superuser which Supabase does not grant. Using current_setting() therefore
-- always returns NULL and the cron receives a 401 on every run.
--
-- Fix: Store the secret in the Supabase Vault (encrypted at rest, readable by
-- the postgres role) and read it from vault.decrypted_secrets in the cron.
--
-- BEFORE running this migration, store your secret in Vault by running this
-- once in the Supabase SQL editor (replace the value with your real secret):
--
--   SELECT vault.create_secret(
--     'YOUR_PUSH_WORKER_SECRET_VALUE',
--     'push_worker_secret',
--     'Auth secret for send-push-notification edge function cron drain'
--   );
--
-- The value must match the PUSH_WORKER_SECRET set in your edge function secrets.

-- Remove the old cron job
SELECT cron.unschedule('drain-push-notification-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-push-notification-queue'
);

-- Re-schedule: read the secret from vault at runtime
SELECT cron.schedule(
  'drain-push-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ykgbfrpkumlnogjdgqgb.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'x-push-worker-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_worker_secret'
        LIMIT 1
      )
    ),
    body    := '{"batch_size": 50}'::jsonb
  );
  $$
);

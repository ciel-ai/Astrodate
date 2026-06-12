-- Migration 054: Push notifications for matches and messages
-- Durable, retry-safe queue + token storage for Expo push notifications.

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  device_id TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT user_push_tokens_platform_check
    CHECK (platform IN ('ios', 'android', 'web', 'unknown'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_tokens_token
  ON public.user_push_tokens (expo_push_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_tokens_user_device
  ON public.user_push_tokens (user_id, device_id)
  WHERE device_id IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_active
  ON public.user_push_tokens (user_id, is_active, last_seen_at DESC);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users manage own push tokens"
  ON public.user_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages push tokens" ON public.user_push_tokens;
CREATE POLICY "Service role manages push tokens"
  ON public.user_push_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_matches_enabled BOOLEAN NOT NULL DEFAULT true,
  new_messages_enabled BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences"
  ON public.user_notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.user_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role reads notification preferences"
  ON public.user_notification_preferences;
CREATE POLICY "Service role reads notification preferences"
  ON public.user_notification_preferences
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expo_ticket_ids TEXT[],
  expo_receipt_ids TEXT[],
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_delivery_logs_type_check
    CHECK (notification_type IN ('new_match', 'new_message', 'marketing')),
  CONSTRAINT notification_delivery_logs_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_logs_dedupe
  ON public.notification_delivery_logs (dedupe_key);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_claim
  ON public.notification_delivery_logs (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_user_status
  ON public.notification_delivery_logs (user_id, status, created_at DESC);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification logs" ON public.notification_delivery_logs;
CREATE POLICY "Users read own notification logs"
  ON public.notification_delivery_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages notification logs" ON public.notification_delivery_logs;
CREATE POLICY "Service role manages notification logs"
  ON public.notification_delivery_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.register_push_token(
  p_expo_push_token TEXT,
  p_platform TEXT DEFAULT 'unknown',
  p_device_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_token_id UUID;
  v_platform TEXT := COALESCE(NULLIF(lower(trim(p_platform)), ''), 'unknown');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_expo_push_token IS NULL OR length(trim(p_expo_push_token)) < 16 THEN
    RAISE EXCEPTION 'Invalid Expo push token';
  END IF;

  IF v_platform NOT IN ('ios', 'android', 'web', 'unknown') THEN
    v_platform := 'unknown';
  END IF;

  IF p_device_id IS NOT NULL THEN
    UPDATE public.user_push_tokens
    SET is_active = false,
        updated_at = now()
    WHERE user_id = v_user_id
      AND device_id = p_device_id
      AND expo_push_token <> p_expo_push_token
      AND is_active = true;
  END IF;

  INSERT INTO public.user_push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_id,
    last_seen_at,
    updated_at,
    is_active
  )
  VALUES (
    v_user_id,
    trim(p_expo_push_token),
    v_platform,
    p_device_id,
    now(),
    now(),
    true
  )
  ON CONFLICT (expo_push_token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    device_id = EXCLUDED.device_id,
    last_seen_at = now(),
    updated_at = now(),
    is_active = true
  RETURNING id INTO v_token_id;

  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_token_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_push_token(
  p_expo_push_token TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_push_tokens
  SET is_active = false,
      updated_at = now()
  WHERE user_id = v_user_id
    AND (
      (p_expo_push_token IS NOT NULL AND expo_push_token = p_expo_push_token)
      OR (p_device_id IS NOT NULL AND device_id = p_device_id)
      OR (p_expo_push_token IS NULL AND p_device_id IS NULL)
    )
    AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_new_matches_enabled BOOLEAN DEFAULT NULL,
  p_new_messages_enabled BOOLEAN DEFAULT NULL,
  p_marketing_enabled BOOLEAN DEFAULT NULL,
  p_quiet_hours_start TIME DEFAULT NULL,
  p_quiet_hours_end TIME DEFAULT NULL
)
RETURNS public.user_notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row public.user_notification_preferences%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_notification_preferences
  SET new_matches_enabled = COALESCE(p_new_matches_enabled, new_matches_enabled),
      new_messages_enabled = COALESCE(p_new_messages_enabled, new_messages_enabled),
      marketing_enabled = COALESCE(p_marketing_enabled, marketing_enabled),
      quiet_hours_start = COALESCE(p_quiet_hours_start, quiet_hours_start),
      quiet_hours_end = COALESCE(p_quiet_hours_end, quiet_hours_end),
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_notification_delivery_logs(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  notification_type TEXT,
  reference_id TEXT,
  title TEXT,
  body TEXT,
  payload JSONB,
  attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT l.id
    FROM public.notification_delivery_logs l
    WHERE (
        l.status IN ('pending', 'failed')
        OR (l.status = 'processing' AND l.updated_at < now() - INTERVAL '5 minutes')
      )
      AND l.attempt_count < 3
      AND l.next_attempt_at <= now()
    ORDER BY l.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_delivery_logs l
  SET status = 'processing',
      updated_at = now(),
      error_message = NULL
  FROM picked
  WHERE l.id = picked.id
  RETURNING
    l.id,
    l.user_id,
    l.notification_type,
    l.reference_id,
    l.title,
    l.body,
    l.payload,
    l.attempt_count;
END;
$$;

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
  SELECT COALESCE(full_name, 'someone') INTO v_user1_name
  FROM public.user_profiles
  WHERE user_id = NEW.user1_id;

  SELECT COALESCE(full_name, 'someone') INTO v_user2_name
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
  (
    NEW.user1_id,
    'new_match',
    NEW.id::TEXT,
    'match:' || NEW.id::TEXT || ':' || NEW.user1_id::TEXT,
    'It is a cosmic match',
    'You matched with ' || COALESCE(v_user2_name, 'someone'),
    jsonb_build_object(
      'type', 'match',
      'chat_id', NEW.channel_id,
      'match_id', NEW.id,
      'sender_id', NEW.user2_id
    )
  ),
  (
    NEW.user2_id,
    'new_match',
    NEW.id::TEXT,
    'match:' || NEW.id::TEXT || ':' || NEW.user2_id::TEXT,
    'It is a cosmic match',
    'You matched with ' || COALESCE(v_user1_name, 'someone'),
    jsonb_build_object(
      'type', 'match',
      'chat_id', NEW.channel_id,
      'match_id', NEW.id,
      'sender_id', NEW.user1_id
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_match_push_notifications
  ON public.user_matches;

CREATE TRIGGER trg_enqueue_match_push_notifications
AFTER INSERT ON public.user_matches
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_match_push_notifications();

CREATE OR REPLACE FUNCTION public.enqueue_message_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
  v_recipient_online BOOLEAN := false;
  v_recently_seen BOOLEAN := false;
  v_cooldown_bucket BIGINT;
BEGIN
  IF NEW.sender_id IS NULL
     OR NEW.receiver_id IS NULL
     OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(os.is_online, false),
         COALESCE(os.last_seen > now() - INTERVAL '90 seconds', false)
  INTO v_recipient_online, v_recently_seen
  FROM public.user_online_status os
  WHERE os.user_id = NEW.receiver_id;

  -- Realtime owns the foreground experience. Push only supplements inactive users.
  IF COALESCE(v_recipient_online, false) AND COALESCE(v_recently_seen, false) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Someone') INTO v_sender_name
  FROM public.user_profiles
  WHERE user_id = NEW.sender_id;

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
      'type', 'message',
      'chat_id', NEW.channel_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_message_push_notification
  ON public.messages;

CREATE TRIGGER trg_enqueue_message_push_notification
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_message_push_notification();

-- Migration 072: cancel_my_subscription() RETURNS VOID
-- Marks the calling user's active subscription as 'canceled'.
-- SECURITY DEFINER so the client can call it without needing direct UPDATE access on user_subscriptions.

CREATE OR REPLACE FUNCTION public.cancel_my_subscription()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_subscriptions
  SET
    status = 'canceled',
    updated_at = now()
  WHERE
    user_id = v_user_id
    AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_subscription() TO authenticated;

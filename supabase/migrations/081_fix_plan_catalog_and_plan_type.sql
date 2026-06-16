-- Migration 080: Remove old plan tiers and fix plan_type stamping in webhook fn.
--
-- Context:
--   Migration 039 seeded stellar-monthly, cosmic-annual, galaxy-lifetime.
--   Migration 074 added astro_plus and astro_x but never deleted the old rows.
--   Migration 052 wrote hardcoded old names ('Stellar'/'Cosmic'/'Galaxy') into
--   user_profiles.plan_type based on interval — wrong now that both live plans
--   are monthly.  Fix: use the plan's actual plan_name from plan_catalog.

-- ─── 1. Deactivate old plans (safe first step, honours FK from user_subscriptions) ─
UPDATE public.plan_catalog
SET is_active = false
WHERE plan_slug IN ('stellar-monthly', 'cosmic-annual', 'galaxy-lifetime');

-- ─── 2. Delete old plans that have no subscription references ──────────────────
DELETE FROM public.plan_catalog
WHERE plan_slug IN ('stellar-monthly', 'cosmic-annual', 'galaxy-lifetime')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.plan_id = plan_catalog.id
  );

-- ─── 3. Fix process_razorpay_payment_link_paid to use plan_name ──────────────
--   Previously stamped 'Stellar' / 'Cosmic' / 'Galaxy' from interval type.
--   Now stamps the actual plan_name ('Astro+', 'AstroX', 'Stardust', etc.).
CREATE OR REPLACE FUNCTION public.process_razorpay_payment_link_paid(
  p_webhook_event_id TEXT,
  p_payment_id TEXT,
  p_order_id TEXT,
  p_payment_link_id TEXT,
  p_user_id UUID,
  p_plan_id UUID,
  p_payload_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plan_catalog%ROWTYPE;
  v_subscription public.user_subscriptions%ROWTYPE;
  v_period_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_plan_type TEXT;
BEGIN
  IF p_webhook_event_id IS NULL OR length(trim(p_webhook_event_id)) = 0 THEN
    RAISE EXCEPTION 'webhook_event_id is required';
  END IF;

  IF p_payment_link_id IS NULL OR length(trim(p_payment_link_id)) = 0 THEN
    RAISE EXCEPTION 'payment_link_id is required';
  END IF;

  IF p_user_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'user_id and plan_id are required';
  END IF;

  BEGIN
    INSERT INTO public.processed_razorpay_webhooks (
      webhook_event_id,
      event_type,
      payment_id,
      order_id,
      payment_link_id,
      user_id,
      plan_id,
      payload_hash
    )
    VALUES (
      p_webhook_event_id,
      'payment_link.paid',
      NULLIF(trim(p_payment_id), ''),
      NULLIF(trim(p_order_id), ''),
      p_payment_link_id,
      p_user_id,
      p_plan_id,
      p_payload_hash
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('status', 'duplicate', 'activated', false);
  END;

  SELECT *
  INTO v_plan
  FROM public.plan_catalog
  WHERE id = p_plan_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_id % was not found or is inactive', p_plan_id;
  END IF;

  -- Use the plan's actual name instead of hardcoded old tier names
  v_plan_type := v_plan.plan_name;

  -- Calculate period end from interval
  IF v_plan.interval = 'monthly' THEN
    v_period_end := v_now + interval '30 days';
  ELSIF v_plan.interval = 'annual' THEN
    v_period_end := v_now + interval '365 days';
  ELSIF v_plan.interval = 'lifetime' THEN
    v_period_end := NULL;
  ELSE
    v_period_end := NULL;
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
    AND razorpay_payment_link_id = p_payment_link_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_subscription.status = 'active' THEN
      IF v_subscription.razorpay_payment_id IS NULL AND p_payment_id IS NOT NULL THEN
        UPDATE public.user_subscriptions
        SET razorpay_payment_id = p_payment_id,
            updated_at = v_now
        WHERE id = v_subscription.id;
      END IF;

      UPDATE public.user_profiles
      SET plan_type = v_plan_type
      WHERE user_id = p_user_id;

      RETURN jsonb_build_object(
        'status', 'already_active',
        'activated', false,
        'subscription_id', v_subscription.id
      );
    END IF;

    UPDATE public.user_subscriptions
    SET status = 'active',
        plan_id = p_plan_id,
        razorpay_payment_id = NULLIF(trim(p_payment_id), ''),
        current_period_start = COALESCE(current_period_start, v_now),
        current_period_end = v_period_end,
        updated_at = v_now
    WHERE id = v_subscription.id
    RETURNING * INTO v_subscription;
  ELSE
    IF p_payment_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.user_subscriptions
      WHERE razorpay_payment_id = p_payment_id
        AND status = 'active'
    ) THEN
      RETURN jsonb_build_object('status', 'payment_already_active', 'activated', false);
    END IF;

    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      status,
      razorpay_payment_link_id,
      razorpay_payment_id,
      current_period_start,
      current_period_end
    )
    VALUES (
      p_user_id,
      p_plan_id,
      'active',
      p_payment_link_id,
      NULLIF(trim(p_payment_id), ''),
      v_now,
      v_period_end
    )
    RETURNING * INTO v_subscription;
  END IF;

  UPDATE public.user_profiles
  SET plan_type = v_plan_type
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'processed',
    'activated', true,
    'subscription_id', v_subscription.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_razorpay_payment_link_paid(TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_razorpay_payment_link_paid(TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT) TO service_role;

-- ─── Verify ───────────────────────────────────────────────────────────────────
SELECT plan_slug, plan_name, amount_paise, is_active
FROM public.plan_catalog
ORDER BY amount_paise;

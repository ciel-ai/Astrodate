-- Create RPC sync_ios_subscription(entitlement_id text) SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.sync_ios_subscription(entitlement_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_plan_id uuid;
  v_sub_id uuid;
BEGIN
  -- 1. Validate caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Find the plan_id from plan_catalog
  -- The active RevenueCat entitlement passed should match plan_slug (e.g. 'astro_plus' or 'astro_x').
  SELECT id INTO v_plan_id
  FROM public.plan_catalog
  WHERE plan_slug = entitlement_id
     OR plan_slug = CASE 
        WHEN entitlement_id = 'astrodate_astroplus_monthly' THEN 'astro_plus'
        WHEN entitlement_id = 'astrodate_astrox_monthly' THEN 'astro_x'
        ELSE entitlement_id
     END;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found for entitlement: %', entitlement_id;
  END IF;

  -- 3. Upsert into user_subscriptions
  SELECT id INTO v_sub_id
  FROM public.user_subscriptions
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.user_subscriptions
    SET plan_id = v_plan_id,
        status = 'active',
        current_period_start = now(),
        current_period_end = now() + interval '1 month',
        updated_at = now()
    WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    )
    VALUES (
      v_user_id,
      v_plan_id,
      'active',
      now(),
      now() + interval '1 month'
    );
  END IF;

  -- Also update plan_type in user_profiles
  UPDATE public.user_profiles
  SET plan_type = CASE 
    WHEN entitlement_id = 'astro_x' OR entitlement_id = 'astrodate_astrox_monthly' THEN 'AstroX'
    ELSE 'Astro+'
  END
  WHERE user_id = v_user_id;

  RETURN true;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.sync_ios_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_ios_subscription(text) TO authenticated;

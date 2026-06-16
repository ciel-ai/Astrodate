-- Safely links a Google identity to an existing Supabase user.
-- Can be called by an Edge Function or RPC if manual linking is needed.
CREATE OR REPLACE FUNCTION public.link_google_identity_to_user(
  p_user_id      uuid,
  p_google_sub    text,
  p_google_email  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_existing_user_id uuid;
  v_identity_id      uuid;
BEGIN
  -- Check if this Google sub is already linked to any Supabase user
  SELECT user_id INTO v_existing_user_id
  FROM auth.identities
  WHERE provider = 'google' AND provider_id = p_google_sub;

  IF v_existing_user_id IS NOT NULL THEN
    IF v_existing_user_id = p_user_id THEN
      RETURN jsonb_build_object('status', 'already_linked');
    ELSE
      RETURN jsonb_build_object(
        'status', 'conflict',
        'error',  'This Google ID is already linked to a different account'
      );
    END IF;
  END IF;

  -- Link the Google identity to the current user
  v_identity_id := gen_random_uuid();

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_identity_id,
    p_user_id,
    p_google_sub,
    jsonb_build_object(
      'sub',            p_google_sub,
      'email',          COALESCE(p_google_email, ''),
      'email_verified', true,
      'provider_id',    p_google_sub
    ),
    'google',
    NOW(), NOW(), NOW()
  );

  RETURN jsonb_build_object('status', 'linked', 'identity_id', v_identity_id);
END;
$$;

-- Only the service role may call this
REVOKE ALL ON FUNCTION public.link_google_identity_to_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_google_identity_to_user TO service_role;

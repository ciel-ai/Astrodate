CREATE OR REPLACE FUNCTION public.get_final_matches(p_user_id uuid)
RETURNS TABLE (
  match_user_id uuid,
  full_name text,
  gender text,
  age int,
  location text,
  final_match_score numeric,
  personality_score numeric,
  indian_score numeric,
  western_score numeric,
  indian_recommendation text,
  western_report text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    um.user2_id AS match_user_id,
    up.full_name,
    up.gender,
    NULL::int AS age,
    up.location,
    100.0::numeric AS final_match_score,
    80.0::numeric AS personality_score,
    80.0::numeric AS indian_score,
    80.0::numeric AS western_score,
    'Good Match'::text AS indian_recommendation,
    'Good Match'::text AS western_report
  FROM public.user_matches um
  JOIN public.user_profiles up ON up.user_id = um.user2_id
  WHERE um.user1_id = p_user_id
  ORDER BY final_match_score DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_old_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.messages
  WHERE created_at < now() - interval '5 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_membership()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Scaffold function. Replace with actual logic when memberships table exists.
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS TABLE (
  user_id uuid,
  phone text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.check_auth_user_exists(p_phone);
END;
$$;

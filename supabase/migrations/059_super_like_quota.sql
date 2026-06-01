CREATE OR REPLACE FUNCTION check_super_like_quota(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_slug TEXT;
  v_weekly_limit INT;
  v_used INT;
BEGIN
  SELECT plan_slug INTO v_plan_slug FROM user_subscriptions
    WHERE user_id = p_user_id AND status = 'active' LIMIT 1;
  v_weekly_limit := CASE COALESCE(v_plan_slug,'free')
    WHEN 'eclipse'   THEN 999
    WHEN 'moonrise'  THEN 5
    ELSE 1 -- free
  END;
  SELECT COUNT(*) INTO v_used FROM user_likes
    WHERE liker_id = p_user_id AND action_type = 'super_like'
      AND created_at > NOW() - INTERVAL '7 days';
  RETURN v_used < v_weekly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

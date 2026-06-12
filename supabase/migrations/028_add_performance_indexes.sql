CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON public.user_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_likes_mutual_check ON public.user_likes(liked_user_id, user_id, action_type) WHERE action_type IN ('like', 'super_like');
CREATE INDEX IF NOT EXISTS idx_user_likes_user_acted ON public.user_likes(user_id, liked_user_id);

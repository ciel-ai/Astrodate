-- 060_add_get_user_photos_batch.sql
CREATE OR REPLACE FUNCTION public.get_user_photos_batch(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, photo_url text, display_order int, is_primary boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, photo_url, display_order, is_primary
  FROM public.user_photos
  WHERE user_id = ANY(p_user_ids)
  ORDER BY is_primary DESC, display_order ASC;
$$;

-- Set storage bucket limits
UPDATE storage.buckets
SET file_size_limit = 5242880,  -- 5MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id IN ('user-photos', 'messages');

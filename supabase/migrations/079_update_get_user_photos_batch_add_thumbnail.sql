-- 079_update_get_user_photos_batch_add_thumbnail.sql

DROP FUNCTION IF EXISTS public.get_user_photos_batch(uuid[]);

CREATE FUNCTION public.get_user_photos_batch(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  photo_url text,
  storage_path text,
  thumbnail_url text,
  display_order int,
  is_primary boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, photo_url, storage_path, thumbnail_url, display_order, is_primary
  FROM public.user_photos
  WHERE user_id = ANY(p_user_ids)
  ORDER BY is_primary DESC, display_order ASC;
$$;

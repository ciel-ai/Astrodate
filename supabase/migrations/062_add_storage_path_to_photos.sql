-- 062_add_storage_path_to_photos.sql

ALTER TABLE public.user_photos
  ADD COLUMN IF NOT EXISTS storage_path text;

DROP FUNCTION IF EXISTS public.get_user_photos_batch(uuid[]);

CREATE FUNCTION public.get_user_photos_batch(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  photo_url text,
  storage_path text,
  display_order int,
  is_primary boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, photo_url, storage_path, display_order, is_primary
  FROM public.user_photos
  WHERE user_id = ANY(p_user_ids)
  ORDER BY is_primary DESC, display_order ASC;
$$;
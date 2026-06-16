-- 078_add_thumbnail_url_to_photos.sql
ALTER TABLE public.user_photos
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

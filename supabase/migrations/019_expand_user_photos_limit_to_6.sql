-- Expand user photo capacity to minimum 3 / maximum 6 photos.
-- Keeps display_order aligned with UI slots (0..5).

ALTER TABLE public.user_photos
  DROP CONSTRAINT IF EXISTS user_photos_display_order_check;

ALTER TABLE public.user_photos
  ADD CONSTRAINT user_photos_display_order_check
  CHECK (display_order >= 0 AND display_order < 6);

CREATE OR REPLACE FUNCTION public.enforce_user_photos_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_count integer;
BEGIN
  SELECT COUNT(*)
    INTO current_count
    FROM public.user_photos
   WHERE user_id = NEW.user_id;

  IF current_count >= 6 THEN
    RAISE EXCEPTION 'A user can only have up to 6 photos';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_photos_limit ON public.user_photos;

CREATE TRIGGER trg_user_photos_limit
BEFORE INSERT ON public.user_photos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_photos_limit();

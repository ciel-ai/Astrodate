-- Migration 090: Fix swipe_actions foreign key constraints for cascading delete
-- Ensures that when a user is deleted from auth.users, all swipe_actions records
-- where they are swiper or swiped are deleted automatically.

BEGIN;

ALTER TABLE public.swipe_actions
  DROP CONSTRAINT IF EXISTS swipe_actions_swiper_id_fkey,
  DROP CONSTRAINT IF EXISTS swipe_actions_swiped_id_fkey;

ALTER TABLE public.swipe_actions
  ADD CONSTRAINT swipe_actions_swiper_id_fkey
    FOREIGN KEY (swiper_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT swipe_actions_swiped_id_fkey
    FOREIGN KEY (swiped_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;

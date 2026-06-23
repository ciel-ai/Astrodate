-- Migration 103: Fix messages and reports foreign key constraints for cascading delete
-- (renumbered from a duplicate 098_ prefix that collided with 098_fix_matching_gender_filters)
-- Ensures that when a user is deleted, their messages and reports are automatically deleted.

BEGIN;

-- Fix public.messages foreign keys
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT messages_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix public.reports foreign keys
ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey,
  DROP CONSTRAINT IF EXISTS reports_reported_user_id_fkey;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT reports_reported_user_id_fkey
    FOREIGN KEY (reported_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMIT;

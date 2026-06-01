-- Migration: 046_update_message_retention.sql
-- Changes:
-- 1) Create index on messages(created_at) to avoid full-table scans
-- 2) Replace delete_old_messages() to retain 90 days and perform batched deletes

BEGIN;

-- 1) Ensure index on created_at for efficient range scans
CREATE INDEX IF NOT EXISTS idx_messages_created_at
ON public.messages(created_at);

-- 2) Replace the cleanup RPC with a batched, non-blocking implementation
--    It deletes rows older than 90 days in batches to avoid long transactions
--    and returns aggregate statistics for observability.
CREATE OR REPLACE FUNCTION public.delete_old_messages()
RETURNS TABLE(deleted_count bigint, conversations_processed bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_size int := 10000; -- tuneable batch size
  deleted_total bigint := 0;
  del_count int := 0;
BEGIN
  LOOP
    -- Delete a batch of old messages based on created_at index
    DELETE FROM public.messages
    WHERE id IN (
      SELECT id FROM public.messages
      WHERE created_at < now() - interval '90 days'
      LIMIT batch_size
    );

    GET DIAGNOSTICS del_count = ROW_COUNT;
    IF del_count = 0 THEN
      EXIT;
    END IF;

    deleted_total := deleted_total + del_count;
    -- Loop will continue until no more old rows exist
  END LOOP;

  RETURN QUERY SELECT deleted_total AS deleted_count, 0 AS conversations_processed;
END;
$$;

COMMIT;

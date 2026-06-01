-- Migration 050: Create AI usage tracking table and atomic increment RPC
BEGIN;

-- Create table to track per-user per-day AI usage
CREATE TABLE IF NOT EXISTS public.ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_usage_unique_per_day UNIQUE (user_id, endpoint, usage_date)
);

-- Indexes to support lookups and scale
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage_tracking(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_endpoint_date ON public.ai_usage_tracking(endpoint, usage_date);

-- SECURITY DEFINER function to atomically increment usage and enforce a daily limit
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user UUID, p_endpoint TEXT, p_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Start a transaction block (function runs in transaction)
  LOOP
    -- Try to lock existing row
    SELECT request_count INTO v_count
    FROM public.ai_usage_tracking
    WHERE user_id = p_user AND endpoint = p_endpoint AND usage_date = CURRENT_DATE
    FOR UPDATE
    ;

    IF FOUND THEN
      IF v_count >= p_limit THEN
        RETURN FALSE; -- limit reached
      END IF;
      UPDATE public.ai_usage_tracking
      SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user AND endpoint = p_endpoint AND usage_date = CURRENT_DATE;
      RETURN TRUE;
    ELSE
      -- Insert new row with count = 1
      INSERT INTO public.ai_usage_tracking(user_id, endpoint, request_count, usage_date)
      VALUES (p_user, p_endpoint, 1, CURRENT_DATE)
      ON CONFLICT (user_id, endpoint, usage_date) DO NOTHING;

      -- If another session inserted concurrently, loop and try again
      IF ROW_COUNT = 1 THEN
        RETURN TRUE;
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- Migration 084: Rename weekly_stars → daily_super_likes in existing plan_catalog rows.
--
-- Migration 074 already inserts/upserts with the correct key name.
-- This migration patches any live rows that still carry the old 'weekly_stars' key
-- (e.g. on a DB that was running before 074 was re-applied, or if there are
-- rows inserted by the old 039 seed that didn't go through 074 UPSERT).

UPDATE public.plan_catalog
SET features = (features - 'weekly_stars')
               || jsonb_build_object('daily_super_likes', (features->>'weekly_stars')::int)
WHERE features ? 'weekly_stars';

-- Verify
SELECT plan_slug,
       features->>'daily_super_likes' AS daily_super_likes,
       features->>'daily_likes'       AS daily_likes
FROM public.plan_catalog
ORDER BY amount_paise;

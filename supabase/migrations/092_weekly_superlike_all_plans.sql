-- Migration 092: Change Astro+ and AstroX super-like quota from daily → weekly.
--
-- Free tier was already migrated to weekly_super_likes in migration 091.
-- This migration does the same for paid plans so all tiers share a weekly window.

UPDATE public.plan_catalog
SET features = (features - 'daily_super_likes')
               || jsonb_build_object('weekly_super_likes', (features->>'daily_super_likes')::int)
WHERE plan_slug IN ('astro_plus', 'astro_x')
  AND features ? 'daily_super_likes';

-- Verify
SELECT plan_slug,
       features->>'weekly_super_likes' AS weekly_super_likes
FROM public.plan_catalog
ORDER BY amount_paise;

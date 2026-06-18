-- Migration 094: Set Astro+ daily_likes to 30 (was -1 / unlimited).
UPDATE public.plan_catalog
SET features = jsonb_set(features, '{daily_likes}', '30')
WHERE plan_slug = 'astro_plus';

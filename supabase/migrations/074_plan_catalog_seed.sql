-- ============================================================
-- AstroDate — Plan Catalog Seed  (updated)
-- Run this in your Supabase SQL editor (or as a migration).
--
-- Key change: `full_synastry_report` is the canonical key.
-- `deep_synastry` is included as an alias so any existing
-- code that checks features.deep_synastry still works.
-- ============================================================

-- 1. Stardust (Free)
INSERT INTO plan_catalog (plan_slug, plan_name, plan_badge, amount_paise, interval, is_active, features)
VALUES (
  'free',
  'Stardust',
  'Free',
  0,
  NULL,
  true,
  '{
    "daily_likes": 10,
    "see_who_likes_you": 1,
    "advanced_filters": false,
    "dealbreakers": false,
    "incognito_mode": false,
    "weekly_stars": 1,
    "basic_compatibility": true,
    "full_synastry_report": false,
    "deep_synastry": false,
    "daily_cosmic_insights": true,
    "ai_match_reading": false,
    "weekly_boost": false,
    "priority_likes": false,
    "skip_the_line": false,
    "astrologer_chat": true,
    "reading_packages": true
  }'::jsonb
)
ON CONFLICT (plan_slug) DO UPDATE SET
  plan_name    = EXCLUDED.plan_name,
  plan_badge   = EXCLUDED.plan_badge,
  amount_paise = EXCLUDED.amount_paise,
  is_active    = EXCLUDED.is_active,
  features     = EXCLUDED.features;

-- 2. Astro+ — ₹299/mo — Utility tier
INSERT INTO plan_catalog (plan_slug, plan_name, plan_badge, amount_paise, interval, is_active, features)
VALUES (
  'astro_plus',
  'Astro+',
  'Astro+',
  29900,
  'monthly',
  true,
  '{
    "daily_likes": -1,
    "see_who_likes_you": 5,
    "advanced_filters": true,
    "dealbreakers": true,
    "incognito_mode": false,
    "weekly_stars": 3,
    "basic_compatibility": true,
    "full_synastry_report": false,
    "deep_synastry": false,
    "daily_cosmic_insights": true,
    "ai_match_reading": false,
    "weekly_boost": false,
    "priority_likes": false,
    "skip_the_line": false,
    "astrologer_chat": true,
    "reading_packages": true
  }'::jsonb
)
ON CONFLICT (plan_slug) DO UPDATE SET
  plan_name    = EXCLUDED.plan_name,
  plan_badge   = EXCLUDED.plan_badge,
  amount_paise = EXCLUDED.amount_paise,
  interval     = EXCLUDED.interval,
  is_active    = EXCLUDED.is_active,
  features     = EXCLUDED.features;

-- 3. AstroX — ₹599/mo — Visibility + Insight tier
INSERT INTO plan_catalog (plan_slug, plan_name, plan_badge, amount_paise, interval, is_active, features)
VALUES (
  'astro_x',
  'AstroX',
  'AstroX',
  59900,
  'monthly',
  true,
  '{
    "daily_likes": -1,
    "see_who_likes_you": -1,
    "advanced_filters": true,
    "dealbreakers": true,
    "incognito_mode": false,
    "weekly_stars": 5,
    "basic_compatibility": true,
    "full_synastry_report": true,
    "deep_synastry": true,
    "daily_cosmic_insights": true,
    "ai_match_reading": true,
    "weekly_boost": true,
    "priority_likes": true,
    "skip_the_line": false,
    "astrologer_chat": true,
    "reading_packages": true
  }'::jsonb
)
ON CONFLICT (plan_slug) DO UPDATE SET
  plan_name    = EXCLUDED.plan_name,
  plan_badge   = EXCLUDED.plan_badge,
  amount_paise = EXCLUDED.amount_paise,
  interval     = EXCLUDED.interval,
  is_active    = EXCLUDED.is_active,
  features     = EXCLUDED.features;

-- ============================================================
-- Verify
-- ============================================================
SELECT plan_slug, plan_name, amount_paise, is_active,
       features->>'full_synastry_report' AS full_synastry,
       features->>'deep_synastry'        AS deep_synastry
FROM plan_catalog
ORDER BY amount_paise;

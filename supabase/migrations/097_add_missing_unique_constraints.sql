-- Migration 097: add missing unique constraints on user_subscriptions
-- Required for razorpay-link insert and webhook upsert to work correctly.

-- 1. Unique index on razorpay_payment_link_id (partial — only when non-null)
--    Prevents duplicate subscription rows for the same payment link.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_link_unique
  ON public.user_subscriptions(razorpay_payment_link_id)
  WHERE razorpay_payment_link_id IS NOT NULL;

-- 2. Unique index on razorpay_payment_id (partial — only when non-null)  
--    Prevents double-activation if webhook fires twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_razorpay_payment_unique
  ON public.user_subscriptions(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- 3. Deactivate old seed plans that no longer exist in the app UI
--    (stellar-monthly, cosmic-annual, galaxy-lifetime from migration 039)
--    Prevents plan lookup ambiguity.
UPDATE public.plan_catalog
SET is_active = false
WHERE plan_slug IN ('stellar-monthly', 'cosmic-annual', 'galaxy-lifetime', 'free');

-- 4. Confirm astro_plus and astro_x are active
UPDATE public.plan_catalog
SET is_active = true
WHERE plan_slug IN ('astro_plus', 'astro_x');

-- Verify: should show only astro_plus and astro_x as active
SELECT plan_slug, plan_name, amount_paise, is_active FROM plan_catalog ORDER BY amount_paise;
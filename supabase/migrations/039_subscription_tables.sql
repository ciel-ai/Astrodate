-- Plan catalog (static, seeded)
CREATE TABLE IF NOT EXISTS public.plan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_slug TEXT UNIQUE NOT NULL,
  plan_name TEXT NOT NULL,
  plan_badge TEXT NOT NULL,
  amount_paise INT NOT NULL DEFAULT 0,
  interval TEXT, -- 'monthly' | 'annual' | 'lifetime' | null for free
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read plan catalog" ON public.plan_catalog
  FOR SELECT USING (true);

-- Seed plans
INSERT INTO public.plan_catalog (plan_slug, plan_name, plan_badge, amount_paise, interval, features) VALUES
  ('free',            'Free',            'Free',       0,      null,       '{"super_likes_per_day": 1, "see_who_liked_me": false, "advanced_filters": false, "vedic_report": false}'),
  ('stellar-monthly', 'Stellar Monthly',  'Stellar ✨', 69900,  'monthly',  '{"super_likes_per_day": 5, "see_who_liked_me": true, "advanced_filters": false, "vedic_report": false}'),
  ('cosmic-annual',   'Cosmic Annual',    'Cosmic 🌌',  499900, 'annual',   '{"super_likes_per_day": 15, "see_who_liked_me": true, "advanced_filters": true, "vedic_report": true}'),
  ('galaxy-lifetime', 'Galaxy Lifetime',  'Galaxy 🌠',  199900, 'lifetime', '{"super_likes_per_day": 999, "see_who_liked_me": true, "advanced_filters": true, "vedic_report": true}')
ON CONFLICT (plan_slug) DO NOTHING;

-- User subscriptions ledger
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plan_catalog(id),
  status TEXT NOT NULL DEFAULT 'incomplete', -- incomplete | active | past_due | canceled | expired
  razorpay_payment_link_id TEXT,
  razorpay_payment_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,   -- NULL for lifetime
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- Only service role (webhook) can INSERT/UPDATE subscriptions

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON public.user_subscriptions(user_id, status);

-- Daily super_like quota tracker
CREATE TABLE IF NOT EXISTS public.super_like_quota (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.super_like_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own quota" ON public.super_like_quota
  FOR ALL USING (auth.uid() = user_id);

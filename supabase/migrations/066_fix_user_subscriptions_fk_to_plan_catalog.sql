-- user_subscriptions.plan_id was pointing at a legacy "plans" table
-- created manually in the dashboard. Retarget it to plan_catalog.
ALTER TABLE public.user_subscriptions
  DROP CONSTRAINT user_subscriptions_plan_id_fkey;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.plan_catalog(id)
  ON DELETE RESTRICT;
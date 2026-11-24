-- Multiple mid-week plan-upgrade PaymentIntents per cycle (10→15→20, then pause).
-- Run in Supabase SQL editor (or psql). Safe to re-run.

alter table public.subscription_cycles
  add column if not exists stripe_plan_delta_payment_intent_ids jsonb not null default '[]'::jsonb;

-- Backfill from the singular pointer when the array is still empty.
update public.subscription_cycles
set stripe_plan_delta_payment_intent_ids = jsonb_build_array(stripe_plan_delta_payment_intent_id)
where coalesce(stripe_plan_delta_payment_intent_id, '') <> ''
  and (
    stripe_plan_delta_payment_intent_ids is null
    or stripe_plan_delta_payment_intent_ids = '[]'::jsonb
  );

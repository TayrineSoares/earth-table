-- Mid-week money moves that are not the Tuesday plan PI.
-- Persist so pause / fulfillment refunds can target them.
-- Safe to re-run (IF NOT EXISTS). Run once in the Supabase SQL editor.

alter table public.subscription_cycles
  add column if not exists stripe_delivery_payment_intent_id text;

alter table public.subscription_cycles
  add column if not exists stripe_plan_delta_payment_intent_id text;

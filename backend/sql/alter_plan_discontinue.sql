/* One-shot for existing projects. Run in the Supabase SQL editor. */

alter table public.subscription_plans
  add column if not exists discontinued_at timestamptz;

alter table public.subscriptions
  add column if not exists cancelled_reason text;

alter table public.subscriptions drop constraint if exists subscriptions_cancelled_reason_check;
alter table public.subscriptions
  add constraint subscriptions_cancelled_reason_check
  check (cancelled_reason is null or cancelled_reason in ('plan_discontinued'));

-- Plan-change / meal-count audit extras
-- REQUIRED before deploying hotfix-meal-count (app reads/writes these columns).
-- Safe to re-run (IF NOT EXISTS). Run once in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- subscription_cycles: freeze expected count for that Sunday + meal confirm stamp
-- ---------------------------------------------------------------------------
alter table public.subscription_cycles
  add column if not exists meal_count int
    check (meal_count is null or meal_count > 0);

alter table public.subscription_cycles
  add column if not exists meals_confirmed_at timestamptz;

-- Backfill from the plan row attached to each cycle (best available snapshot).
update public.subscription_cycles c
set meal_count = p.meal_count
from public.subscription_plans p
where c.plan_id = p.id
  and c.meal_count is null;

-- ---------------------------------------------------------------------------
-- subscriptions: last plan switch + previous plan (support / forensics)
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists plan_changed_at timestamptz;

alter table public.subscriptions
  add column if not exists previous_plan_id uuid
    references public.subscription_plans (id);

-- ---------------------------------------------------------------------------
-- Full history of plan switches (pending + applied)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_plan_changes (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  from_plan_id uuid references public.subscription_plans (id),
  to_plan_id uuid not null references public.subscription_plans (id),
  -- pending = saved for following week; applied = live on the subscription now
  timing text not null
    check (timing in ('pending', 'applied')),
  -- Meal qty confirmed with the change (null if legacy / unknown)
  meals_qty int
    check (meals_qty is null or meals_qty > 0),
  -- Which Sunday the new size is for (this week or following), when known
  delivery_date date,
  created_at timestamptz not null default now()
);

create index if not exists subscription_plan_changes_subscription_id_idx
  on public.subscription_plan_changes (subscription_id);

create index if not exists subscription_plan_changes_created_at_idx
  on public.subscription_plan_changes (created_at desc);

alter table public.subscription_plan_changes enable row level security;
revoke all on public.subscription_plan_changes from anon, authenticated;

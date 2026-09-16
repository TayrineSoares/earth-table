-- Weekly meal subscriptions
-- Run this once in the Supabase SQL editor. Do not apply from the app.
--
-- Amounts are integer cents (pre-tax), same as products/orders.
-- Backend uses the service role; anon/authenticated are revoked.
--
-- After testing: deactivate the $1 plan, and set
--   test_charge_at = null, test_lock_at = null
-- so live Wednesday 5pm / Thursday 5pm America/Toronto apply.

-- Needed for gen_random_uuid() on some projects
create extension if not exists pgcrypto;

-- One Stripe customer per app user (reused across their subscriptions)
alter table public.users
  add column if not exists stripe_customer_id text;

-- ---------------------------------------------------------------------------
-- Plans (admin-managed catalog)
-- name + meal_count are frozen after insert (enforced in the API, not a trigger)
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meal_count int not null check (meal_count > 0),
  price_cents int not null check (price_cents >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customer subscriptions (several per user is allowed: household + gift, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (auth_user_id),
  plan_id uuid not null references public.subscription_plans (id),
  label text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'cancelled')),
  pause_reason text
    check (pause_reason in ('manual', 'payment_failed')),
  pending_plan_id uuid references public.subscription_plans (id),
  pending_status text
    check (pending_status in ('paused', 'cancelled')),
  stripe_customer_id text,
  stripe_payment_method_id text,
  delivery boolean not null default true,
  delivery_postal_code text,
  pickup_time_slot text,
  special_note text,
  first_promo_code text,
  first_promo_percent int not null default 0,
  first_promo_applied boolean not null default false,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz
);

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists subscriptions_plan_id_idx
  on public.subscriptions (plan_id);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);

-- ---------------------------------------------------------------------------
-- One cycle per subscription per Sunday delivery
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_cycles (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id),
  plan_id uuid not null references public.subscription_plans (id),
  plan_price_cents int not null,
  cutoff_at timestamptz not null,
  delivery_date date not null,
  pickup_date date,
  status text not null default 'open'
    check (status in ('open', 'locked', 'charged', 'failed', 'skipped')),
  delivery boolean not null default true,
  delivery_postal_code text,
  pickup_time_slot text,
  special_note text,
  delivery_fee_cents int not null default 0,
  plan_paid_cents int not null default 0,
  addon_paid_cents int not null default 0,
  promo_percent int not null default 0,
  stripe_payment_intent_id text,
  order_id int references public.orders (id),
  charged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subscription_id, delivery_date)
);

create index if not exists subscription_cycles_status_idx
  on public.subscription_cycles (status);

create index if not exists subscription_cycles_delivery_date_idx
  on public.subscription_cycles (delivery_date);

create table if not exists public.subscription_cycle_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.subscription_cycles (id) on delete cascade,
  product_id int not null references public.products (id),
  quantity int not null check (quantity > 0),
  unit_price_cents int not null,
  kind text not null check (kind in ('plan', 'addon'))
);

create index if not exists subscription_cycle_items_cycle_id_idx
  on public.subscription_cycle_items (cycle_id);

-- Kitchen/history orders that came from a subscription week
alter table public.orders
  add column if not exists subscription_cycle_id uuid references public.subscription_cycles (id);

-- Idempotent cron: one charge job and one lock job per week_key
create table if not exists public.cutoff_runs (
  week_key text not null,
  job text not null check (job in ('wednesday_charge', 'thursday_lock')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb,
  primary key (week_key, job)
);

-- ---------------------------------------------------------------------------
-- Test-week overrides. One row only (id = 1).
-- If test_charge_at / test_lock_at are set, the app uses those instead of
-- live Wednesday 5pm / Thursday 5pm America/Toronto.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_settings (
  id int primary key default 1 check (id = 1),
  charge_weekday int not null default 3 check (charge_weekday between 0 and 6),
  lock_weekday int not null default 4 check (lock_weekday between 0 and 6),
  cutoff_hour int not null default 17 check (cutoff_hour between 0 and 23),
  cutoff_minute int not null default 0 check (cutoff_minute between 0 and 59),
  timezone text not null default 'America/Toronto',
  test_charge_at timestamptz,
  test_lock_at timestamptz
);

insert into public.subscription_settings (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed catalog (skip a name if it already exists so this file is re-runnable)
-- ---------------------------------------------------------------------------
insert into public.subscription_plans (name, meal_count, price_cents, description, is_active)
select '10 meals', 10, 18000, 'Best for one person eating two meals a day, most days.', true
where not exists (select 1 from public.subscription_plans where name = '10 meals');

insert into public.subscription_plans (name, meal_count, price_cents, description, is_active)
select '15 meals', 15, 27000, 'Lunch and dinner sorted all week, with a few left for the weekend.', true
where not exists (select 1 from public.subscription_plans where name = '15 meals');

insert into public.subscription_plans (name, meal_count, price_cents, description, is_active)
select '20 meals', 20, 36000, 'For two, or for a week you''d rather not think about cooking at all.', true
where not exists (select 1 from public.subscription_plans where name = '20 meals');

update public.subscription_plans
set description = 'Best for one person eating two meals a day, most days.'
where name = '10 meals' and (description is null or btrim(description) = '');

update public.subscription_plans
set description = 'Lunch and dinner sorted all week, with a few left for the weekend.'
where name = '15 meals' and (description is null or btrim(description) = '');

update public.subscription_plans
set description = 'For two, or for a week you''d rather not think about cooking at all.'
where name = '20 meals' and (description is null or btrim(description) = '');

-- Cheap plan for Stripe/card testing. Use pickup so delivery is not added.
-- Deactivate before launch.
insert into public.subscription_plans (name, meal_count, price_cents, description, is_active)
select
  'Test — $1',
  1,
  100,
  'Stripe / card test — deactivate before launch. Checkout with pickup.',
  true
where not exists (select 1 from public.subscription_plans where name = 'Test — $1');

-- ---------------------------------------------------------------------------
-- RLS: tables are only used by the Express service role
-- ---------------------------------------------------------------------------
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_cycles enable row level security;
alter table public.subscription_cycle_items enable row level security;
alter table public.cutoff_runs enable row level security;
alter table public.subscription_settings enable row level security;

revoke all on public.subscription_plans from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.subscription_cycles from anon, authenticated;
revoke all on public.subscription_cycle_items from anon, authenticated;
revoke all on public.cutoff_runs from anon, authenticated;
revoke all on public.subscription_settings from anon, authenticated;

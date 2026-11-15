-- Rare safety-net events (UI normally prevents these).
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).
--
-- kinds:
--   lock_meal_mismatch  — Wednesday lock: selected meals ≠ plan size
--   copy_forward_skipped — next week not seeded because source qty ≠ plan size

create table if not exists public.subscription_ops_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('lock_meal_mismatch', 'copy_forward_skipped')),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  cycle_id uuid references public.subscription_cycles (id) on delete set null,
  source_cycle_id uuid references public.subscription_cycles (id) on delete set null,
  delivery_date date,
  need int,
  got int,
  order_id int,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_ops_events_kind_created_idx
  on public.subscription_ops_events (kind, created_at desc);

create index if not exists subscription_ops_events_subscription_id_idx
  on public.subscription_ops_events (subscription_id);

alter table public.subscription_ops_events enable row level security;
revoke all on public.subscription_ops_events from anon, authenticated;

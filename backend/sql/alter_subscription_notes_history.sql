-- Trail of special_note changes per Sunday/cycle.
-- Run once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).
--
-- App writes a row whenever a customer saves notes (notes-only or with
-- pickup/delivery). Each Sunday keeps its own current note on
-- subscription_cycles.special_note; this table is the history.

create table if not exists public.subscription_notes_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  cycle_id uuid references public.subscription_cycles (id) on delete set null,
  -- Which Sunday these notes were saved for
  delivery_date date,
  previous_note text,
  note text,
  -- notes_only | fulfillment | signup | backfill
  source text
    check (source is null or source in ('notes_only', 'fulfillment', 'signup', 'backfill')),
  created_at timestamptz not null default now()
);

-- If the table already existed without 'backfill', widen the check.
alter table public.subscription_notes_history
  drop constraint if exists subscription_notes_history_source_check;

alter table public.subscription_notes_history
  add constraint subscription_notes_history_source_check
  check (source is null or source in ('notes_only', 'fulfillment', 'signup', 'backfill'));

create index if not exists subscription_notes_history_subscription_id_idx
  on public.subscription_notes_history (subscription_id, created_at desc);

create index if not exists subscription_notes_history_cycle_id_idx
  on public.subscription_notes_history (cycle_id, created_at desc);

create index if not exists subscription_notes_history_delivery_date_idx
  on public.subscription_notes_history (delivery_date desc);

alter table public.subscription_notes_history enable row level security;
revoke all on public.subscription_notes_history from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: one snapshot row per cycle that already has notes.
-- Safe to re-run — skips cycles that already have any history row.
-- previous_note is null (we only know the current text, not earlier edits).
-- ---------------------------------------------------------------------------
insert into public.subscription_notes_history (
  subscription_id,
  cycle_id,
  delivery_date,
  previous_note,
  note,
  source,
  created_at
)
select
  c.subscription_id,
  c.id,
  c.delivery_date,
  null,
  c.special_note,
  'backfill',
  coalesce(c.cutoff_at, now())
from public.subscription_cycles c
where c.special_note is not null
  and length(trim(c.special_note)) > 0
  and not exists (
    select 1
    from public.subscription_notes_history h
    where h.cycle_id = c.id
  );

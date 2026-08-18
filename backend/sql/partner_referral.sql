-- Partner referral codes + cashback wallet
-- Run this once in the Supabase SQL editor. Do not apply from the app.
--
-- Payout types: 'cash' | 'credit' (never 'money').
-- Amounts are integer cents. Referral codes are matched case-insensitively;
-- the API stores them uppercase (e.g. JOSH15).
--
-- Collision trigger lives in schema `private` as SECURITY DEFINER so Promo Admin
-- (anon client inserts into promo_codes) can still see partner codes under RLS.

create schema if not exists private;

-- FK target: partners.user_id -> users.auth_user_id
create unique index if not exists users_auth_user_id_key
  on public.users (auth_user_id);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (auth_user_id),
  referral_code text not null,
  active boolean not null default true,
  payout_type text not null default 'cash'
    check (payout_type in ('cash', 'credit')),
  pending_payout_type text
    check (pending_payout_type in ('cash', 'credit')),
  pending_payout_effective_on date,
  last_payout_switch_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists partners_referral_code_lower_idx
  on public.partners (lower(referral_code));

create table if not exists public.partner_invoices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  period_year int not null,
  period_month int not null check (period_month between 1 and 12),
  payout_type text check (payout_type in ('cash', 'credit')),
  cash_cents int not null default 0,
  credit_cents int not null default 0,
  total_cents int not null default 0,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'paid', 'credited')),
  paid_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (partner_id, period_year, period_month)
);

create table if not exists public.partner_ledger (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  kind text not null check (kind in ('earn', 'redeem')),
  order_id int references public.orders (id),
  amount_cents int not null check (amount_cents > 0),
  payout_type text not null check (payout_type in ('cash', 'credit')),
  status text not null check (status in ('pending', 'available', 'applied')),
  accrual_month date,
  invoice_id uuid references public.partner_invoices (id),
  created_at timestamptz not null default now()
);

create unique index if not exists partner_ledger_one_earn_per_order
  on public.partner_ledger (order_id) where kind = 'earn';

create unique index if not exists partner_ledger_one_redeem_per_order
  on public.partner_ledger (order_id) where kind = 'redeem';

create index if not exists partner_ledger_partner_status_idx
  on public.partner_ledger (partner_id, kind, status);

alter table public.orders
  add column if not exists referral_partner_id uuid references public.partners (id),
  add column if not exists referral_code text,
  add column if not exists credit_applied_cents int not null default 0,
  add column if not exists item_subtotal_cents int;

create or replace function private.prevent_discount_code_collision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'partners' then
    if exists (
      select 1 from public.promo_codes p
      where lower(p.code) = lower(new.referral_code)
    ) then
      raise exception 'Referral code collides with an existing promo code';
    end if;
  elsif tg_table_name = 'promo_codes' then
    if exists (
      select 1 from public.partners r
      where lower(r.referral_code) = lower(new.code)
    ) then
      raise exception 'Promo code collides with an existing referral code';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_discount_code_collision() from public;

drop trigger if exists partners_no_promo_collision on public.partners;
create trigger partners_no_promo_collision
  before insert or update of referral_code on public.partners
  for each row execute function private.prevent_discount_code_collision();

drop trigger if exists promo_codes_no_partner_collision on public.promo_codes;
create trigger promo_codes_no_partner_collision
  before insert or update of code on public.promo_codes
  for each row execute function private.prevent_discount_code_collision();

alter table public.partners enable row level security;
alter table public.partner_invoices enable row level security;
alter table public.partner_ledger enable row level security;

revoke all on public.partners from anon, authenticated;
revoke all on public.partner_invoices from anon, authenticated;
revoke all on public.partner_ledger from anon, authenticated;

-- Migration (run if partner_invoices already exists from an earlier deploy):
-- alter table public.partner_invoices
--   add column if not exists cash_cents int not null default 0,
--   add column if not exists credit_cents int not null default 0;
-- alter table public.partner_invoices alter column payout_type drop not null;
-- update public.partner_invoices set cash_cents = total_cents, credit_cents = 0
--   where payout_type = 'cash' and total_cents > 0 and cash_cents = 0 and credit_cents = 0;
-- update public.partner_invoices set credit_cents = total_cents, cash_cents = 0
--   where payout_type = 'credit' and total_cents > 0 and cash_cents = 0 and credit_cents = 0;
-- update public.partners set pending_payout_type = null, pending_payout_effective_on = null;

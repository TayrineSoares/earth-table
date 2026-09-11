-- Per-partner referral discount and cashback rates.
-- Run once in the Supabase SQL editor (you may already have run this).
-- Defaults are a backend guard (10% / 10%). Admin UI requires explicit rates on create.
alter table public.partners
  add column if not exists discount_percent int not null default 10
    check (discount_percent between 0 and 100),
  add column if not exists cashback_percent int not null default 10
    check (cashback_percent between 0 and 100);

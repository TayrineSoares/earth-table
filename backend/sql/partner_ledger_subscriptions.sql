-- Partner cashback for weekly-plan signups (no kitchen order until Thursday lock).
-- Run this once in the Supabase SQL editor. Do not apply from the app.
--
-- À la carte earns keep order_id. Subscription earns store subscription_id
-- instead, plus the pre-discount plan+add-on subtotal used for the 10% cashback.

alter table public.partner_ledger
  add column if not exists subscription_id uuid references public.subscriptions (id);

alter table public.partner_ledger
  add column if not exists item_subtotal_cents int;

create unique index if not exists partner_ledger_one_earn_per_subscription
  on public.partner_ledger (subscription_id)
  where kind = 'earn' and subscription_id is not null;

-- Recover deleted order_products from Stripe Checkout line items.
-- Run this in the Supabase SQL editor BEFORE the Node recovery script.
-- The script writes ONLY to order_products_recovery_staging — never to order_products.

create table if not exists public.order_products_recovery_staging (
  id bigint generated always as identity primary key,
  order_id bigint not null,
  stripe_line_item_description text,
  matched_product_id bigint,
  matched_product_slug text,
  quantity bigint,
  unit_price_cents bigint,
  match_confidence text, -- 'exact', 'fuzzy', 'no_match'
  notes text,
  created_at timestamptz default now()
);

create index if not exists order_products_recovery_staging_order_id_idx
  on public.order_products_recovery_staging (order_id);

-- Staging holds real customer line items. Keep it private; the recovery script
-- uses the service role, which bypasses RLS.
alter table public.order_products_recovery_staging enable row level security;

revoke all on public.order_products_recovery_staging from anon, authenticated;

-- ============================================================================
-- Review queries — run AFTER the recovery script finishes
-- ============================================================================

-- 1) Totals
select
  count(*) as staging_rows,
  count(distinct order_id) as orders_in_staging,
  count(*) filter (where match_confidence = 'exact') as exact_matches,
  count(*) filter (where match_confidence = 'fuzzy') as fuzzy_matches,
  count(*) filter (where match_confidence = 'no_match') as no_matches
from public.order_products_recovery_staging;

-- 2) Fuzzy + no_match rows that need a human look
select
  id,
  order_id,
  stripe_line_item_description,
  matched_product_id,
  matched_product_slug,
  quantity,
  unit_price_cents,
  match_confidence,
  notes
from public.order_products_recovery_staging
where match_confidence in ('fuzzy', 'no_match')
order by match_confidence, order_id, id;

-- 3) Per-order reconstructed HST total vs orders.total_cents
--
-- recovered_with_hst_cents = sum(quantity * unit_price_cents * 1.13)
-- using the catalog price we staged (not Stripe's charged amount).
--
-- Expected non-zero deltas (not necessarily bugs):
--   delivery = true            → Stripe total includes a delivery-fee line we skipped
--   credit_applied_cents > 0   → store credit reduced the charged total
--   referral_code is set       → promo/referral discounted the Stripe amount
--   catalog price changed      → we used today's products.price_cents
select
  o.id as order_id,
  o.total_cents as order_total_cents,
  coalesce(sum(s.quantity * coalesce(s.unit_price_cents, 0)), 0) as recovered_pre_tax_cents,
  round(coalesce(sum(s.quantity * coalesce(s.unit_price_cents, 0) * 1.13), 0)) as recovered_with_hst_cents,
  o.total_cents
    - round(coalesce(sum(s.quantity * coalesce(s.unit_price_cents, 0) * 1.13), 0)) as delta_cents,
  o.delivery,
  o.credit_applied_cents,
  o.referral_code,
  count(*) as staging_line_items,
  count(*) filter (where s.match_confidence = 'fuzzy') as fuzzy_lines,
  count(*) filter (where s.match_confidence = 'no_match') as no_match_lines
from public.orders o
join public.order_products_recovery_staging s on s.order_id = o.id
group by o.id
order by abs(
  o.total_cents
  - round(coalesce(sum(s.quantity * coalesce(s.unit_price_cents, 0) * 1.13), 0))
) desc, o.id;

-- 4) Live-mode orders that still have no staging rows (failed Stripe calls, or skipped)
select
  o.id,
  o.stripe_session_id,
  o.total_cents,
  o.created_at
from public.orders o
left join public.order_products_recovery_staging s on s.order_id = o.id
where o.stripe_session_id like 'cs_live_%'
  and o.id <> 363
group by o.id
having count(s.id) = 0
order by o.id;

-- DO NOT run the final insert into order_products until staging has been reviewed.
-- That commit is a separate, deliberate step.

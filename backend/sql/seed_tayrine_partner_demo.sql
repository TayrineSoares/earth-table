-- Demo data for Tayrine Soares / JOSH15 so Admin → Partners expand has rows.
-- Safe to re-run: deletes previous seed-* orders/ledger/invoice first.
-- Run in the Supabase SQL editor.

do $$
declare
  v_partner uuid := '4b5121a4-8a69-449e-a0ca-18ca98795070';
  v_july date := '2026-07-01';
  v_aug date := '2026-08-01';
  v_inv uuid;
  o_maya int;
  o_sam int;
  o_priya int;
  o_jordan int;
begin
  -- Remove prior demo rows (ledger first because of FKs)
  delete from public.partner_ledger
  where order_id in (
    select id from public.orders where stripe_session_id like 'seed-josh15-%'
  );

  delete from public.partner_invoices
  where partner_id = v_partner
    and period_year = 2026
    and period_month = 7
    and emailed_at is null;

  delete from public.order_products
  where order_id in (
    select id from public.orders where stripe_session_id like 'seed-josh15-%'
  );

  delete from public.orders
  where stripe_session_id like 'seed-josh15-%';

  -- July (closed month): cash + credit
  insert into public.orders (
    buyer_email, buyer_name, buyer_phone_number, status, stripe_session_id,
    total_cents, item_subtotal_cents, referral_partner_id, referral_code,
    pickup_date, pickup_time_slot, delivery, created_at
  ) values (
    'maya.seed@example.com', 'Maya Chen', '4165550101', 'paid', 'seed-josh15-maya',
    9040, 8000, v_partner, 'JOSH15',
    '2026-07-12', '10:00-13:00', false, '2026-07-08 14:22:00-04'
  ) returning id into o_maya;

  insert into public.orders (
    buyer_email, buyer_name, buyer_phone_number, status, stripe_session_id,
    total_cents, item_subtotal_cents, referral_partner_id, referral_code,
    pickup_date, pickup_time_slot, delivery, created_at
  ) values (
    'sam.seed@example.com', 'Sam Rivera', '4165550102', 'paid', 'seed-josh15-sam',
    5650, 5000, v_partner, 'JOSH15',
    '2026-07-22', '10:00-13:00', false, '2026-07-19 11:05:00-04'
  ) returning id into o_sam;

  -- August (open month): cash + credit, still pending
  insert into public.orders (
    buyer_email, buyer_name, buyer_phone_number, status, stripe_session_id,
    total_cents, item_subtotal_cents, referral_partner_id, referral_code,
    pickup_date, pickup_time_slot, delivery, created_at
  ) values (
    'priya.seed@example.com', 'Priya Patel', '4165550103', 'paid', 'seed-josh15-priya',
    13560, 12000, v_partner, 'JOSH15',
    '2026-08-16', '10:00-13:00', false, '2026-08-12 16:40:00-04'
  ) returning id into o_priya;

  insert into public.orders (
    buyer_email, buyer_name, buyer_phone_number, status, stripe_session_id,
    total_cents, item_subtotal_cents, referral_partner_id, referral_code,
    pickup_date, pickup_time_slot, delivery, created_at
  ) values (
    'jordan.seed@example.com', 'Jordan Lee', '4165550104', 'paid', 'seed-josh15-jordan',
    6780, 6000, v_partner, 'JOSH15',
    '2026-08-21', '10:00-13:00', false, '2026-08-17 09:18:00-04'
  ) returning id into o_jordan;

  insert into public.partner_invoices (
    partner_id, period_year, period_month, cash_cents, credit_cents, total_cents, status
  ) values (
    v_partner, 2026, 7, 800, 500, 1300, 'unpaid'
  ) returning id into v_inv;

  -- 10% of pre-discount item subtotal
  insert into public.partner_ledger (
    partner_id, kind, order_id, amount_cents, payout_type, status, accrual_month, invoice_id
  ) values
    (v_partner, 'earn', o_maya,   800,  'cash',   'available', v_july, v_inv),
    (v_partner, 'earn', o_sam,    500,  'credit', 'available', v_july, v_inv),
    (v_partner, 'earn', o_priya,  1200, 'cash',   'pending',   v_aug,  null),
    (v_partner, 'earn', o_jordan, 600,  'credit', 'pending',   v_aug,  null);
end $$;

select
  o.id as order_id,
  o.buyer_name,
  o.item_subtotal_cents,
  o.created_at,
  l.payout_type,
  l.status,
  l.amount_cents,
  l.accrual_month
from public.partner_ledger l
join public.orders o on o.id = l.order_id
where o.stripe_session_id like 'seed-josh15-%'
order by o.created_at;

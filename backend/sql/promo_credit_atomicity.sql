-- Atomic promo use + store-credit redeem (run in Supabase SQL editor).
-- App falls back to optimistic updates if these RPCs are missing.
-- Wallet math matches getWalletTotalsByPartnerIds in partner.js.

create or replace function public.increment_promo_used_count(p_id uuid)
returns public.promo_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.promo_codes;
begin
  update public.promo_codes
  set used_count = coalesce(used_count, 0) + 1
  where id = p_id
    and (max_uses is null or coalesce(used_count, 0) < max_uses)
  returning * into row;

  return row;
end;
$$;

revoke all on function public.increment_promo_used_count(uuid) from public;
grant execute on function public.increment_promo_used_count(uuid) to service_role;

create or replace function public.redeem_partner_credit(
  p_partner_id uuid,
  p_order_id int,
  p_requested_cents integer
)
returns public.partner_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  available integer;
  amount integer;
  row public.partner_ledger;
begin
  if p_partner_id is null or p_order_id is null or coalesce(p_requested_cents, 0) <= 0 then
    return null;
  end if;

  -- Serialize redeems for this partner
  perform 1 from public.partners where id = p_partner_id for update;

  select greatest(
    0,
    coalesce((
      select sum(amount_cents)::integer
      from public.partner_ledger
      where partner_id = p_partner_id
        and kind = 'earn'
        and payout_type = 'credit'
        and status = 'available'
    ), 0)
    - coalesce((
      select sum(amount_cents)::integer
      from public.partner_ledger
      where partner_id = p_partner_id
        and kind = 'redeem'
    ), 0)
  ) into available;

  amount := least(p_requested_cents, available);
  if amount <= 0 then
    return null;
  end if;

  insert into public.partner_ledger (
    partner_id, kind, order_id, amount_cents, payout_type, status, accrual_month
  ) values (
    p_partner_id, 'redeem', p_order_id, amount, 'credit', 'applied', null
  )
  returning * into row;

  return row;
exception
  when unique_violation then
    return null;
end;
$$;

revoke all on function public.redeem_partner_credit(uuid, int, integer) from public;
grant execute on function public.redeem_partner_credit(uuid, int, integer) to service_role;

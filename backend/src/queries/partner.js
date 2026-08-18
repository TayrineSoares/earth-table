/**
 * Partner lookups and writes (Supabase `partners` table).
 *
 * Referral codes are stored uppercase and matched case-insensitively.
 * Wallet totals are computed from partner_ledger / partner_invoices (no cached balance).
 */

const supabase = require('../../supabase/db');
const { getUserByAuthId } = require('./user');

const REFERRAL_PERCENT = 15;
const CASHBACK_PERCENT = 10;
const MIN_SUBTOTAL_CENTS = 5000;

function normalizeReferralCode(raw) {
  return (raw || '').trim().toUpperCase();
}

class PartnerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'PartnerError';
    this.status = status;
  }
}

function emptyWallet() {
  return {
    pending_cents: 0,
    available_credit_cents: 0,
    unpaid_cash_cents: 0,
    current_month_cents: 0,
    current_month_cash_cents: 0,
    current_month_credit_cents: 0,
    cashback_cents: 0,
    total_earn_cents: 0,
  };
}

function displayPartner(row, extras = {}) {
  if (!row) return null;
  return {
    ...row,
    referral_code: normalizeReferralCode(row.referral_code),
    ...extras,
  };
}

async function getPromoByCode(code) {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('id, code')
    .ilike('code', code)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getPartnerByCode(rawCode) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;

  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .ilike('referral_code', code)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getPartnerById(id) {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getPartnerByUserId(userId) {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getUsersByAuthIds(authUserIds) {
  const ids = [...new Set((authUserIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('users')
    .select('auth_user_id, email, first_name, last_name, phone_number')
    .in('auth_user_id', ids);

  if (error) throw error;
  return Object.fromEntries((data || []).map((u) => [u.auth_user_id, u]));
}

async function getWalletTotalsByPartnerIds(partnerIds) {
  const ids = [...new Set((partnerIds || []).filter(Boolean))];
  const totals = Object.fromEntries(ids.map((id) => [id, emptyWallet()]));
  if (!ids.length) return totals;

  const { data: ledger, error: ledgerErr } = await supabase
    .from('partner_ledger')
    .select('partner_id, kind, status, payout_type, amount_cents, accrual_month')
    .in('partner_id', ids);

  if (ledgerErr) throw ledgerErr;

  const thisMonth = torontoMonthStart();

  for (const row of ledger || []) {
    const bag = totals[row.partner_id];
    if (!bag) continue;
    const amount = Number(row.amount_cents) || 0;
    if (row.kind === 'earn') {
      bag.total_earn_cents += amount;
      if (row.status === 'pending') bag.pending_cents += amount;
    }
    if (row.kind === 'earn' && row.status === 'available' && row.payout_type === 'credit') {
      bag.available_credit_cents += amount;
    }
    if (row.kind === 'redeem') {
      bag.available_credit_cents -= amount;
    }
    if (row.kind === 'earn' && monthKeyFromDate(row.accrual_month) === thisMonth.slice(0, 7)) {
      bag.current_month_cents += amount;
      if (row.payout_type === 'credit') bag.current_month_credit_cents += amount;
      else bag.current_month_cash_cents += amount;
    }
  }

  const { data: invoices, error: invErr } = await supabase
    .from('partner_invoices')
    .select('partner_id, payout_type, cash_cents, credit_cents, status, total_cents')
    .in('partner_id', ids);

  if (invErr) throw invErr;

  for (const inv of invoices || []) {
    const bag = totals[inv.partner_id];
    if (!bag) continue;
    const cashOwed = invoiceCashCents(inv);
    if (cashOwed > 0 && inv.status === 'unpaid') {
      bag.unpaid_cash_cents += cashOwed;
    }
  }

  for (const bag of Object.values(totals)) {
    bag.pending_cents = Math.max(0, bag.pending_cents);
    bag.available_credit_cents = Math.max(0, bag.available_credit_cents);
    bag.unpaid_cash_cents = Math.max(0, bag.unpaid_cash_cents);
    bag.current_month_cents = Math.max(0, bag.current_month_cents);
    bag.current_month_cash_cents = Math.max(0, bag.current_month_cash_cents);
    bag.current_month_credit_cents = Math.max(0, bag.current_month_credit_cents);
    bag.cashback_cents = bag.pending_cents + bag.unpaid_cash_cents;
    bag.total_earn_cents = Math.max(0, bag.total_earn_cents);
  }

  return totals;
}

async function getLatestInvoiceStatusByPartnerIds(partnerIds) {
  const ids = [...new Set((partnerIds || []).filter(Boolean))];
  const latest = {};
  if (!ids.length) return latest;

  const { data, error } = await supabase
    .from('partner_invoices')
    .select('partner_id, status, created_at')
    .in('partner_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const inv of data || []) {
    if (!latest[inv.partner_id]) latest[inv.partner_id] = inv.status;
  }
  return latest;
}

async function listPartners() {
  const { data: partners, error } = await supabase
    .from('partners')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const rows = partners || [];
  const ids = rows.map((p) => p.id);
  const [usersByAuth, wallets, latestStatus] = await Promise.all([
    getUsersByAuthIds(rows.map((p) => p.user_id)),
    getWalletTotalsByPartnerIds(ids),
    getLatestInvoiceStatusByPartnerIds(ids),
  ]);

  return rows.map((p) =>
    displayPartner(p, {
      user: usersByAuth[p.user_id] || null,
      ...(wallets[p.id] || emptyWallet()),
      latest_invoice_status: latestStatus[p.id] || null,
    })
  );
}

async function getPartnerWalletByUserId(userId) {
  const partner = await getPartnerByUserId(userId);
  if (!partner) return null;

  const [usersByAuth, wallets, latestStatus] = await Promise.all([
    getUsersByAuthIds([partner.user_id]),
    getWalletTotalsByPartnerIds([partner.id]),
    getLatestInvoiceStatusByPartnerIds([partner.id]),
  ]);

  return displayPartner(partner, {
    user: usersByAuth[partner.user_id] || null,
    ...(wallets[partner.id] || emptyWallet()),
    latest_invoice_status: latestStatus[partner.id] || null,
  });
}

function monthKeyFromDate(value) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const [year, month] = raw.split('-');
  if (!year || !month) return null;
  return `${year}-${month}`;
}

function monthKeyFromPeriod(year, month) {
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabelFromKey(key) {
  if (!key) return '—';
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function invoiceCashCents(inv) {
  if (!inv) return 0;
  if (inv.cash_cents != null && inv.cash_cents !== '') {
    return Math.max(0, Number(inv.cash_cents) || 0);
  }
  if (inv.payout_type === 'cash') return Math.max(0, Number(inv.total_cents) || 0);
  return 0;
}

function invoiceCreditCents(inv) {
  if (!inv) return 0;
  if (inv.credit_cents != null && inv.credit_cents !== '') {
    return Math.max(0, Number(inv.credit_cents) || 0);
  }
  if (inv.payout_type === 'credit') return Math.max(0, Number(inv.total_cents) || 0);
  return 0;
}

function normalizeInvoiceRow(inv) {
  if (!inv) return null;
  const cashCents = invoiceCashCents(inv);
  const creditCents = invoiceCreditCents(inv);
  const totalCents = Math.max(0, Number(inv.total_cents) || 0) || cashCents + creditCents;
  return {
    ...inv,
    cash_cents: cashCents,
    credit_cents: creditCents,
    total_cents: totalCents,
  };
}

function emptyMonth(key) {
  return {
    period: key,
    label: monthLabelFromKey(key),
    earn_cents: 0,
    pending_cents: 0,
    cash_cents: 0,
    credit_cents: 0,
    invoice: null,
    orders: [],
  };
}

function buildMonthBreakdown(ledger = [], invoices = [], ordersById = {}) {
  const months = {};

  for (const row of ledger) {
    if (row.kind !== 'earn') continue;
    const key = monthKeyFromDate(row.accrual_month);
    if (!key) continue;
    if (!months[key]) months[key] = emptyMonth(key);

    const amount = Number(row.amount_cents) || 0;
    months[key].earn_cents += amount;
    if (row.status === 'pending') months[key].pending_cents += amount;
    if (row.payout_type === 'credit') months[key].credit_cents += amount;
    else months[key].cash_cents += amount;

    const order = ordersById[row.order_id] || {};
    months[key].orders.push({
      order_id: row.order_id,
      amount_cents: amount,
      status: row.status,
      payout_type: row.payout_type,
      customer_name: order.buyer_name || '—',
      item_subtotal_cents: order.item_subtotal_cents ?? null,
      order_date: order.created_at || null,
    });
  }

  for (const inv of invoices) {
    const key = monthKeyFromPeriod(inv.period_year, inv.period_month);
    if (!key) continue;
    if (!months[key]) months[key] = emptyMonth(key);
    months[key].invoice = normalizeInvoiceRow(inv);
  }

  return Object.keys(months)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((key) => {
      const month = months[key];
      month.orders.sort((a, b) => {
        const ta = a.order_date ? new Date(a.order_date).getTime() : 0;
        const tb = b.order_date ? new Date(b.order_date).getTime() : 0;
        return ta - tb;
      });
      return month;
    });
}

async function getPartnerAdminDetail(id) {
  const partner = await getPartnerById(id);
  if (!partner) return null;

  const [usersByAuth, wallets, latestStatus, invoicesRes, ledgerRes] = await Promise.all([
    getUsersByAuthIds([partner.user_id]),
    getWalletTotalsByPartnerIds([partner.id]),
    getLatestInvoiceStatusByPartnerIds([partner.id]),
    supabase
      .from('partner_invoices')
      .select('id, period_year, period_month, payout_type, cash_cents, credit_cents, total_cents, status, paid_at, created_at')
      .eq('partner_id', partner.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false }),
    supabase
      .from('partner_ledger')
      .select('kind, order_id, amount_cents, payout_type, status, accrual_month, invoice_id, created_at')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false }),
  ]);

  if (invoicesRes.error) throw invoicesRes.error;
  if (ledgerRes.error) throw ledgerRes.error;

  const invoices = invoicesRes.data || [];
  const ledger = ledgerRes.data || [];

  const orderIds = [...new Set(
    ledger.filter((row) => row.kind === 'earn' && row.order_id).map((row) => row.order_id)
  )];
  let ordersById = {};
  if (orderIds.length) {
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, buyer_name, item_subtotal_cents, created_at')
      .in('id', orderIds);
    if (ordersErr) throw ordersErr;
    ordersById = Object.fromEntries((orders || []).map((o) => [o.id, o]));
  }

  return displayPartner(partner, {
    user: usersByAuth[partner.user_id] || null,
    ...(wallets[partner.id] || emptyWallet()),
    latest_invoice_status: latestStatus[partner.id] || null,
    invoices,
    months: buildMonthBreakdown(ledger, invoices, ordersById),
  });
}

async function createPartner({ user_id: userId, referral_code: rawCode }) {
  if (!userId) {
    throw new PartnerError('user_id is required.');
  }

  const referralCode = normalizeReferralCode(rawCode);
  if (!referralCode) {
    throw new PartnerError('referral_code is required.');
  }

  const user = await getUserByAuthId(userId);
  if (!user) {
    throw new PartnerError('User not found.', 404);
  }

  const existingForUser = await getPartnerByUserId(userId);
  if (existingForUser) {
    throw new PartnerError('This user is already a partner.', 409);
  }

  const existingCode = await getPartnerByCode(referralCode);
  if (existingCode) {
    throw new PartnerError('That referral code is already in use.', 409);
  }

  const collidingPromo = await getPromoByCode(referralCode);
  if (collidingPromo) {
    throw new PartnerError('Referral code collides with an existing promo code.');
  }

  const { data, error } = await supabase
    .from('partners')
    .insert([{
      user_id: userId,
      referral_code: referralCode,
      active: true,
      payout_type: 'cash',
    }])
    .select('*')
    .single();

  if (error) {
    const msg = error.message || '';
    if (error.code === '23505') {
      throw new PartnerError(
        /user_id/i.test(msg)
          ? 'This user is already a partner.'
          : 'That referral code is already in use.',
        409
      );
    }
    if (/collides with an existing promo code/i.test(msg)) {
      throw new PartnerError('Referral code collides with an existing promo code.');
    }
    throw error;
  }

  return displayPartner(data, {
    user: {
      auth_user_id: user.auth_user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
    },
    ...emptyWallet(),
    latest_invoice_status: null,
  });
}

async function updatePartner(id, { active, referral_code: rawCode } = {}) {
  const existing = await getPartnerById(id);
  if (!existing) {
    throw new PartnerError('Partner not found.', 404);
  }

  const patch = {};

  if (typeof active === 'boolean') {
    patch.active = active;
  }

  if (rawCode != null) {
    const referralCode = normalizeReferralCode(rawCode);
    if (!referralCode) {
      throw new PartnerError('referral_code is required.');
    }
    if (referralCode !== normalizeReferralCode(existing.referral_code)) {
      const existingCode = await getPartnerByCode(referralCode);
      if (existingCode && existingCode.id !== id) {
        throw new PartnerError('That referral code is already in use.', 409);
      }
      const collidingPromo = await getPromoByCode(referralCode);
      if (collidingPromo) {
        throw new PartnerError('Referral code collides with an existing promo code.');
      }
      patch.referral_code = referralCode;
    }
  }

  if (!Object.keys(patch).length) {
    return displayPartner(existing);
  }

  const { data, error } = await supabase
    .from('partners')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    const msg = error.message || '';
    if (error.code === '23505') {
      throw new PartnerError('That referral code is already in use.', 409);
    }
    if (/collides with an existing promo code/i.test(msg)) {
      throw new PartnerError('Referral code collides with an existing promo code.');
    }
    throw error;
  }
  return displayPartner(data);
}

async function setPartnerActive(id, active) {
  return updatePartner(id, { active });
}

async function userHasAnyOrder(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Look up a referral code and run partner-program rules.
 * `found: false` means this is not a partner code — caller should try promo_codes.
 */
async function getActiveReferralByCode(rawCode, userId = null, subtotalCents = null) {
  const code = normalizeReferralCode(rawCode);
  if (!code) {
    return { ok: false, found: false, message: 'Referral code is required.' };
  }

  const partner = await getPartnerByCode(code);
  if (!partner) {
    return { ok: false, found: false, message: 'Invalid referral code.' };
  }

  if (!partner.active) {
    return { ok: false, found: true, message: 'This referral code is inactive.' };
  }

  if (!userId) {
    return {
      ok: false,
      found: true,
      message: 'Register with Earth Table and sign in to use a referral code.',
    };
  }

  if (userId === partner.user_id) {
    return { ok: false, found: true, message: "You can't use your own referral code." };
  }

  if (await userHasAnyOrder(userId)) {
    return {
      ok: false,
      found: true,
      message: 'Referral codes are only for first-time customers.',
    };
  }

  if (subtotalCents != null && (!Number.isFinite(subtotalCents) || subtotalCents < MIN_SUBTOTAL_CENTS)) {
    return {
      ok: false,
      found: true,
      message: 'Referral codes require an item subtotal of at least $50 (before tax and delivery).',
    };
  }

  return {
    ok: true,
    found: true,
    partner,
    discountPercentage: REFERRAL_PERCENT,
  };
}

function torontoMonthStart(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}-01`;
}

async function setPayoutPreference(userId, payoutType) {
  const nextType = payoutType === 'credit' ? 'credit' : payoutType === 'cash' ? 'cash' : null;
  if (!nextType) {
    throw new PartnerError('payout_type must be cash or credit.');
  }
  if (!userId) {
    throw new PartnerError('user_id is required.');
  }

  const partner = await getPartnerByUserId(userId);
  if (!partner) {
    throw new PartnerError('Partner not found.', 404);
  }

  if (nextType === partner.payout_type) {
    throw new PartnerError(`Payout type is already ${nextType}.`);
  }

  const { error } = await supabase
    .from('partners')
    .update({
      payout_type: nextType,
      pending_payout_type: null,
      pending_payout_effective_on: null,
    })
    .eq('id', partner.id);

  if (error) throw error;
  return getPartnerWalletByUserId(userId);
}

async function recordReferralEarn({ partnerId, orderId, itemSubtotalCents, payoutType }) {
  const amountCents = Math.floor((Number(itemSubtotalCents) || 0) * CASHBACK_PERCENT / 100);
  if (!partnerId || !orderId || amountCents <= 0) return null;

  const { data, error } = await supabase
    .from('partner_ledger')
    .insert([{
      partner_id: partnerId,
      kind: 'earn',
      order_id: orderId,
      amount_cents: amountCents,
      payout_type: payoutType === 'credit' ? 'credit' : 'cash',
      status: 'pending',
      accrual_month: torontoMonthStart(),
    }])
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  return data;
}

async function recordCreditRedeem({ partnerId, orderId, requestedCents }) {
  const requested = Math.floor(Number(requestedCents) || 0);
  if (!partnerId || !orderId || requested <= 0) return null;

  const wallets = await getWalletTotalsByPartnerIds([partnerId]);
  const available = Math.max(0, wallets[partnerId]?.available_credit_cents || 0);
  const amountCents = Math.min(requested, available);

  if (amountCents <= 0) {
    console.warn('[recordCreditRedeem] skipped — no available credit for order', orderId);
    return null;
  }
  if (amountCents < requested) {
    console.warn('[recordCreditRedeem] short credit on order', orderId, {
      requested,
      applied: amountCents,
    });
  }

  const { data, error } = await supabase
    .from('partner_ledger')
    .insert([{
      partner_id: partnerId,
      kind: 'redeem',
      order_id: orderId,
      amount_cents: amountCents,
      payout_type: 'credit',
      status: 'applied',
      accrual_month: null,
    }])
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  return data;
}

module.exports = {
  PartnerError,
  REFERRAL_PERCENT,
  CASHBACK_PERCENT,
  MIN_SUBTOTAL_CENTS,
  STRIPE_MIN_CENTS: 50,
  normalizeReferralCode,
  getPartnerByCode,
  getPartnerById,
  getPartnerByUserId,
  listPartners,
  getPartnerWalletByUserId,
  getPartnerAdminDetail,
  createPartner,
  updatePartner,
  setPartnerActive,
  getActiveReferralByCode,
  recordReferralEarn,
  recordCreditRedeem,
  setPayoutPreference,
};

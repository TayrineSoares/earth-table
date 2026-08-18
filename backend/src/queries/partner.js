/**
 * Partner lookups and writes (Supabase `partners` table).
 *
 * Referral codes are stored uppercase and matched case-insensitively.
 * Wallet totals are computed from partner_ledger / partner_invoices (no cached balance).
 */

const supabase = require('../../supabase/db');
const { getUserByAuthId } = require('./user');

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
    .select('partner_id, kind, status, payout_type, amount_cents')
    .in('partner_id', ids);

  if (ledgerErr) throw ledgerErr;

  for (const row of ledger || []) {
    const bag = totals[row.partner_id];
    if (!bag) continue;
    const amount = Number(row.amount_cents) || 0;
    if (row.kind === 'earn' && row.status === 'pending') {
      bag.pending_cents += amount;
    }
    if (row.kind === 'earn' && row.status === 'available' && row.payout_type === 'credit') {
      bag.available_credit_cents += amount;
    }
    if (row.kind === 'redeem') {
      bag.available_credit_cents -= amount;
    }
  }

  const { data: invoices, error: invErr } = await supabase
    .from('partner_invoices')
    .select('partner_id, payout_type, status, total_cents')
    .in('partner_id', ids);

  if (invErr) throw invErr;

  for (const inv of invoices || []) {
    const bag = totals[inv.partner_id];
    if (!bag) continue;
    if (inv.payout_type === 'cash' && inv.status === 'unpaid') {
      bag.unpaid_cash_cents += Number(inv.total_cents) || 0;
    }
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

async function setPartnerActive(id, active) {
  if (typeof active !== 'boolean') {
    throw new PartnerError('active must be a boolean.');
  }

  const existing = await getPartnerById(id);
  if (!existing) {
    throw new PartnerError('Partner not found.', 404);
  }

  const { data, error } = await supabase
    .from('partners')
    .update({ active })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return displayPartner(data);
}

module.exports = {
  PartnerError,
  normalizeReferralCode,
  getPartnerByCode,
  getPartnerById,
  getPartnerByUserId,
  listPartners,
  getPartnerWalletByUserId,
  createPartner,
  setPartnerActive,
};

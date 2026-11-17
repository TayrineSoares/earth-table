/**
 * Promo code lookups and updates (Supabase `promo_codes` table).
 *
 * Used by:
 * - POST /promo/validate (cart "Apply")
 * - create-checkout-session (must match validate rules so users can't bypass the UI)
 *
 * `used_count` is bumped only after payment succeeds (webhook), not when validating.
 */

const supabase = require('../../supabase/db');

/** Trim user input so " SUMMER " matches the same code as "summer". */
const normalize = (code) => (code || '').trim();

/** Escape `%` / `_` so ilike is case-insensitive exact match, not a wildcard search. */
function escapeIlikeExact(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

async function findPromoByCodeExact(rawCode) {
  const code = normalize(rawCode);
  if (!code) return null;

  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .ilike('code', escapeIlikeExact(code))
    .limit(10);

  if (error) throw error;
  const needle = code.toLowerCase();
  return (data || []).find((row) => String(row.code || '').toLowerCase() === needle) || null;
}

/**
 * Look up a promo by code and run all business rules.
 *
 * @param {string} rawCode - what the customer typed
 * @param {string|null|undefined} userId - Supabase Auth user id from the session (if logged in)
 * @returns {{ ok: true, promo: object } | { ok: false, message: string }}
 */
async function getActivePromoByCode(rawCode, userId = null) {
  const code = normalize(rawCode);
  if (!code) {
    return { ok: false, message: 'Promo code is required.' };
  }

  const promo = await findPromoByCodeExact(code);
  if (!promo) {
    return { ok: false, message: 'Invalid promo code.' };
  }

  if (!promo.active) {
    return { ok: false, message: 'This promo code is inactive.' };
  }

  if (promo.expires_at != null) {
    const expiresMs = new Date(promo.expires_at).getTime();
    if (Number.isFinite(expiresMs) && expiresMs < Date.now()) {
      return { ok: false, message: 'This promo code has expired.' };
    }
  }

  if (promo.max_uses != null && Number(promo.used_count || 0) >= Number(promo.max_uses)) {
    return { ok: false, message: 'This promo code has reached its usage limit.' };
  }

  // Capped promos and "first order only" both need a stable account (not a guest checkout).
  const needsLoggedInUser = promo.max_uses != null || promo.first_time_only;
  if (needsLoggedInUser && !userId) {
    return { ok: false, message: 'Sign in to use this promo code' };
  }

  if (promo.first_time_only) {
    const hasPriorOrder = await userHasNonCancelledOrder(userId);
    if (hasPriorOrder) {
      return { ok: false, message: 'This promo is only for first-time customers.' };
    }
  }

  return { ok: true, promo };
}

/**
 * True if this user already has at least one order we treat as "real"
 * (status is null, or anything other than cancelled).
 * Cancelled-only histories still count as "no prior order" for first-time promos.
 */
async function userHasNonCancelledOrder(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .or('status.is.null,status.neq.cancelled')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Run after Stripe confirms payment (webhook). Do not call from /promo/validate.
 *
 * Prefer RPC `increment_promo_used_count` (atomic). Falls back to optimistic
 * used_count compare so concurrent webhooks cannot both bump past max_uses.
 */
async function incrementPromoUsedCount(id) {
  if (!id) return;

  const { data: rpcData, error: rpcErr } = await supabase.rpc('increment_promo_used_count', {
    p_id: id,
  });
  if (!rpcErr) return rpcData;

  // Undefined function / not migrated yet — fall back.
  if (rpcErr.code !== 'PGRST202' && !/increment_promo_used_count/i.test(rpcErr.message || '')) {
    throw rpcErr;
  }

  const { data, error: selErr } = await supabase
    .from('promo_codes')
    .select('used_count, max_uses')
    .eq('id', id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (!data) return;

  const current = Number(data.used_count || 0);
  const maxUses = data.max_uses == null ? null : Number(data.max_uses);
  if (maxUses != null && current >= maxUses) return;

  let q = supabase
    .from('promo_codes')
    .update({ used_count: current + 1 })
    .eq('id', id)
    .eq('used_count', current);
  if (maxUses != null) q = q.lt('used_count', maxUses);

  const { error } = await q;
  if (error) throw error;
}

async function listPromoCodes() {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createPromoCode(payload) {
  const { data, error } = await supabase
    .from('promo_codes')
    .insert([payload])
    .select()
    .single();
  if (error) {
    const err = new Error(error.message || 'Failed to create promo code.');
    err.status = 400;
    throw err;
  }
  return data;
}

async function updatePromoCode(id, patch) {
  const { data, error } = await supabase
    .from('promo_codes')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error('Promo code not found.');
    err.status = 404;
    throw err;
  }
  return data;
}

async function deletePromoCode(id) {
  const { error } = await supabase
    .from('promo_codes')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { ok: true };
}

module.exports = {
  getActivePromoByCode,
  normalize,
  escapeIlikeExact,
  findPromoByCodeExact,
  incrementPromoUsedCount,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
};

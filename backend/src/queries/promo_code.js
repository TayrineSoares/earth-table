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

  const { data: promo, error } = await supabase
    .from('promo_codes')
    .select('*')
    .ilike('code', code)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
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
 * Uses read-then-update because the JS client cannot send SQL like `used_count = used_count + 1`
 * in a single patch without a database RPC.
 */
async function incrementPromoUsedCount(id) {
  const { data, error: selErr } = await supabase
    .from('promo_codes')
    .select('used_count')
    .eq('id', id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (!data) return;

  const { error } = await supabase
    .from('promo_codes')
    .update({ used_count: Number(data.used_count || 0) + 1 })
    .eq('id', id);

  if (error) throw error;
}

module.exports = { getActivePromoByCode, normalize, incrementPromoUsedCount };

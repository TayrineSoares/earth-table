/**
 * Backfill last_decline_code / last_decline_at for payment_failed pauses.
 *
 * Needs a LIVE Stripe secret (sk_live_…) in STRIPE_SECRET_SK — local .env is
 * often sk_test_ and cannot see production customers.
 *
 *   cd backend && node scripts/backfill-last-decline.js
 */
require('dotenv').config();
const supabase = require('../supabase/db');
const Stripe = require('stripe');

function declineFromPi(pi) {
  const err = pi?.last_payment_error;
  if (!err) return null;
  return err.decline_code || err.code || null;
}

async function main() {
  const key = process.env.STRIPE_SECRET_SK || '';
  if (!key.startsWith('sk_live_')) {
    console.error('STRIPE_SECRET_SK must be sk_live_… for this backfill (got test/missing).');
    process.exit(1);
  }
  const stripe = Stripe(key);

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id, paused_at, stripe_customer_id, stripe_payment_method_id, last_decline_code, last_decline_at')
    .eq('status', 'paused')
    .eq('pause_reason', 'payment_failed');
  if (error) throw error;

  let updated = 0;
  for (const sub of subs || []) {
    if (sub.last_decline_code && sub.last_decline_at) {
      console.log('skip (already set)', sub.id);
      continue;
    }
    if (!sub.stripe_customer_id) {
      console.log('skip (no customer)', sub.id);
      continue;
    }

    let list;
    try {
      list = await stripe.paymentIntents.list({
        customer: sub.stripe_customer_id,
        limit: 30,
      });
    } catch (err) {
      console.warn('stripe list failed', sub.id, err.message);
      continue;
    }

    const candidates = (list.data || [])
      .filter((pi) => pi.last_payment_error)
      .sort((a, b) => (b.created || 0) - (a.created || 0));

    const match = candidates.find((pi) => (
      !sub.stripe_payment_method_id
      || pi.payment_method === sub.stripe_payment_method_id
      || pi.last_payment_error?.payment_method?.id === sub.stripe_payment_method_id
    )) || candidates[0];

    if (!match) {
      // Timestamp only from paused_at if we have no PI.
      if (!sub.last_decline_at && sub.paused_at) {
        const { error: upErr } = await supabase
          .from('subscriptions')
          .update({ last_decline_at: sub.paused_at })
          .eq('id', sub.id);
        if (upErr) console.warn('update failed', sub.id, upErr.message);
        else {
          console.log('timestamp only', sub.id);
          updated += 1;
        }
      } else {
        console.log('no failed PI', sub.id);
      }
      continue;
    }

    const code = declineFromPi(match) || 'card_declined';
    const at = new Date((match.created || 0) * 1000).toISOString();
    const { error: upErr } = await supabase
      .from('subscriptions')
      .update({
        last_decline_code: sub.last_decline_code || code,
        last_decline_at: sub.last_decline_at || at,
      })
      .eq('id', sub.id);
    if (upErr) {
      console.warn('update failed', sub.id, upErr.message);
      continue;
    }
    console.log('updated', sub.id, code, at, match.id);
    updated += 1;
  }

  console.log('done, updated', updated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

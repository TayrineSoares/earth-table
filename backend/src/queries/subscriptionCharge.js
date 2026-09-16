/**
 * Thursday extras charge. Meals stay locked in Phase 6; this only bills
 * unpaid add-ons on the Sunday that just passed cutoff.
 */

const supabase = require('../../supabase/db');
const { getSettings } = require('./subscription');
const { getSignupDates } = require('./subscriptionWeek');

const HST = 1.13;

function getStripe() {
  return require('stripe')(process.env.STRIPE_SECRET_SK);
}

async function claimCutoffRun(weekKey, job) {
  const { error } = await supabase
    .from('cutoff_runs')
    .insert({ week_key: weekKey, job });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

function addonDueCents(cycle) {
  const items = cycle.subscription_cycle_items || [];
  let raw = 0;
  for (const item of items) {
    if (item.kind !== 'addon') continue;
    raw += (Number(item.unit_price_cents) || 0) * (Number(item.quantity) || 0);
  }
  const already = Number(cycle.addon_paid_cents) || 0;
  const pct = Number(cycle.promo_percent) || 0;
  // Signup promo still applies to the first extras charge on this cycle.
  const factor = already === 0 && pct > 0 ? (100 - pct) / 100 : 1;
  const discounted = Math.floor(raw * factor);
  return Math.max(0, discounted - already);
}

async function chargeThursdayAddons(now = new Date()) {
  const settings = await getSettings();
  const dates = getSignupDates(now, settings || {});
  const weekKey = dates.locked_delivery_date;
  if (!dates.cutoff_passed || !weekKey) {
    return { ok: true, skipped: true, reason: 'before_lock' };
  }

  const claimed = await claimCutoffRun(weekKey, 'thursday_lock');
  if (!claimed) return { ok: true, skipped: true, week_key: weekKey, charged: 0 };

  const { data, error } = await supabase
    .from('subscription_cycles')
    .select(`
      id, addon_paid_cents, promo_percent, delivery_date,
      subscription_cycle_items ( kind, quantity, unit_price_cents ),
      subscriptions!inner (
        id, status, stripe_customer_id, stripe_payment_method_id
      )
    `)
    .eq('delivery_date', weekKey)
    .eq('status', 'open');
  if (error) throw error;

  const stripe = getStripe();
  let charged = 0;
  let skipped = 0;
  const failures = [];

  for (const cycle of data || []) {
    const sub = cycle.subscriptions;
    if (!sub || sub.status !== 'active') {
      skipped += 1;
      continue;
    }
    const due = addonDueCents(cycle);
    const amount = Math.round(due * HST);
    if (amount < 50) {
      skipped += 1;
      continue;
    }
    if (!sub.stripe_customer_id || !sub.stripe_payment_method_id) {
      failures.push({ cycle_id: cycle.id, error: 'no_card' });
      continue;
    }
    try {
      await stripe.paymentIntents.create({
        amount,
        currency: 'cad',
        customer: sub.stripe_customer_id,
        payment_method: sub.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: 'Weekly plan add-ons',
        metadata: {
          kind: 'subscription_addons',
          subscription_id: sub.id,
          cycle_id: cycle.id,
        },
      }, {
        idempotencyKey: `sub-addon-${cycle.id}-${weekKey}`,
      });
      const paid = Number(cycle.addon_paid_cents) || 0;
      const { error: paidErr } = await supabase
        .from('subscription_cycles')
        .update({ addon_paid_cents: paid + due })
        .eq('id', cycle.id);
      if (paidErr) throw paidErr;
      charged += 1;
    } catch (err) {
      failures.push({ cycle_id: cycle.id, error: err.message || String(err) });
      console.warn('[subscriptions] Thursday add-on charge failed:', cycle.id, err.message);
    }
  }

  await supabase
    .from('cutoff_runs')
    .update({
      finished_at: new Date().toISOString(),
      stats: { charged, skipped, failed: failures.length },
    })
    .eq('week_key', weekKey)
    .eq('job', 'thursday_lock');

  return {
    ok: true,
    week_key: weekKey,
    charged,
    skipped,
    failed: failures.length,
    failures,
  };
}

module.exports = {
  chargeThursdayAddons,
};

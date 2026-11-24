/**
 * Stripe money moves for mid-week pause / plan / fulfillment (before Wed lock).
 * Amounts charged are HST-inclusive: Math.round(preTax * HST).
 * plan_paid_cents / delivery_fee_cents on the cycle stay pre-tax.
 */

const HST = 1.13;

function withHst(preTaxCents) {
  return Math.round((Number(preTaxCents) || 0) * HST);
}

/** Tax-inclusive delta between two pre-tax amounts (matches how PIs were built). */
function hstDelta(fromPreTax, toPreTax) {
  return withHst(fromPreTax) - withHst(toPreTax);
}

function getStripe() {
  return require('stripe')(process.env.STRIPE_SECRET_SK);
}

/**
 * Create a refund. Treats already-fully-refunded PIs as success (idempotent).
 * @returns {{ ok: true, refundedCents: number, alreadyRefunded?: boolean }
 *           | { ok: false, error: string }}
 */
async function createRefund({ paymentIntentId, amountCents, metadata = {} }) {
  if (!paymentIntentId) {
    return { ok: false, error: 'missing_payment_intent' };
  }
  const stripe = getStripe();
  const params = {
    payment_intent: paymentIntentId,
    reason: 'requested_by_customer',
    metadata,
  };
  if (amountCents != null && Number(amountCents) > 0) {
    params.amount = Math.round(Number(amountCents));
  }
  try {
    const refund = await stripe.refunds.create(params);
    return {
      ok: true,
      refundedCents: Number(refund.amount) || (amountCents != null ? Math.round(Number(amountCents)) : 0),
      refundId: refund.id,
    };
  } catch (err) {
    const msg = String(err?.message || err || '');
    const code = err?.code || err?.raw?.code;
    // Idempotent: PI already fully refunded, or amount exceeds remaining.
    if (
      code === 'charge_already_refunded'
      || /already been refunded/i.test(msg)
      || /has already been refunded/i.test(msg)
    ) {
      return { ok: true, refundedCents: amountCents != null ? Math.round(Number(amountCents)) : 0, alreadyRefunded: true };
    }
    console.warn('[subscriptions] refund failed:', paymentIntentId, msg);
    return { ok: false, error: msg || 'refund_failed' };
  }
}

/**
 * Full refund of this week's plan PI + optional mid-week delivery / upgrade PIs.
 * Used for paid+open pause/cancel before lock.
 */
async function refundCyclePaymentIntents(cycle, metadata = {}) {
  const results = [];
  let total = 0;
  const seen = new Set();
  const pis = [
    { id: cycle?.stripe_payment_intent_id, role: 'plan' },
    { id: cycle?.stripe_plan_delta_payment_intent_id, role: 'plan_delta' },
    { id: cycle?.stripe_delivery_payment_intent_id, role: 'delivery' },
  ];
  for (const { id, role } of pis) {
    if (!id || seen.has(String(id))) continue;
    seen.add(String(id));
    const r = await createRefund({
      paymentIntentId: id,
      metadata: { ...metadata, pi_role: role },
    });
    if (!r.ok) return { ok: false, error: r.error, results };
    results.push(r);
    total += Number(r.refundedCents) || 0;
  }
  if (!seen.size) {
    return { ok: false, error: 'no_payment_intent', results };
  }
  return { ok: true, refundedCents: total, results };
}

/**
 * Partial refund of plan-price delta (+ tax).
 * Prefer the mid-week upgrade PI when present (avoids over-refund on later pause),
 * then the Tuesday plan PI.
 */
async function refundPlanDelta(cycle, { fromPreTax, toPreTax, metadata = {} } = {}) {
  const amount = hstDelta(fromPreTax, toPreTax);
  if (amount <= 0) return { ok: true, refundedCents: 0, skipped: true };
  const deltaPi = cycle?.stripe_plan_delta_payment_intent_id;
  const planPi = cycle?.stripe_payment_intent_id;
  if (!deltaPi && !planPi) return { ok: false, error: 'missing_payment_intent' };

  let remaining = amount;
  let total = 0;
  let clearedDeltaPi = false;

  if (deltaPi && remaining > 0) {
    const r = await createRefund({
      paymentIntentId: deltaPi,
      amountCents: remaining,
      metadata: { ...metadata, pi_role: 'plan_delta_upgrade' },
    });
    if (!r.ok) {
      // Amount may exceed remaining on delta PI — fall through to plan PI for the rest.
      if (!/amount.*greater|exceeds/i.test(String(r.error || ''))) {
        return r;
      }
    } else {
      const got = Number(r.refundedCents) || 0;
      total += got;
      remaining = Math.max(0, remaining - got);
      // If we took the whole upgrade charge, clear the pointer after caller updates.
      if (remaining === 0 || got > 0) clearedDeltaPi = remaining === 0;
    }
  }

  if (remaining > 0) {
    if (!planPi) {
      return total > 0
        ? { ok: true, refundedCents: total, clearedDeltaPi }
        : { ok: false, error: 'missing_payment_intent' };
    }
    const r = await createRefund({
      paymentIntentId: planPi,
      amountCents: remaining,
      metadata: { ...metadata, pi_role: 'plan_delta' },
    });
    if (!r.ok) return r;
    total += Number(r.refundedCents) || 0;
  }

  return { ok: true, refundedCents: total, clearedDeltaPi };
}

/**
 * How much of a PaymentIntent is still captured (amount − refunded).
 * @returns {{ ok: true, amount: number, refunded: number, remaining: number, status: string }
 *           | { ok: false, error: string }}
 */
async function paymentIntentCaptureState(paymentIntentId) {
  if (!paymentIntentId) return { ok: false, error: 'missing_payment_intent' };
  const stripe = getStripe();
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
    const amount = Number(pi.amount) || 0;
    const charge = pi.latest_charge && typeof pi.latest_charge === 'object'
      ? pi.latest_charge
      : null;
    const refunded = Number(charge?.amount_refunded) || 0;
    return {
      ok: true,
      amount,
      refunded,
      remaining: Math.max(0, amount - refunded),
      status: String(pi.status || ''),
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err || 'retrieve_failed') };
  }
}

/**
 * If the stored upgrade PI is fully refunded, peel its pre-tax amount off
 * plan_paid_cents so a re-upgrade actually charges again.
 * Keep the PI id on the cycle — clearing it made Stripe replay attempt `0`
 * (the first refunded upgrade) on every later switch.
 */
async function reconcileRefundedPlanDelta(cycle) {
  const deltaId = cycle?.stripe_plan_delta_payment_intent_id;
  if (!deltaId) {
    return { cycle, peeledPlanPaid: false, clearedDeltaPi: false, planPaidCents: Number(cycle?.plan_paid_cents) || 0 };
  }
  const state = await paymentIntentCaptureState(deltaId);
  if (!state.ok) {
    return { cycle, peeledPlanPaid: false, clearedDeltaPi: false, planPaidCents: Number(cycle?.plan_paid_cents) || 0 };
  }
  // Still holding money on the upgrade PI — keep stamp + pointer.
  if (state.status === 'succeeded' && state.remaining > 0) {
    return { cycle, peeledPlanPaid: false, clearedDeltaPi: false, planPaidCents: Number(cycle?.plan_paid_cents) || 0 };
  }
  // Fully refunded (or canceled) — peel pre-tax delta off plan_paid; keep PI for after- keys.
  const preTaxDelta = Math.round(state.amount / HST);
  const paid = Number(cycle?.plan_paid_cents) || 0;
  const nextPaid = Math.max(0, paid - preTaxDelta);
  const next = {
    ...cycle,
    plan_paid_cents: nextPaid,
  };
  return { cycle: next, peeledPlanPaid: true, clearedDeltaPi: false, planPaidCents: nextPaid };
}

/**
 * Charge plan-price upgrade delta (+ tax) as a new off-session PI.
 * Caller stamps plan_paid_cents after success.
 * Walks an after-{pi} idempotency chain so refunded replays never fake a charge,
 * no matter how many upgrade↔downgrade rounds ran this week.
 */
async function chargePlanDelta(sub, cycle, { fromPreTax, toPreTax, metadata = {} } = {}) {
  const amount = hstDelta(toPreTax, fromPreTax);
  if (amount <= 0) return { ok: true, chargedCents: 0, skipped: true };
  if (amount < 50) {
    return { ok: false, error: 'delta_too_small' };
  }
  if (!sub?.stripe_customer_id || !sub?.stripe_payment_method_id) {
    return { ok: false, error: 'no_card' };
  }
  const stripe = getStripe();
  const seedId = cycle?.stripe_plan_delta_payment_intent_id
    ? String(cycle.stripe_plan_delta_payment_intent_id)
    : '';

  if (seedId) {
    const state = await paymentIntentCaptureState(seedId);
    if (state.ok && state.status === 'succeeded' && state.remaining >= amount) {
      // Same upgrade already captured and not refunded — idempotent no-op.
      return {
        ok: true,
        chargedCents: 0,
        paymentIntentId: seedId,
        already: true,
      };
    }
  }

  let attempt = seedId ? `after-${seedId.slice(-10)}` : '0';
  const maxTries = 8;
  try {
    for (let i = 0; i < maxTries; i += 1) {
      const pi = await stripe.paymentIntents.create({
        amount,
        currency: 'cad',
        customer: sub.stripe_customer_id,
        payment_method: sub.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: 'Subscription plan upgrade',
        metadata: {
          kind: 'subscription_plan_upgrade',
          subscription_id: sub.id,
          cycle_id: cycle.id,
          ...metadata,
        },
      }, {
        idempotencyKey: `sub-plan-up-${cycle.id}-${fromPreTax}-${toPreTax}-${attempt}`,
      });
      const createdId = pi?.id ? String(pi.id) : '';
      if (!createdId) {
        return { ok: false, error: 'charge_failed' };
      }
      const state = await paymentIntentCaptureState(createdId);
      if (state.ok && state.remaining >= amount) {
        return { ok: true, chargedCents: amount, paymentIntentId: createdId };
      }
      // Idempotency handed back a refunded (or short) PI — chain a new key off it.
      console.warn(
        '[subscriptions] plan upgrade PI has insufficient capture; chaining after',
        createdId,
        state
      );
      attempt = `after-${createdId.slice(-10)}`;
    }
    return { ok: false, error: 'charge_not_captured' };
  } catch (err) {
    console.warn('[subscriptions] plan upgrade charge failed:', cycle?.id, err.message);
    return { ok: false, error: err.message || 'charge_failed' };
  }
}

/**
 * Refund delivery fee (+ tax). Prefer dedicated delivery PI; else plan PI.
 */
async function refundDeliveryFee(cycle, { feePreTax, metadata = {} } = {}) {
  const fee = feePreTax != null ? Number(feePreTax) : (Number(cycle?.delivery_fee_cents) || 0);
  const amount = withHst(fee);
  if (amount <= 0) return { ok: true, refundedCents: 0, skipped: true };
  const deliveryPi = cycle?.stripe_delivery_payment_intent_id;
  const planPi = cycle?.stripe_payment_intent_id;
  const paymentIntentId = deliveryPi || planPi;
  if (!paymentIntentId) return { ok: false, error: 'missing_payment_intent' };
  return createRefund({
    paymentIntentId,
    amountCents: amount,
    metadata: { ...metadata, pi_role: 'delivery_fee' },
  });
}

module.exports = {
  HST,
  withHst,
  hstDelta,
  createRefund,
  refundCyclePaymentIntents,
  refundPlanDelta,
  reconcileRefundedPlanDelta,
  paymentIntentCaptureState,
  chargePlanDelta,
  refundDeliveryFee,
};

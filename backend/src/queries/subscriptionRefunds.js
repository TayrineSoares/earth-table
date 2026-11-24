/**
 * Stripe money moves for mid-week pause / plan / fulfillment (before Wed lock).
 * Amounts charged are HST-inclusive: Math.round(preTax * HST).
 * plan_paid_cents / delivery_fee_cents on the cycle stay pre-tax.
 *
 * Mid-week upgrades: prefer stripe_plan_delta_payment_intent_ids (jsonb array).
 * Falls back to singular stripe_plan_delta_payment_intent_id for older rows.
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

function uniqIds(ids) {
  return [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))];
}

/** All mid-week upgrade PI ids on this cycle (array column, else singular). */
function listPlanDeltaPaymentIntentIds(cycleOrRaw) {
  if (cycleOrRaw == null || cycleOrRaw === '') return [];
  // Called with the cycle row (preferred).
  if (typeof cycleOrRaw === 'object' && !Array.isArray(cycleOrRaw)) {
    const arr = cycleOrRaw.stripe_plan_delta_payment_intent_ids;
    if (Array.isArray(arr) && arr.length) return uniqIds(arr);
    if (typeof arr === 'string' && arr.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(arr);
        if (Array.isArray(parsed) && parsed.length) return uniqIds(parsed);
      } catch (_) {
        /* fall through */
      }
    }
    const singular = cycleOrRaw.stripe_plan_delta_payment_intent_id;
    return singular ? [String(singular)] : [];
  }
  // Called with raw singular / JSON string (legacy helpers).
  const s = String(cycleOrRaw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return uniqIds(parsed);
    } catch (_) {
      /* fall through */
    }
  }
  return [s];
}

function latestPlanDeltaPaymentIntentId(cycleOrRaw) {
  const ids = listPlanDeltaPaymentIntentIds(cycleOrRaw);
  return ids.length ? ids[ids.length - 1] : '';
}

/** Patch fields to persist after appending a new upgrade PI. */
function planDeltaPiWriteFields(cycle, newId) {
  const ids = listPlanDeltaPaymentIntentIds(cycle);
  if (newId && !ids.includes(String(newId))) ids.push(String(newId));
  const latest = ids.length ? ids[ids.length - 1] : null;
  return {
    stripe_plan_delta_payment_intent_ids: ids,
    stripe_plan_delta_payment_intent_id: latest,
  };
}

function clearPlanDeltaPiFields() {
  return {
    stripe_plan_delta_payment_intent_ids: [],
    stripe_plan_delta_payment_intent_id: null,
  };
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
    // Idempotent: already fully refunded — 0 new cents so dialog/email aren't inflated.
    if (
      code === 'charge_already_refunded'
      || /already been refunded/i.test(msg)
      || /has already been refunded/i.test(msg)
    ) {
      return { ok: true, refundedCents: 0, alreadyRefunded: true };
    }
    console.warn('[subscriptions] refund failed:', paymentIntentId, msg);
    return { ok: false, error: msg || 'refund_failed' };
  }
}

/**
 * Full refund of this week's plan PI + all mid-week delivery / upgrade PIs.
 * Used for paid+open pause/cancel before lock.
 */
async function refundCyclePaymentIntents(cycle, metadata = {}) {
  const results = [];
  let total = 0;
  const seen = new Set();
  const pis = [
    { id: cycle?.stripe_payment_intent_id, role: 'plan' },
    ...listPlanDeltaPaymentIntentIds(cycle).map((id) => ({ id, role: 'plan_delta' })),
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
 * Prefer mid-week upgrade PIs newest-first, then the Tuesday plan PI.
 */
async function refundPlanDelta(cycle, { fromPreTax, toPreTax, metadata = {} } = {}) {
  const amount = hstDelta(fromPreTax, toPreTax);
  if (amount <= 0) return { ok: true, refundedCents: 0, skipped: true };
  const deltaIds = listPlanDeltaPaymentIntentIds(cycle);
  const planPi = cycle?.stripe_payment_intent_id;
  if (!deltaIds.length && !planPi) return { ok: false, error: 'missing_payment_intent' };

  let remaining = amount;
  let total = 0;
  let clearedDeltaPi = false;

  for (let i = deltaIds.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const deltaPi = deltaIds[i];
    const r = await createRefund({
      paymentIntentId: deltaPi,
      amountCents: remaining,
      metadata: { ...metadata, pi_role: 'plan_delta_upgrade' },
    });
    if (!r.ok) {
      if (!/amount.*greater|exceeds/i.test(String(r.error || ''))) {
        return r;
      }
      continue;
    }
    const got = Number(r.refundedCents) || 0;
    total += got;
    remaining = Math.max(0, remaining - got);
    if (remaining === 0) clearedDeltaPi = true;
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
 * plan_paid_cents is source of truth after upgrade/downgrade stamps.
 * Do not peel refunded upgrade amounts — that double-counted after downgrade.
 * Keep delta PI id(s) so chargePlanDelta can chain after-{id} keys.
 */
async function reconcileRefundedPlanDelta(cycle) {
  const paid = Number(cycle?.plan_paid_cents) || 0;
  return {
    cycle,
    peeledPlanPaid: false,
    clearedDeltaPi: false,
    planPaidCents: paid,
  };
}

/**
 * Charge plan-price upgrade delta (+ tax) as a new off-session PI.
 * Caller stamps plan_paid_cents and appends the PI via planDeltaPiWriteFields.
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
  const seedId = latestPlanDeltaPaymentIntentId(cycle);

  if (seedId) {
    const state = await paymentIntentCaptureState(seedId);
    if (state.ok && state.status === 'succeeded' && state.remaining >= amount) {
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
  listPlanDeltaPaymentIntentIds,
  latestPlanDeltaPaymentIntentId,
  planDeltaPiWriteFields,
  clearPlanDeltaPiFields,
  createRefund,
  refundCyclePaymentIntents,
  refundPlanDelta,
  reconcileRefundedPlanDelta,
  paymentIntentCaptureState,
  chargePlanDelta,
  refundDeliveryFee,
};

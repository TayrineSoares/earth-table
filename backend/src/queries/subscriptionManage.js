/**
 * Pause / resume / cancel / change plan.
 * Wednesday 9:00 AM ET is the deadline for this Sunday; after that the change waits.
 */

const supabase = require('../../supabase/db');
const { sendCustomerEmail, sendOwnerEmail, emailPrefOn, monitoredFrom } = require('../emails/sendSubscriptionMail');
const {
  renderSubscriptionManageEmail,
  renderOwnerStatusEmail,
  renderOwnerPlanChangedEmail,
  formatDollars,
} = require('../utils/emailTemplates');
const { getUserByAuthId } = require('./user');
const {
  SubscriptionError,
  getPlanById,
  getOwnedSubscription,
  getSettings,
} = require('./subscription');
const {
  getEditWeek,
  getChargeDeadline,
  getSignupDates,
  torontoYmd,
  pauseNudgeWeek,
  formatTorontoStamp,
} = require('./subscriptionWeek');
const { CADENCE } = require('../emails/subscriptionEmailSpec');

const HST = 1.13;

function getStripe() {
  return require('stripe')(process.env.STRIPE_SECRET_SK);
}

function pickUpcoming(rows, now) {
  const today = torontoYmd(now);
  const list = [...(rows || [])];
  const upcoming = list
    .filter((row) => row.delivery_date && String(row.delivery_date) >= today)
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)));
  if (upcoming.length) return upcoming[0];
  return list.sort((a, b) => String(b.delivery_date).localeCompare(String(a.delivery_date)))[0] || null;
}

async function currentCycleFor(sub) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id);
  if (error) throw error;
  const settings = await getSettings();
  const now = new Date();
  const rows = data || [];
  const display = pickUpcoming(rows, now);
  const week = getEditWeek(now, settings || {}, display);
  const charge = getChargeDeadline(now, settings || {}, week.delivery_date);
  const cycle = rows.find((row) => row.delivery_date === week.delivery_date) || display;
  return { week, charge, cycle };
}

function skipRefundCents(cycle) {
  if (!cycle) return 0;
  const plan = Number(cycle.plan_paid_cents) || 0;
  const fee = Number(cycle.delivery_fee_cents) || 0;
  // Skip means the box will not go out. Refund plan + delivery (with tax).
  return Math.round(plan * HST) + Math.round(fee * HST);
}

async function refundSkip(cycle, subscriptionId) {
  const amount = skipRefundCents(cycle);
  const piId = cycle?.stripe_payment_intent_id;
  if (!piId || amount < 50) return { refunded_cents: 0 };
  const stripe = getStripe();
  await stripe.refunds.create({
    payment_intent: piId,
    amount,
    reason: 'requested_by_customer',
    metadata: { kind: 'subscription_skip', subscription_id: subscriptionId, cycle_id: cycle.id },
  });
  return { refunded_cents: amount };
}

async function skipOpenCycle(cycle) {
  if (!cycle || cycle.status !== 'open') return;
  const { error } = await supabase
    .from('subscription_cycles')
    .update({ status: 'skipped' })
    .eq('id', cycle.id)
    .eq('status', 'open');
  if (error) throw error;
}

function pendingNotice(pending) {
  const verb = pending === 'cancelled' ? 'cancelled' : 'paused';
  return `The payment cutoff for this week has passed. You're still receiving this Sunday's box. The plan will be ${verb} starting the following week.`;
}

async function applyPendingStatus(userId, sub, pending, week, charge) {
  const { error } = await supabase
    .from('subscriptions')
    .update({ pending_status: pending })
    .eq('id', sub.id);
  if (error) throw error;
  try {
    await notifyManage(userId, {
      kind: pending === 'cancelled' ? 'cancel_next' : 'pause_next',
      mealCount: sub.subscription_plans?.meal_count,
      deliveryLabel: week.delivery_label,
      chargeLabel: charge.charge_label,
      lastBox: pending === 'cancelled',
      fulfillmentDate: week.delivery_label,
    });
    await notifyOwnerStatus(pending === 'cancelled' ? 'cancelled' : 'paused', userId, sub, {
      lastBoxDate: week.delivery_label,
      lastBoxPaid: true,
    });
  } catch (err) {
    console.warn('[subscriptions] pending-status email failed:', err.message);
  }
  return {
    ok: true,
    status: sub.status,
    pending: true,
    week,
    charge,
    message: pendingNotice(pending),
  };
}

async function ownerStats(sub) {
  const created = new Date(sub.created_at || Date.now());
  const elapsed = Date.now() - created.getTime();
  const weeks = Math.max(1, Math.round(elapsed / (7 * 24 * 60 * 60 * 1000)) || 1);
  const { data } = await supabase
    .from('subscription_cycles')
    .select('plan_paid_cents, addon_paid_cents')
    .eq('subscription_id', sub.id);
  const cents = (data || []).reduce(
    (sum, row) => sum + (Number(row.plan_paid_cents) || 0) + (Number(row.addon_paid_cents) || 0),
    0
  );
  return { weeks, lifetimeCents: cents };
}

async function notifyOwnerStatus(kind, userId, sub, extras = {}) {
  const user = await getUserByAuthId(userId);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Customer';
  const stats = await ownerStats(sub);
  const msg = renderOwnerStatusEmail({
    kind,
    customerName: name,
    mealCount: sub.subscription_plans?.meal_count,
    price: formatDollars(sub.subscription_plans?.price_cents),
    dateTime: formatTorontoStamp(new Date()),
    weeks: stats.weeks,
    lifetimeValue: formatDollars(stats.lifetimeCents),
    ...extras,
  });
  await sendOwnerEmail(msg);
}

async function notifyManage(userId, payload) {
  const user = await getUserByAuthId(userId);
  const email = user?.email;
  if (!email) return;
  if (payload.kind === 'pause_nudge' && !emailPrefOn(user, 'pause_reminder')) return;
  const msg = renderSubscriptionManageEmail({
    ...payload,
    firstName: user.first_name,
  });
  const cancel = payload.kind === 'cancel_now' || payload.kind === 'cancel_next';
  await sendCustomerEmail({
    to: email,
    msg,
    from: cancel ? monitoredFrom() : undefined,
  });
}

async function pauseSubscription(userId, subscriptionId) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status === 'cancelled') {
    throw new SubscriptionError(400, 'This subscription is already cancelled.');
  }
  if (sub.status === 'paused' && !sub.pending_status) {
    return { ok: true, status: 'paused', pending: false };
  }

  const { week, charge, cycle } = await currentCycleFor(sub);

  if (!charge.before_wednesday) {
    return applyPendingStatus(userId, sub, 'paused', week, charge);
  }

  if (cycle && Number(cycle.plan_paid_cents) > 0) {
    try {
      await refundSkip(cycle, sub.id);
    } catch (err) {
      console.warn('[subscriptions] pause refund failed; deferring to next week:', err.message);
      return applyPendingStatus(userId, sub, 'paused', week, charge);
    }
  }
  await skipOpenCycle(cycle);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'paused',
      pause_reason: 'manual',
      paused_at: new Date().toISOString(),
      pending_status: null,
    })
    .eq('id', sub.id);
  if (error) throw error;

  try {
    await notifyManage(userId, {
      kind: 'pause_now',
      mealCount: sub.subscription_plans?.meal_count,
      deliveryLabel: week.delivery_label,
      chargeLabel: charge.charge_label,
    });
    await notifyOwnerStatus('paused', userId, sub);
  } catch (err) {
    console.warn('[subscriptions] pause email failed:', err.message);
  }

  return { ok: true, status: 'paused', pending: false, week, charge };
}

async function resumeSubscription(userId, subscriptionId) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status === 'cancelled') {
    throw new SubscriptionError(400, 'This subscription is cancelled. Start a new plan from Subscribe & Save.');
  }

  const { week, charge } = await currentCycleFor(sub);

  if (sub.status === 'paused' && sub.pause_reason === 'payment_failed') {
    try {
      const { retryFailedCharge } = require('./subscriptionCharge');
      const retried = await retryFailedCharge(sub);
      if (!retried?.ok) {
        throw new SubscriptionError(402, 'We still could not charge this week. Update your card before Thursday 5:00 PM ET or email hello@earthtableco.ca.');
      }
    } catch (err) {
      if (err instanceof SubscriptionError) throw err;
      throw new SubscriptionError(402, 'We still could not charge this week. Try another card or email hello@earthtableco.ca.');
    }
  }

  if (sub.status === 'active' && sub.pending_status) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ pending_status: null })
      .eq('id', sub.id);
    if (error) throw error;
    try {
      await notifyManage(userId, {
        kind: 'resume',
        mealCount: sub.subscription_plans?.meal_count,
        deliveryLabel: week.delivery_label,
        cutoffLabel: week.cutoff_label,
        chargeLabel: charge.charge_label,
        fulfillmentDate: week.delivery_label,
        planPriceCents: sub.subscription_plans?.price_cents,
        delivery: sub.delivery,
        pickupSlot: sub.pickup_time_slot,
        address: sub.delivery ? sub.special_note : undefined,
        notes: sub.special_note,
      });
      await notifyOwnerStatus('resumed', userId, sub);
    } catch (err) {
      console.warn('[subscriptions] resume email failed:', err.message);
    }
    return { ok: true, status: 'active', pending: false, week, charge };
  }

  if (sub.status !== 'paused') {
    return { ok: true, status: sub.status, pending: false };
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      pause_reason: null,
      resumed_at: new Date().toISOString(),
      pending_status: null,
    })
    .eq('id', sub.id);
  if (error) throw error;

  try {
    await notifyManage(userId, {
      kind: 'resume',
      mealCount: sub.subscription_plans?.meal_count,
      deliveryLabel: week.delivery_label,
      cutoffLabel: week.cutoff_label,
      chargeLabel: charge.charge_label,
      fulfillmentDate: week.delivery_label,
      planPriceCents: sub.subscription_plans?.price_cents,
      delivery: sub.delivery,
      pickupSlot: sub.pickup_time_slot,
      address: sub.delivery ? sub.special_note : undefined,
      notes: sub.special_note,
    });
    await notifyOwnerStatus('resumed', userId, sub);
  } catch (err) {
    console.warn('[subscriptions] resume email failed:', err.message);
  }

  return { ok: true, status: 'active', pending: false, week, charge };
}

function cancelledWipe() {
  return {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    pending_status: null,
    pending_plan_id: null,
    stripe_payment_method_id: null,
    label: null,
    special_note: null,
    delivery_postal_code: null,
    pickup_time_slot: null,
    pause_reason: null,
  };
}

async function cancelSubscription(userId, subscriptionId) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status === 'cancelled') {
    return { ok: true, status: 'cancelled', pending: false };
  }

  const { week, charge, cycle } = await currentCycleFor(sub);
  const skipThisSunday = charge.before_wednesday && sub.status === 'active';

  if (!skipThisSunday) {
    return applyPendingStatus(userId, sub, 'cancelled', week, charge);
  }

  if (cycle && Number(cycle.plan_paid_cents) > 0) {
    try {
      await refundSkip(cycle, sub.id);
    } catch (err) {
      console.warn('[subscriptions] cancel refund failed; deferring to next week:', err.message);
      return applyPendingStatus(userId, sub, 'cancelled', week, charge);
    }
  }
  await skipOpenCycle(cycle);

  const { error } = await supabase
    .from('subscriptions')
    .update(cancelledWipe())
    .eq('id', sub.id);
  if (error) throw error;

  try {
    await notifyManage(userId, {
      kind: 'cancel_now',
      mealCount: sub.subscription_plans?.meal_count,
      deliveryLabel: week.delivery_label,
      chargeLabel: charge.charge_label,
    });
    await notifyOwnerStatus('cancelled', userId, sub);
  } catch (err) {
    console.warn('[subscriptions] cancel email failed:', err.message);
  }

  return { ok: true, status: 'cancelled', pending: false, skipped: true, week, charge };
}

async function claimCutoffRun(weekKey, job) {
  const { error } = await supabase
    .from('cutoff_runs')
    .insert({ week_key: weekKey, job });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

async function sendPauseReminders(now = new Date()) {
  const settings = await getSettings();
  const weekKey = torontoYmd(now);
  const claimed = await claimCutoffRun(weekKey, 'pause_reminder');
  if (!claimed) return { ok: true, skipped: true, week_key: weekKey, emailed: 0 };

  const signup = getSignupDates(now, settings || {});
  const charge = getChargeDeadline(now, settings || {}, signup.first_delivery_date);

  const { data: paused, error } = await supabase
    .from('subscriptions')
    .select(`
      id, user_id, paused_at,
      subscription_plans!subscriptions_plan_id_fkey ( meal_count )
    `)
    .eq('status', 'paused');
  if (error) throw error;

  const rows = paused || [];
  let emailed = 0;
  const failures = [];
  for (const row of rows) {
    try {
      const weekNum = pauseNudgeWeek(row.paused_at, now);
      if (!CADENCE.PAUSE_NUDGE_WEEKS.includes(weekNum)) continue;
      await notifyManage(row.user_id, {
        kind: 'pause_nudge',
        mealCount: row.subscription_plans?.meal_count,
        deliveryLabel: signup.first_delivery_label,
        cutoffLabel: signup.cutoff_label,
        chargeLabel: charge.charge_label,
      });
      emailed += 1;
    } catch (err) {
      failures.push(err.message || String(err));
      console.warn('[subscriptions] pause reminder failed:', err.message);
    }
  }

  await supabase
    .from('cutoff_runs')
    .update({
      finished_at: new Date().toISOString(),
      stats: { emailed, failed: failures.length },
    })
    .eq('week_key', weekKey)
    .eq('job', 'pause_reminder');

  return { ok: true, week_key: weekKey, emailed, failed: failures.length };
}

async function changeSubscriptionPlan(userId, subscriptionId, planId) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status !== 'active') {
    throw new SubscriptionError(400, 'Resume this plan before changing it.');
  }
  if (!planId) throw new SubscriptionError(400, 'Pick a plan.');
  if (planId === sub.plan_id && !sub.pending_plan_id) {
    return { ok: true, pending: false, needs_meals: false };
  }

  const nextPlan = await getPlanById(planId);
  if (!nextPlan || !nextPlan.is_active) {
    throw new SubscriptionError(400, 'That plan is not available.');
  }

  const { week, charge, cycle } = await currentCycleFor(sub);
  const currentCount = Number(sub.subscription_plans?.meal_count) || 0;
  const nextCount = Number(nextPlan.meal_count) || 0;

  if (!charge.before_wednesday) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ pending_plan_id: nextPlan.id })
      .eq('id', sub.id);
    if (error) throw error;
    try {
      await notifyManage(userId, {
        kind: 'plan_next',
        mealCount: currentCount,
        oldMealCount: currentCount,
        nextMealCount: nextCount,
        oldPrice: formatDollars(sub.subscription_plans?.price_cents),
        newPrice: formatDollars(nextPlan.price_cents),
        deliveryLabel: week.delivery_label,
        cutoffLabel: week.cutoff_label,
        chargeLabel: charge.charge_label,
        effectiveDate: week.delivery_label,
        nextChargeDate: charge.charge_label,
        difference: Math.abs(nextCount - currentCount),
      });
      const user = await getUserByAuthId(userId);
      const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Customer';
      await sendOwnerEmail(renderOwnerPlanChangedEmail({
        customerName: name,
        oldMealCount: currentCount,
        newMealCount: nextCount,
        oldPriceCents: sub.subscription_plans?.price_cents,
        newPriceCents: nextPlan.price_cents,
        effectiveDate: week.delivery_label,
        selectedCount: currentCount,
      }));
    } catch (err) {
      console.warn('[subscriptions] plan-change email failed:', err.message);
    }
    return {
      ok: true,
      pending: true,
      needs_meals: false,
      week,
      charge,
      plan: nextPlan,
    };
  }

  const oldPrice = Number(cycle?.plan_price_cents) || Number(sub.subscription_plans?.price_cents) || 0;
  const newPrice = Number(nextPlan.price_cents) || 0;
  const alreadyPaid = Number(cycle?.plan_paid_cents) || 0;
  const delta = newPrice - oldPrice;

  if (cycle && alreadyPaid > 0 && delta !== 0) {
    const stripe = getStripe();
    const amount = Math.round(Math.abs(delta) * HST);
    if (delta > 0 && amount >= 50) {
      if (!sub.stripe_customer_id || !sub.stripe_payment_method_id) {
        throw new SubscriptionError(400, 'No card on file. Email hello@earthtableco.ca.');
      }
      try {
        await stripe.paymentIntents.create({
          amount,
          currency: 'cad',
          customer: sub.stripe_customer_id,
          payment_method: sub.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: 'Subscription plan upgrade',
          metadata: {
            kind: 'subscription_upgrade',
            subscription_id: sub.id,
            cycle_id: cycle.id,
          },
        });
      } catch (err) {
        console.error('[subscriptions] upgrade charge failed', err.message);
        throw new SubscriptionError(402, 'We could not charge the plan difference. Try again or email hello@earthtableco.ca.');
      }
    } else if (delta < 0 && amount >= 50 && cycle.stripe_payment_intent_id) {
      try {
        await stripe.refunds.create({
          payment_intent: cycle.stripe_payment_intent_id,
          amount,
          reason: 'requested_by_customer',
          metadata: { kind: 'subscription_downgrade', subscription_id: sub.id, cycle_id: cycle.id },
        });
      } catch (err) {
        console.error('[subscriptions] downgrade refund failed', err.message);
        throw new SubscriptionError(402, 'We could not refund the plan difference. Email hello@earthtableco.ca.');
      }
    }
  }

  const { error: subErr } = await supabase
    .from('subscriptions')
    .update({
      plan_id: nextPlan.id,
      pending_plan_id: null,
    })
    .eq('id', sub.id);
  if (subErr) throw subErr;

  if (cycle && cycle.status === 'open') {
    const { error: cycleErr } = await supabase
      .from('subscription_cycles')
      .update({
        plan_id: nextPlan.id,
        plan_price_cents: newPrice,
        plan_paid_cents: alreadyPaid > 0 ? newPrice : cycle.plan_paid_cents,
      })
      .eq('id', cycle.id);
    if (cycleErr) throw cycleErr;
  }

  try {
    await notifyManage(userId, {
      kind: 'plan_now',
      mealCount: nextCount,
      oldMealCount: currentCount,
      nextMealCount: nextCount,
      oldPrice: formatDollars(oldPrice),
      newPrice: formatDollars(newPrice),
      deliveryLabel: week.delivery_label,
      cutoffLabel: week.cutoff_label,
      chargeLabel: charge.charge_label,
      effectiveDate: week.delivery_label,
      nextChargeDate: charge.charge_label,
      difference: Math.abs(nextCount - currentCount),
    });
    const user = await getUserByAuthId(userId);
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Customer';
    await sendOwnerEmail(renderOwnerPlanChangedEmail({
      customerName: name,
      oldMealCount: currentCount,
      newMealCount: nextCount,
      oldPriceCents: oldPrice,
      newPriceCents: newPrice,
      effectiveDate: week.delivery_label,
      selectedCount: nextCount,
    }));
  } catch (err) {
    console.warn('[subscriptions] plan-change email failed:', err.message);
  }

  return {
    ok: true,
    pending: false,
    needs_meals: currentCount !== nextCount,
    week,
    charge,
    plan: nextPlan,
  };
}

module.exports = {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  sendPauseReminders,
};

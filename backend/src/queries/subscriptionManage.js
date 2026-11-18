/**
 * Pause / resume / cancel / change plan.
 * Tuesday 9:00 AM ET is the deadline for this Sunday; after that the change waits.
 */

const supabase = require('../../supabase/db');
const { sendEmail } = require('../utils/email');
const {
  renderSubscriptionManageEmail,
  renderSubscriptionDeadlineEmail,
  renderOwnerSubscriptionEventEmail,
} = require('../utils/emailTemplates');
const { getUserByAuthId, updateUserByAuthId } = require('./user');
const { emailPrefOn, sendCustomerEmail, sendOwnerEmail } = require('../emails/sendSubscriptionMail');
const { unsubscribeUrl } = require('../emails/unsubscribeToken');
const { CADENCE } = require('../emails/subscriptionEmailSpec');
const {
  SubscriptionError,
  getPlanById,
  getOwnedSubscription,
  getSettings,
  firstBoxSunday,
  firstBoxStillDue,
  ensureFirstBoxCycle,
  getOrCreateEditableCycle,
  planMealItems,
  labeledBoxItemsForCycle,
  writeCyclePlanAndAddons,
  recordPlanChange,
} = require('./subscription');
const {
  getEditWeek,
  getChargeDeadline,
  getSignupDates,
  torontoYmd,
  nextOpenSunday,
  sundayLabelFromYmd,
  cutoffAtForSunday,
  pauseNudgeWeek,
} = require('./subscriptionWeek');

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
  const open = [...rows]
    .filter((row) => row && row.status === 'open' && row.delivery_date)
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)))[0] || null;
  const display = pickUpcoming(rows, now);
  // Prefer an open week so pause/resume dates match My Subscriptions after meal review.
  const week = getEditWeek(now, settings || {}, open || display);
  const charge = getChargeDeadline(now, settings || {}, week.delivery_date);
  const cycle = rows.find((row) => String(row.delivery_date) === String(week.delivery_date))
    || open
    || display;
  return { week, charge, cycle };
}

/**
 * Pause abandons a deferred plan change: clear pending_plan_id and skip any
 * unpaid open weeks that were pre-seeded for the new size (not the kept Sunday).
 */
async function abandonDeferredPlanChange(sub, { keepCycleId } = {}) {
  if (!sub?.pending_plan_id) return;
  const pendingId = sub.pending_plan_id;
  const { data: rows, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id)
    .eq('status', 'open');
  if (error) throw error;
  for (const row of rows || []) {
    if (keepCycleId && String(row.id) === String(keepCycleId)) continue;
    if (Number(row.plan_paid_cents) > 0) continue;
    if (String(row.plan_id) !== String(pendingId)) continue;
    await skipOpenCycle(row);
  }
}

/**
 * Skip only if still open and unpaid. Returns the fresh cycle.
 * If Tuesday charge already won the race, skipped=false and plan_paid_cents > 0.
 */
async function skipOpenCycle(cycle) {
  if (!cycle?.id) return { skipped: false, cycle };
  if (cycle.status !== 'open' || Number(cycle.plan_paid_cents) > 0) {
    return { skipped: false, cycle };
  }
  const { data, error } = await supabase
    .from('subscription_cycles')
    .update({ status: 'skipped' })
    .eq('id', cycle.id)
    .eq('status', 'open')
    .lte('plan_paid_cents', 0)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (data) return { skipped: true, cycle: data };

  const { data: fresh, error: readErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('id', cycle.id)
    .maybeSingle();
  if (readErr) throw readErr;
  return { skipped: false, cycle: fresh || cycle };
}

function pendingNotice(pending) {
  const verb = pending === 'cancelled' ? 'cancelled' : 'paused';
  return `This Sunday's box is already charged (or locked), so it still goes out. The plan will be ${verb} starting the following week.`;
}

/** Pause now when this Sunday is already paid/locked — box still ships; later weeks stop. */
async function applyPauseKeepingThisSunday(userId, sub, week, charge, { keepCycleId } = {}) {
  await abandonDeferredPlanChange(sub, { keepCycleId });
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'paused',
      pause_reason: 'manual',
      paused_at: new Date().toISOString(),
      pending_status: null,
      pending_plan_id: null,
    })
    .eq('id', sub.id);
  if (error) throw error;
  try {
    await notifyManage(userId, {
      kind: 'pause_next',
      mealCount: sub.subscription_plans?.meal_count,
      deliveryLabel: week.delivery_label,
      chargeLabel: charge.charge_label,
    });
  } catch (err) {
    console.warn('[subscriptions] pending-status email failed:', err.message);
  }
  return {
    ok: true,
    status: 'paused',
    pending: false,
    week,
    charge,
    message: pendingNotice('paused'),
  };
}

async function applyPendingStatus(userId, sub, pending, week, charge, { cycle } = {}) {
  const paidOrLocked = Boolean(
    cycle
    && (Number(cycle.plan_paid_cents) > 0 || cycle.status === 'locked')
  );
  // Cancel from the customer button is pause. True pending cancel is plan-discontinue only.
  if (pending === 'paused' && paidOrLocked) {
    return applyPauseKeepingThisSunday(userId, sub, week, charge, {
      keepCycleId: cycle?.id,
    });
  }

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

const OWNER_MANAGE_KINDS = new Set([
  'pause_now',
  'pause_first',
  'pause_next',
  'cancel_now',
  'cancel_next',
  'resume',
  'plan_now',
  'plan_next',
]);

async function notifyManage(userId, payload) {
  const user = await getUserByAuthId(userId);
  const email = user?.email;
  if (payload.kind === 'pause_nudge' && !emailPrefOn(user, 'pause_reminder')) {
    return false;
  }
  let customerSent = false;
  if (email) {
    try {
      const msg = renderSubscriptionManageEmail({
        ...payload,
        firstName: user.first_name,
        unsubscribeHref: payload.kind === 'pause_nudge' ? unsubscribeUrl(userId) : undefined,
      });
      await sendEmail({
        to: email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: 'hello@earthtableco.ca',
      });
      customerSent = true;
    } catch (err) {
      // Still try owner mail below — customer failure must not hide kitchen alerts.
      console.warn('[subscriptions] customer manage email failed:', err.message);
    }
  } else if (!OWNER_MANAGE_KINDS.has(payload.kind)) {
    return false;
  }

  if (OWNER_MANAGE_KINDS.has(payload.kind)) {
    try {
      const customerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
        || email
        || 'Customer';
      const ownerMsg = renderOwnerSubscriptionEventEmail({
        ...payload,
        customerName,
        email,
      });
      await sendOwnerEmail(ownerMsg);
    } catch (err) {
      console.warn('[subscriptions] owner manage email failed:', err.message);
    }
  }
  return customerSent;
}

async function resumeNotifyPayload(sub, week, charge, { charged = false } = {}) {
  let meals = [];
  let addons = [];
  let deliveryLabel = week?.delivery_label;
  let boxYmd = week?.delivery_date || null;
  try {
    const editable = await getOrCreateEditableCycle(sub);
    if (editable?.week?.delivery_label) deliveryLabel = editable.week.delivery_label;
    if (editable?.week?.delivery_date) boxYmd = editable.week.delivery_date;
    else if (editable?.cycle?.delivery_date) boxYmd = editable.cycle.delivery_date;
    if (editable?.cycle?.id) {
      const box = await labeledBoxItemsForCycle(editable.cycle.id);
      meals = box.meals;
      addons = box.addons;
    }
  } catch (err) {
    console.warn('[subscriptions] resume box items failed:', err.message);
  }
  // After Wednesday lock, the editable box is often next Sunday — don't call it "this Sunday".
  let followingWeek = false;
  if (!charged && boxYmd) {
    try {
      const settings = await getSettings();
      const dates = getSignupDates(new Date(), settings || {});
      const cookSunday = dates.locked_delivery_date || dates.job_sunday;
      followingWeek = Boolean(cookSunday && String(boxYmd) > String(cookSunday));
    } catch (err) {
      console.warn('[subscriptions] resume week timing failed:', err.message);
    }
  }
  return {
    kind: 'resume',
    mealCount: sub.subscription_plans?.meal_count,
    deliveryLabel,
    chargeLabel: charge?.charge_label,
    charged: !!charged,
    followingWeek,
    meals,
    addons,
  };
}

/** Welcome-back mail after payment_failed recovery (resume or card-update retry). */
async function notifyResumeAfterPaymentRecovery(userId, sub, { charged = false } = {}) {
  if (!userId || !sub?.id) return false;
  const { week, charge } = await currentCycleFor(sub);
  return notifyManage(
    userId,
    await resumeNotifyPayload(sub, week, charge, { charged: !!charged })
  );
}

async function pauseSubscription(userId, subscriptionId) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status === 'cancelled') {
    throw new SubscriptionError(400, 'This subscription is already cancelled.');
  }
  // Already paused (manual or payment_failed): Tuesday never auto-charges paused
  // plans. Keep payment_failed as the truth — Cancel/Pause is a no-op here.
  if (sub.status === 'paused' && !sub.pending_status) {
    return { ok: true, status: 'paused', pending: false };
  }

  const { week, charge, cycle } = await currentCycleFor(sub);
  const settings = await getSettings();
  const now = new Date();
  const { data: rows, error: cycleErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id);
  if (cycleErr) throw cycleErr;
  const cycles = rows || [];

  // First box is charged at signup and always goes out. Pause later weeks only.
  // Use real paid/locked cycles so a later open week is not treated as first box.
  if (firstBoxStillDue(sub, settings || {}, now, cycles)) {
    const firstYmd = firstBoxSunday(sub, settings || {}, now, cycles);
    await ensureFirstBoxCycle(sub, cycles, settings || {}, now);
    const nextSunday = nextOpenSunday(firstYmd);
    const firstWeek = {
      ...week,
      delivery_date: firstYmd,
      delivery_label: sundayLabelFromYmd(firstYmd) || week.delivery_label,
    };
    const nextCharge = getChargeDeadline(now, settings || {}, nextSunday);

    const firstCycle = (cycles || []).find((row) => (
      row && String(row.delivery_date) === String(firstYmd)
    )) || null;
    await abandonDeferredPlanChange(sub, { keepCycleId: firstCycle?.id });
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'paused',
        pause_reason: 'manual',
        paused_at: new Date().toISOString(),
        pending_status: null,
        pending_plan_id: null,
      })
      .eq('id', sub.id);
    if (error) throw error;

    try {
      await notifyManage(userId, {
        kind: 'pause_first',
        mealCount: sub.subscription_plans?.meal_count,
        deliveryLabel: firstWeek.delivery_label,
        chargeLabel: nextCharge.charge_label,
      });
    } catch (err) {
      console.warn('[subscriptions] pause email failed:', err.message);
    }

    return {
      ok: true,
      status: 'paused',
      pending: false,
      first_box_kept: true,
      week: firstWeek,
      charge: nextCharge,
      message: `Your first box on ${firstWeek.delivery_label || firstYmd} can't be cancelled — it still goes out. Later weeks are paused until you resume.`,
    };
  }

  // Prefer the open cycle for the live cook Sunday (e.g. opened during resume
  // meal review). Resume is not a new first box — pause before Tuesday skips it.
  const openForWeek = (cycles || []).find((row) => (
    row
    && String(row.delivery_date) === String(week.delivery_date)
    && row.status === 'open'
  )) || null;
  const target = openForWeek || cycle;
  const { pauseKeepsThisSunday } = require('./subscriptionPauseResumeRules');

  // Keep vs skip is decided by money/lock, not the clock — avoids the Tue 9:00 AM
  // race with the charge job. Clock copy still says "before Tuesday 9am"; after
  // that the charge usually lands first so pause keeps the box.
  if (pauseKeepsThisSunday(target)) {
    return applyPendingStatus(userId, sub, 'paused', week, charge, { cycle: target });
  }

  const firstYmd = firstBoxSunday(sub, settings || {}, now, cycles);
  // Skip every unpaid open week so a resumed plan can pause again before Tuesday
  // without leaving a chargeable box behind.
  let keptAfterRace = null;
  for (const row of cycles) {
    if (!row || row.status !== 'open' || Number(row.plan_paid_cents) > 0) continue;
    if (firstYmd && String(row.delivery_date) === String(firstYmd)) continue;
    const skipResult = await skipOpenCycle(row);
    const after = skipResult.cycle || row;
    if (
      !skipResult.skipped
      && after
      && (Number(after.plan_paid_cents) > 0 || after.status === 'locked')
    ) {
      keptAfterRace = after;
    }
  }
  if (keptAfterRace) {
    // Charge (or lock) won the race while we paused — keep this Sunday.
    return applyPendingStatus(userId, sub, 'paused', week, charge, { cycle: keptAfterRace });
  }

  await abandonDeferredPlanChange(sub);
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'paused',
      pause_reason: 'manual',
      paused_at: new Date().toISOString(),
      pending_status: null,
      pending_plan_id: null,
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
  } catch (err) {
    console.warn('[subscriptions] pause email failed:', err.message);
  }

  return {
    ok: true,
    status: 'paused',
    pending: false,
    week,
    charge,
    message: `${week.delivery_label || 'This Sunday'} will be skipped. Your meals and card stay ready so you can resume anytime.`,
  };
}

async function assertResumeMealsReady(sub) {
  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
  const need = Number(plan?.meal_count) || 0;
  if (need <= 0) return;
  const { cycle, week } = await getOrCreateEditableCycle(sub);
  if (!cycle || cycle.status !== 'open') return;
  const qty = planMealItems(cycle).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  if (qty === need) return;
  const lockBy = week?.cutoff_label || 'Wednesday at 5:00 PM ET';
  throw new SubscriptionError(
    400,
    `Choose exactly ${need} meal${need === 1 ? '' : 's'} for this box before resuming (now ${qty}). Save meals before ${lockBy}, then resume. Questions? Email hello@earthtableco.ca.`
  );
}

async function resumeSubscription(userId, subscriptionId) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status === 'cancelled') {
    throw new SubscriptionError(400, 'This subscription is cancelled. Start a new plan from Subscribe & Save.');
  }
  if (!sub.stripe_payment_method_id || !sub.stripe_customer_id) {
    throw new SubscriptionError(
      400,
      'Update your card before resuming. Questions? Email hello@earthtableco.ca.'
    );
  }

  const { week, charge, cycle } = await currentCycleFor(sub);

  if (sub.status === 'active' && sub.pending_status) {
    // Plan-discontinue sets pending cancel — do not let "Keep this Sunday" undo it.
    if (
      sub.pending_status === 'cancelled'
      && String(sub.cancelled_reason || '') === 'plan_discontinued'
    ) {
      throw new SubscriptionError(
        400,
        'This plan size was discontinued. Email hello@earthtableco.ca if you need help.'
      );
    }
    const { error } = await supabase
      .from('subscriptions')
      .update({ pending_status: null })
      .eq('id', sub.id);
    if (error) throw error;
    try {
      await notifyManage(userId, await resumeNotifyPayload(sub, week, charge));
    } catch (err) {
      console.warn('[subscriptions] resume email failed:', err.message);
    }
    return { ok: true, status: 'active', pending: false, week, charge };
  }

  if (sub.status !== 'paused') {
    return { ok: true, status: sub.status, pending: false };
  }

  // Reopen / validate meals for the editable week.
  await assertResumeMealsReady(sub);

  // payment_failed: charge this cook week now (before Wed lock), same as card update.
  // Manual pause before Tuesday: activate only — Tuesday job charges (so they can
  // pause again). After Tuesday charge time, charge now if that Sunday is still unpaid.
  // If this cook week is already paid/locked (pause-after-charge), never charge again.
  const { resumeShouldChargeNow, cycleIsCommitted } = require('./subscriptionPauseResumeRules');
  const shouldChargeNow = resumeShouldChargeNow({
    pauseReason: sub.pause_reason,
    beforeTuesdayCharge: charge?.before_wednesday !== false,
    cookWeekCommitted: cycleIsCommitted(cycle),
  });

  if (shouldChargeNow) {
    try {
      const { retryFailedCharge } = require('./subscriptionCharge');
      const retried = await retryFailedCharge(sub);
      if (!retried?.ok) {
        throw new SubscriptionError(
          402,
          `We still could not charge this week. Update your card before ${week.cutoff_label || 'the meal lock'} or email hello@earthtableco.ca.`
        );
      }
      try {
        await notifyManage(
          userId,
          await resumeNotifyPayload(sub, week, charge, { charged: !!retried.charged })
        );
      } catch (err) {
        console.warn('[subscriptions] resume email failed:', err.message);
      }
      return {
        ok: true,
        status: 'active',
        pending: false,
        week,
        charge,
        charged: !!retried.charged,
      };
    } catch (err) {
      if (err instanceof SubscriptionError) throw err;
      throw new SubscriptionError(
        402,
        'We still could not charge this week. Try another card or email hello@earthtableco.ca.'
      );
    }
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      pause_reason: null,
      last_decline_code: null,
      last_decline_at: null,
      resumed_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  if (error) throw error;

  try {
    await notifyManage(
      userId,
      await resumeNotifyPayload(sub, week, charge, { charged: false })
    );
  } catch (err) {
    console.warn('[subscriptions] resume email failed:', err.message);
  }
  return {
    ok: true,
    status: 'active',
    pending: false,
    week,
    charge,
    charged: false,
  };
}

async function cancelSubscription(userId, subscriptionId) {
  // Same as pause: skip this Sunday when we still can, keep card and plan
  // until they resume. The Cancel button is a different conversation, not
  // a different outcome.
  return pauseSubscription(userId, subscriptionId);
}

/**
 * Force-cancel one subscription because its plan was discontinued.
 * Same skip-vs-keep rule as pause (paid/locked, not the Tuesday clock).
 * Never refunds — first box is non-refundable; a paid open Sunday still ships.
 */
async function cancelForPlanDiscontinued(sub) {
  if (!sub?.id) throw new SubscriptionError(400, 'Subscription id is required.');
  if (sub.status === 'cancelled') {
    return { ok: true, already: true, pending: false, refunded_cents: 0 };
  }

  const { week, charge, cycle } = await currentCycleFor(sub);
  const alreadyPaid = Boolean(cycle && Number(cycle.plan_paid_cents) > 0);
  const alreadyLocked = cycle?.status === 'locked';
  const reason = 'plan_discontinued';

  async function skipLaterOpenWeeks() {
    const today = torontoYmd(new Date());
    const { data: openRows, error: openErr } = await supabase
      .from('subscription_cycles')
      .select('*')
      .eq('subscription_id', sub.id)
      .eq('status', 'open')
      .gte('delivery_date', today);
    if (openErr) throw openErr;
    for (const row of openRows || []) {
      await skipOpenCycle(row);
    }
  }

  async function cancelNow({ keptLockedSunday = false } = {}) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
        pending_status: null,
        pause_reason: null,
      })
      .eq('id', sub.id);
    if (error) throw error;
    return {
      ok: true,
      pending: false,
      refunded_cents: 0,
      week,
      charge,
      user_id: sub.user_id,
      kept_locked_sunday: keptLockedSunday,
    };
  }

  async function pendingCancel() {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        pending_status: 'cancelled',
        cancelled_reason: reason,
      })
      .eq('id', sub.id);
    if (error) throw error;
    return {
      ok: true,
      pending: true,
      refunded_cents: 0,
      week,
      charge,
      user_id: sub.user_id,
    };
  }

  // Already locked: this Sunday is fulfilled. Cancel now and skip any later open weeks.
  if (alreadyLocked) {
    await skipLaterOpenWeeks();
    return cancelNow({ keptLockedSunday: true });
  }

  // Paid open week: keep this Sunday (no refund), cancel after Wednesday lock.
  if (alreadyPaid) {
    return pendingCancel();
  }

  // Unpaid: skip every open unpaid week. If the charge job wins the race, keep that Sunday.
  const { data: openRows, error: openErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id)
    .eq('status', 'open');
  if (openErr) throw openErr;

  let keptAfterRace = null;
  for (const row of openRows || []) {
    if (!row || Number(row.plan_paid_cents) > 0) {
      if (row && Number(row.plan_paid_cents) > 0) keptAfterRace = row;
      continue;
    }
    const skipResult = await skipOpenCycle(row);
    const after = skipResult.cycle || row;
    if (
      !skipResult.skipped
      && after
      && (Number(after.plan_paid_cents) > 0 || after.status === 'locked')
    ) {
      keptAfterRace = after;
    }
  }
  if (keptAfterRace) {
    return pendingCancel();
  }

  return cancelNow();
}

/**
 * Soft-discontinue a plan: hide from signups, force-cancel active/paused subs.
 */
async function discontinuePlan(planId) {
  if (!planId) throw new SubscriptionError(400, 'Plan id is required.');
  if (process.env.ALLOW_PLAN_DISCONTINUE !== 'true') {
    throw new SubscriptionError(
      403,
      'Plan discontinuations are handled by Tayrine so every subscriber can be notified. Email hello@earthtableco.ca.'
    );
  }

  const plan = await getPlanById(planId);
  if (!plan) throw new SubscriptionError(404, 'Plan not found.');

  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select(`
      id, user_id, status, plan_id, pending_status, pause_reason, cancelled_reason,
      stripe_customer_id, stripe_payment_method_id, delivery, delivery_postal_code,
      pickup_time_slot, special_note, created_at,
      subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents )
    `)
    .eq('plan_id', planId)
    .in('status', ['active', 'paused']);
  if (subErr) throw subErr;

  const rows = subs || [];
  if (plan.discontinued_at && rows.length === 0) {
    throw new SubscriptionError(409, 'This plan is already discontinued.');
  }

  let updatedPlan = plan;
  if (!plan.discontinued_at) {
    const discontinuedAt = new Date().toISOString();
    const { data, error: planErr } = await supabase
      .from('subscription_plans')
      .update({
        is_active: false,
        discontinued_at: discontinuedAt,
      })
      .eq('id', planId)
      .select()
      .single();
    if (planErr) throw planErr;
    updatedPlan = data;
  }

  let cancelledCount = 0;
  let refundedCount = 0;
  let pendingCount = 0;
  const failures = [];

  const { getUserByAuthId } = require('./user');
  const { sendEmail } = require('../utils/email');
  const {
    renderPlanDiscontinuedEmail,
    renderOwnerPlanDiscontinuedEmail,
  } = require('../utils/emailTemplates');
  const { sendOwnerEmail } = require('../emails/sendSubscriptionMail');

  for (const sub of rows) {
    try {
      const result = await cancelForPlanDiscontinued(sub);
      if (result.already) continue;
      cancelledCount += 1;
      if (result.pending || result.kept_locked_sunday) pendingCount += 1;
      if (result.refunded_cents > 0) refundedCount += 1;

      try {
        const user = await getUserByAuthId(sub.user_id);
        if (!user?.email) continue;
        const msg = renderPlanDiscontinuedEmail({
          firstName: user.first_name,
          planName: plan.name,
          mealCount: plan.meal_count,
          deliveryLabel: result.week?.delivery_label,
          pending: !!result.pending,
          keptLockedSunday: !!result.kept_locked_sunday,
          refundedCents: result.refunded_cents,
        });
        await sendEmail({
          to: user.email,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          replyTo: 'hello@earthtableco.ca',
        });
      } catch (err) {
        console.warn('[subscriptions] discontinue customer email failed:', sub.id, err.message);
      }
    } catch (err) {
      failures.push({ subscription_id: sub.id, error: err.message || String(err) });
      console.error('[subscriptions] discontinue cancel failed:', sub.id, err.message);
    }
  }

  if (cancelledCount > 0) {
    try {
      const ownerMsg = renderOwnerPlanDiscontinuedEmail({
        planName: plan.name,
        mealCount: plan.meal_count,
        cancelledCount,
        refundedCount,
        pendingCount,
      });
      await sendOwnerEmail(ownerMsg);
    } catch (err) {
      console.warn('[subscriptions] discontinue owner email failed:', err.message);
    }
  }

  const { count: remaining, error: countErr } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .in('status', ['active', 'paused']);
  if (countErr) throw countErr;

  return {
    ok: true,
    plan: {
      ...updatedPlan,
      display_description: plan.display_description,
      subscriber_count: remaining || 0,
    },
    cancelled_count: cancelledCount,
    refunded_count: refundedCount,
    pending_count: pendingCount,
    failures,
  };
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
      id, user_id, paused_at, created_at, pause_reason,
      subscription_plans!subscriptions_plan_id_fkey ( meal_count )
    `)
    .eq('status', 'paused');
  if (error) throw error;

  const nudgeWeeks = CADENCE.PAUSE_NUDGE_WEEKS || [1, 4];
  // payment_failed uses its own recovery emails — don't nudge as a voluntary pause.
  const rows = (paused || []).filter((row) => row.pause_reason !== 'payment_failed');
  let emailed = 0;
  let skipped = 0;
  const failures = [];
  for (const row of rows) {
    const week = pauseNudgeWeek(row.paused_at || row.created_at, now);
    if (!nudgeWeeks.includes(week)) {
      skipped += 1;
      continue;
    }
    try {
      const sent = await notifyManage(row.user_id, {
        kind: 'pause_nudge',
        mealCount: row.subscription_plans?.meal_count,
        deliveryLabel: signup.first_delivery_label,
        chargeLabel: charge.charge_label,
      });
      if (sent) emailed += 1;
      else skipped += 1;
    } catch (err) {
      failures.push(err.message || String(err));
      console.warn('[subscriptions] pause reminder failed:', err.message);
    }
  }

  await supabase
    .from('cutoff_runs')
    .update({
      finished_at: new Date().toISOString(),
      stats: { emailed, failed: failures.length, skipped },
    })
    .eq('week_key', weekKey)
    .eq('job', 'pause_reminder');

  return { ok: true, week_key: weekKey, emailed, failed: failures.length, skipped };
}

const DEADLINE_NOTICE_YMD = '2026-10-10';
const DEADLINE_NOTICE_PREF = 'deadline_notice_2026';

/**
 * One send on Saturday, October 10, 2026, 9:00 AM Toronto (13:00 UTC).
 * Each active subscriber is emailed once. A later run the same day skips anyone already marked.
 */
async function sendDeadlineNotice(now = new Date()) {
  const ymd = torontoYmd(now);
  if (ymd !== DEADLINE_NOTICE_YMD) {
    return { ok: true, skipped: true, reason: 'not_send_day', ymd };
  }

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id, user_id')
    .eq('status', 'active');
  if (error) throw error;

  const userIds = [...new Set((subs || []).map((row) => row.user_id).filter(Boolean))];
  let emailed = 0;
  let skipped = 0;
  const failures = [];

  for (const userId of userIds) {
    try {
      const user = await getUserByAuthId(userId);
      if (!user?.email) {
        skipped += 1;
        continue;
      }
      const prefs = user.email_prefs && typeof user.email_prefs === 'object' && !Array.isArray(user.email_prefs)
        ? { ...user.email_prefs }
        : {};
      if (prefs[DEADLINE_NOTICE_PREF]) {
        skipped += 1;
        continue;
      }
      const msg = renderSubscriptionDeadlineEmail({ firstName: user.first_name });
      await sendCustomerEmail({ to: user.email, msg });
      prefs[DEADLINE_NOTICE_PREF] = true;
      await updateUserByAuthId(userId, { email_prefs: prefs });
      emailed += 1;
    } catch (err) {
      failures.push({ user_id: userId, error: err.message || String(err) });
      console.warn('[subscriptions] deadline notice failed:', userId, err.message);
    }
  }

  return { ok: true, ymd, emailed, skipped, failed: failures.length, failures };
}

/**
 * Following Sunday after the charged/locked week — where a pending plan change starts.
 * Creates the row early so confirmed meals can land before Wednesday lock opens it.
 */
async function ensureFollowingWeekCycle(sub, nextPlan, settings, week, sourceCycle) {
  const nextSunday = nextOpenSunday(week.delivery_date);
  if (!nextSunday) {
    throw new SubscriptionError(400, 'Could not find the following Sunday for this plan change.');
  }

  const { data: existing, error: findErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id)
    .eq('delivery_date', nextSunday)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    if (existing.status !== 'open') {
      throw new SubscriptionError(400, 'The following week is already locked. Try again after this Sunday.');
    }
    const nextMealCount = Number(nextPlan.meal_count) || null;
    const { error: updErr } = await supabase
      .from('subscription_cycles')
      .update({
        plan_id: nextPlan.id,
        plan_price_cents: Number(nextPlan.price_cents) || 0,
        meal_count: nextMealCount,
      })
      .eq('id', existing.id);
    if (updErr) throw updErr;
    return {
      ...existing,
      plan_id: nextPlan.id,
      plan_price_cents: Number(nextPlan.price_cents) || 0,
      meal_count: nextMealCount,
    };
  }

  const delivery = sourceCycle ? !!sourceCycle.delivery : !!sub.delivery;
  const { data: created, error: insErr } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: nextPlan.id,
      plan_price_cents: Number(nextPlan.price_cents) || 0,
      meal_count: Number(nextPlan.meal_count) || null,
      cutoff_at: cutoffAtForSunday(nextSunday, settings) || getSignupDates(new Date(), settings || {}).cutoff_at,
      delivery_date: nextSunday,
      pickup_date: delivery ? null : nextSunday,
      status: 'open',
      delivery,
      delivery_postal_code: sourceCycle?.delivery_postal_code ?? sub.delivery_postal_code ?? null,
      pickup_time_slot: sourceCycle?.pickup_time_slot ?? sub.pickup_time_slot ?? null,
      special_note: sourceCycle?.special_note ?? sub.special_note ?? null,
      delivery_fee_cents: delivery ? (Number(sourceCycle?.delivery_fee_cents) || 0) : 0,
      plan_paid_cents: 0,
      addon_paid_cents: 0,
      promo_percent: 0,
    })
    .select('*')
    .single();
  if (insErr) throw insErr;
  return created;
}

async function changeSubscriptionPlan(userId, subscriptionId, planId, { meals, addons } = {}) {
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

  const settings = await getSettings();
  const { week, charge, cycle } = await currentCycleFor(sub);
  const currentCount = Number(sub.subscription_plans?.meal_count) || 0;
  const nextCount = Number(nextPlan.meal_count) || 0;

  // Plan changes must confirm meals before the change finishes.
  const { qtyLines } = require('./subscriptionCheckout');
  const { planChangeMealsOk, planChangeDefersToNextWeek } = require('../utils/mealCountMatch');
  const mealLines = qtyLines(meals);
  const mealQty = mealLines.reduce((sum, line) => sum + line.quantity, 0);
  if (!planChangeMealsOk(mealQty, nextCount)) {
    throw new SubscriptionError(
      400,
      `Pick exactly ${nextCount} meal${nextCount === 1 ? '' : 's'} before finishing this plan change.`
    );
  }

  // Already-paid weeks (first box at signup, or after Tuesday charge) keep this Sunday's
  // size — same idea as first-box pause. No mid-week upgrade charge / downgrade refund.
  const alreadyPaid = Number(cycle?.plan_paid_cents) || 0;
  const deferNext = planChangeDefersToNextWeek({
    beforeCharge: charge.before_wednesday,
    planPaidCents: alreadyPaid,
  });

  if (deferNext) {
    const following = await ensureFollowingWeekCycle(sub, nextPlan, settings || {}, week, cycle);
    await writeCyclePlanAndAddons(following.id, meals, addons || [], { mealCount: nextCount });

    const { error } = await supabase
      .from('subscriptions')
      .update({
        pending_plan_id: nextPlan.id,
        previous_plan_id: sub.plan_id,
        plan_changed_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
    if (error) throw error;
    await recordPlanChange({
      subscriptionId: sub.id,
      fromPlanId: sub.plan_id,
      toPlanId: nextPlan.id,
      timing: 'pending',
      mealsQty: mealQty,
      deliveryDate: following.delivery_date,
    });
    try {
      const box = await labeledBoxItemsForCycle(following.id);
      await notifyManage(userId, {
        kind: 'plan_next',
        mealCount: currentCount,
        oldMealCount: currentCount,
        nextMealCount: nextCount,
        deliveryLabel: week.delivery_label,
        chargeLabel: charge.charge_label,
        meals: box.meals,
        addons: box.addons,
      });
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

  if (!cycle || cycle.status !== 'open') {
    throw new SubscriptionError(400, 'This week\'s box is locked. You can still change next week\'s meals from My Subscriptions.');
  }

  // Unpaid week before charge: swap plan now; Tuesday charges the new price.
  const newPrice = Number(nextPlan.price_cents) || 0;
  await writeCyclePlanAndAddons(cycle.id, meals, addons || [], { mealCount: nextCount });

  const { error: subErr } = await supabase
    .from('subscriptions')
    .update({
      plan_id: nextPlan.id,
      pending_plan_id: null,
      previous_plan_id: sub.plan_id,
      plan_changed_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  if (subErr) throw subErr;

  const { error: cycleErr } = await supabase
    .from('subscription_cycles')
    .update({
      plan_id: nextPlan.id,
      plan_price_cents: newPrice,
      meal_count: nextCount,
    })
    .eq('id', cycle.id);
  if (cycleErr) throw cycleErr;

  await recordPlanChange({
    subscriptionId: sub.id,
    fromPlanId: sub.plan_id,
    toPlanId: nextPlan.id,
    timing: 'applied',
    mealsQty: mealQty,
    deliveryDate: cycle.delivery_date,
  });

  try {
    const box = await labeledBoxItemsForCycle(cycle.id);
    await notifyManage(userId, {
      kind: 'plan_now',
      mealCount: nextCount,
      oldMealCount: currentCount,
      nextMealCount: nextCount,
      deliveryLabel: week.delivery_label,
      chargeLabel: charge.charge_label,
      cutoffLabel: week.cutoff_label,
      meals: box.meals,
      addons: box.addons,
    });
  } catch (err) {
    console.warn('[subscriptions] plan-change email failed:', err.message);
  }

  return {
    ok: true,
    pending: false,
    needs_meals: false,
    week,
    charge,
    plan: nextPlan,
  };
}

module.exports = {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  cancelForPlanDiscontinued,
  discontinuePlan,
  changeSubscriptionPlan,
  sendPauseReminders,
  sendDeadlineNotice,
  notifyResumeAfterPaymentRecovery,
  assertResumeMealsReady,
};

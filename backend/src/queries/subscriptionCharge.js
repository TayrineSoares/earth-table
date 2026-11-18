/**
 * Weekly jobs: Tuesday 9:00 AM ET plan+delivery charge + receipt email,
 * Wednesday 5:00 PM ET extras + kitchen lock.
 * Safe to re-run: already-paid cycles and locked rows are skipped.
 *
 * Vercel cron UTC (see also cronRoutes.js header + vercel.json):
 * - Charge: 13:00 and 14:00 UTC Tuesday — covers EDT/EST so one fire is at/after 9am Toronto.
 * - Lock: 22:00 UTC Wednesday only — at/after 5pm Toronto year-round (5pm EST / 6pm EDT).
 *   Intentionally not 21:00 UTC: that is 4pm EST (too early to freeze meals).
 */

const supabase = require('../../supabase/db');
const { createOrderWithProducts } = require('./order');
const { getUserByAuthId } = require('./user');
const {
  getSettings,
  getPlanById,
  copyPlanMealsIfEmpty,
  firstBoxSunday,
  firstBoxStillDue,
  reopenSkippedCycle,
  recordOpsEvent,
} = require('./subscription');
const {
  renderSubscriptionManageEmail,
  renderOwnerLockEmail,
  renderSubscriptionHolidaySkipEmail,
  renderSubscriptionChargeEmail,
  renderSubscriptionLockEmail,
  renderSubscriptionMealMismatchEmail,
  renderOwnerMealMismatchEmail,
  renderOwnerPaymentFailedEmail,
  formatDollars,
} = require('../utils/emailTemplates');
const {
  sendCustomerEmail,
  sendOwnerEmail,
  cardForPaymentMethod,
  declineReasonFrom,
  emailPrefOn,
} = require('../emails/sendSubscriptionMail');
const {
  getSignupDates,
  getChargeDeadline,
  nextOpenSunday,
  isYmdBlocked,
  sundayLabelFromYmd,
  formatPickupSlot,
  formatTorontoStamp,
  lockPassedForSunday,
  cutoffAtForSunday,
} = require('./subscriptionWeek');
const { PICKUP_ADDRESS, DELIVERY_WINDOW } = require('../emails/subscriptionEmailSpec');
const { unsubscribeUrl } = require('../emails/unsubscribeToken');
const {
  sumPlanMealQty,
  resolvePlanMealNeed,
  mealCountMismatch: mealCountMismatchOf,
  shouldSeedPlanMealsFromSource,
} = require('../utils/mealCountMatch');

const HST = 1.13;

function getStripe() {
  return require('stripe')(process.env.STRIPE_SECRET_SK);
}

async function recordRun(weekKey, job, stats) {
  const { error } = await supabase
    .from('cutoff_runs')
    .upsert({
      week_key: weekKey,
      job,
      finished_at: new Date().toISOString(),
      stats,
    }, { onConflict: 'week_key,job' });
  if (error) console.warn('[subscriptions] cutoff_runs upsert failed:', error.message);
}

async function emailedIdsFor(weekKey, job) {
  const { data } = await supabase
    .from('cutoff_runs')
    .select('stats')
    .eq('week_key', weekKey)
    .eq('job', job)
    .maybeSingle();
  return new Set((data?.stats && data.stats.emailed_ids) || []);
}

/**
 * Second DST cron (charge's 13:00 then 14:00 UTC) must not email again.
 * Lock uses a single 22:00 UTC slot, so this mainly guards charge + force re-runs.
 * A run that recorded failures still retries; a clean run is done.
 */
async function jobAlreadyFinished(weekKey, job) {
  const { data } = await supabase
    .from('cutoff_runs')
    .select('finished_at, stats')
    .eq('week_key', weekKey)
    .eq('job', job)
    .maybeSingle();
  if (!data?.finished_at) return false;
  return (Number(data.stats?.failed) || 0) === 0;
}

async function sluggedItems(items) {
  const ids = [...new Set((items || []).map((item) => Number(item.product_id)).filter((id) => id > 0))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from('products').select('id, slug').in('id', ids);
  if (error) throw error;
  const names = new Map((data || []).map((row) => [Number(row.id), row.slug]));
  return (items || []).map((item) => ({
    slug: names.get(Number(item.product_id)) || 'Item',
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    kind: item.kind,
  }));
}

/**
 * Kitchen/customer meal lists must not use PostgREST nested embeds.
 * Those embeds can attach another cycle's items (or a leftover order's
 * products) onto this row. Always load by this cycle's id, then keep only
 * rows whose cycle_id matches.
 */
async function cycleItemsByCycleId(cycleId) {
  const id = String(cycleId || '');
  if (!id) return [];
  const { data, error } = await supabase
    .from('subscription_cycle_items')
    .select('id, cycle_id, product_id, quantity, unit_price_cents, kind')
    .eq('cycle_id', id);
  if (error) throw error;
  return (data || []).filter((item) => String(item.cycle_id) === id);
}

async function labeledItemsForCycle(cycleId) {
  return sluggedItems(await cycleItemsByCycleId(cycleId));
}

async function withCycleItems(cycle) {
  if (!cycle?.id) return cycle;
  return {
    ...cycle,
    subscription_cycle_items: await cycleItemsByCycleId(cycle.id),
  };
}

function itemsByKind(items, kind) {
  return (items || []).filter((item) => item.kind === kind);
}

function applyPromoPercent(cents, percent) {
  const raw = Math.max(0, Number(cents) || 0);
  const pct = Number(percent) || 0;
  if (pct <= 0) return raw;
  return Math.floor((raw * (100 - pct)) / 100);
}

function addonRawCents(cycle) {
  const items = cycle.subscription_cycle_items || [];
  let raw = 0;
  for (const item of items) {
    if (item.kind !== 'addon') continue;
    raw += (Number(item.unit_price_cents) || 0) * (Number(item.quantity) || 0);
  }
  return raw;
}

function addonDueCents(cycle, promoPercent = 0) {
  const raw = addonRawCents(cycle);
  const already = Number(cycle.addon_paid_cents) || 0;
  const pct = Number(cycle.promo_percent) || Number(promoPercent) || 0;
  // Apply first-week percent to the extras total, then subtract what was already billed.
  const discounted = applyPromoPercent(raw, pct);
  return Math.max(0, discounted - already);
}

function firstWeekDiscountLabel(code, kind) {
  const c = String(code || '').toUpperCase();
  if (!c) return 'First-week discount · first week only';
  const prefix = kind === 'referral' ? 'Referral' : 'Promo';
  return `${prefix} (${c}) · first week only`;
}

async function firstWeekDiscountKind(code) {
  const c = String(code || '').trim();
  if (!c) return 'promo';
  try {
    const { getPartnerByCode } = require('./partner');
    const partner = await getPartnerByCode(c);
    return partner ? 'referral' : 'promo';
  } catch (err) {
    console.warn('[subscriptions] discount kind lookup failed:', err.message);
    return 'promo';
  }
}

/** First cycle keeps first_promo_percent; later weeks are full price even if the subscription still has that flag. */
async function promoPercentForAddons(sub, cycle) {
  const stored = Number(cycle.promo_percent) || 0;
  if (stored > 0) return stored;
  const fromSub = Number(sub.first_promo_percent) || 0;
  if (!fromSub) return 0;
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('id, delivery_date')
    .eq('subscription_id', sub.id)
    .order('delivery_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return 0;
  if (data.id !== cycle.id && String(data.delivery_date) !== String(cycle.delivery_date)) return 0;
  return fromSub;
}

async function notifyUser(userId, payload) {
  const user = await getUserByAuthId(userId);
  const email = user?.email;
  if (!email) return;
  const card = payload.card || null;
  const msg = renderSubscriptionManageEmail({
    ...payload,
    firstName: user.first_name,
    cardBrand: card?.brand,
    last4: card?.last4,
  });
  await sendCustomerEmail({ to: email, msg });
}

function splitWin(delivery, pickupSlot) {
  const raw = delivery ? DELIVERY_WINDOW : formatPickupSlot(pickupSlot);
  const parts = String(raw || '').split(/\s*[–-]\s*/);
  return {
    start: (parts[0] || '').trim() || '—',
    end: (parts.slice(1).join(' – ') || '').trim() || '—',
  };
}

async function ownerBoxFrom(sub, cycle) {
  const user = await getUserByAuthId(sub.user_id);
  // Fresh query at send time, scoped to this cycle only — never nested
  // embed, never another request's items, never a leftover kitchen order.
  const labeled = await labeledItemsForCycle(cycle.id);
  const win = splitWin(!!cycle.delivery, cycle.pickup_time_slot);
  // Paused after charge/lock still ships — flag it on the kitchen summary.
  const keepSundayNote = sub.status === 'paused'
    ? 'Still delivering this Sunday — paused after charge/lock'
    : '';
  return {
    name: [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Customer',
    mealCount: Number(cycle.meal_count) || sub.subscription_plans?.meal_count,
    orderId: cycle.order_id || null,
    cycleId: cycle.id,
    delivery: !!cycle.delivery,
    method: cycle.delivery ? 'Delivery' : 'Pickup',
    windowStart: win.start,
    windowEnd: win.end,
    address: cycle.delivery
      ? (cycle.special_note || cycle.delivery_postal_code || '—')
      : PICKUP_ADDRESS,
    phone: user?.phone_number,
    email: user?.email,
    notes: cycle.special_note,
    keepSundayNote,
    meals: itemsByKind(labeled, 'plan'),
    extras: itemsByKind(labeled, 'addon'),
  };
}

async function loadSubsForSunday() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id, user_id, status, plan_id, pending_status, pending_plan_id, pause_reason,
      cancelled_reason, cancelled_at,
      stripe_customer_id, stripe_payment_method_id, delivery, delivery_postal_code,
      pickup_time_slot, special_note,
      first_promo_percent, first_promo_applied, first_promo_code,
      subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents )
    `)
    .in('status', ['active', 'paused']);
  if (error) throw error;
  return data || [];
}

async function cycleForSunday(subscriptionId, sunday) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .eq('delivery_date', sunday)
    .maybeSingle();
  if (error) throw error;
  return withCycleItems(data);
}

async function lastCycle(subscriptionId) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('delivery_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return withCycleItems(data);
}

async function previousCycle(subscriptionId, beforeYmd) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .lt('delivery_date', beforeYmd)
    .order('delivery_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return withCycleItems(data);
}

async function ensureCycle(sub, sunday, settings) {
  const existing = await cycleForSunday(sub.id, sunday);
  if (existing) {
    const src = await previousCycle(sub.id, existing.delivery_date);
    return src ? copyPlanMealsIfEmpty(existing, src) : existing;
  }
  const src = await lastCycle(sub.id);
  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
  const delivery = src ? !!src.delivery : !!sub.delivery;
  const { data: cycle, error } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: sub.plan_id,
      plan_price_cents: Number(plan?.price_cents) || Number(src?.plan_price_cents) || 0,
      meal_count: Number(plan?.meal_count) || Number(src?.meal_count) || null,
      cutoff_at: cutoffAtForSunday(sunday, settings) || getSignupDates(new Date(), settings || {}).cutoff_at,
      delivery_date: sunday,
      pickup_date: delivery ? null : sunday,
      status: 'open',
      delivery,
      delivery_postal_code: src?.delivery_postal_code || sub.delivery_postal_code,
      pickup_time_slot: src?.pickup_time_slot || sub.pickup_time_slot,
      special_note: src?.special_note || sub.special_note,
      delivery_fee_cents: delivery ? (Number(src?.delivery_fee_cents) || 0) : 0,
      plan_paid_cents: 0,
      addon_paid_cents: 0,
      promo_percent: 0,
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505') {
      const existing = await cycleForSunday(sub.id, sunday);
      const from = await previousCycle(sub.id, sunday);
      return from && existing ? copyPlanMealsIfEmpty(existing, from) : existing;
    }
    throw error;
  }
  // Same guard as openNextWeek / copyPlanMealsIfEmpty — never seed a short/over box
  // onto a different plan size when Tuesday charge creates the week.
  const need = Number(plan?.meal_count) || Number(cycle.meal_count) || 0;
  const { seed, mealQty, meals } = shouldSeedPlanMealsFromSource(
    src?.subscription_cycle_items,
    need
  );
  if (seed && meals.length) {
    await supabase.from('subscription_cycle_items').insert(
      meals.map((item) => ({
        cycle_id: cycle.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        kind: 'plan',
      }))
    );
    return cycleForSunday(sub.id, sunday);
  }
  if (meals.length && need > 0) {
    await recordOpsEvent({
      kind: 'copy_forward_skipped',
      subscriptionId: sub.id,
      cycleId: cycle.id,
      sourceCycleId: src?.id || null,
      deliveryDate: sunday,
      need,
      got: mealQty,
      note: 'ensureCycle: source qty ≠ plan meal_count',
    });
  }
  return withCycleItems(cycle);
}

/**
 * @param {{ idempotencySuffix?: string }} [opts]
 *   Tuesday job omits suffix (stable key). Resume / card-retry pass a suffix so a
 *   prior declined PI is not replayed from Stripe's ~24h idempotency cache.
 */
async function chargePlanDelivery(sub, cycle, sunday, opts = {}) {
  // Re-read so a pause-skip that landed mid-job is not charged.
  const { data: live, error: liveErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('id', cycle.id)
    .maybeSingle();
  if (liveErr) throw liveErr;
  const row = live || cycle;
  if (!row || row.status === 'skipped' || row.status === 'locked') {
    return { charged: false, skipped: true, amount: 0, planCents: 0, deliveryCents: 0 };
  }

  const already = Number(row.plan_paid_cents) || 0;
  const planCents = Number(row.plan_price_cents) || Number(sub.subscription_plans?.price_cents) || 0;
  const fee = row.delivery ? (Number(row.delivery_fee_cents) || 0) : 0;
  const due = Math.max(0, planCents - already);
  const amount = Math.round(due * HST) + Math.round(fee * HST);
  if (amount < 50) {
    if (due > 0 || (fee > 0 && already === 0)) {
      await supabase
        .from('subscription_cycles')
        .update({
          plan_paid_cents: planCents,
          charged_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('status', 'open')
        .lte('plan_paid_cents', 0);
    }
    return { charged: false, skipped: true, amount: 0, planCents: due, deliveryCents: fee };
  }
  if (!sub.stripe_customer_id || !sub.stripe_payment_method_id) {
    throw new Error('no_card');
  }
  const stripe = getStripe();
  const suffix = opts.idempotencySuffix ? `-${opts.idempotencySuffix}` : '';
  const pi = await stripe.paymentIntents.create({
    amount,
    currency: 'cad',
    customer: sub.stripe_customer_id,
    payment_method: sub.stripe_payment_method_id,
    off_session: true,
    confirm: true,
    description: 'Weekly plan',
    metadata: {
      kind: 'subscription_plan',
      subscription_id: sub.id,
      cycle_id: row.id,
    },
  }, {
    idempotencyKey: `sub-plan-${row.id}-${sunday}-${sub.stripe_payment_method_id}${suffix}`,
  });
  const patch = {
    plan_paid_cents: planCents,
    charged_at: new Date().toISOString(),
  };
  if (!row.stripe_payment_intent_id && pi?.id) patch.stripe_payment_intent_id = pi.id;
  // Only mark paid if still open/unpaid — pause may have skipped between PI and write.
  const { data: paidRow, error } = await supabase
    .from('subscription_cycles')
    .update(patch)
    .eq('id', row.id)
    .eq('status', 'open')
    .lte('plan_paid_cents', 0)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!paidRow) {
    // Sibling writer may have already attached this PI — do not refund a good charge.
    const { data: current, error: reErr } = await supabase
      .from('subscription_cycles')
      .select('id, status, plan_paid_cents, stripe_payment_intent_id')
      .eq('id', row.id)
      .maybeSingle();
    if (reErr) throw reErr;
    if (
      current
      && Number(current.plan_paid_cents) > 0
      && pi?.id
      && String(current.stripe_payment_intent_id || '') === String(pi.id)
    ) {
      return { charged: true, skipped: false, amount, planCents: due, deliveryCents: fee };
    }
    // Paused/skipped after Stripe charged — refund so skip wins the race.
    try {
      await stripe.refunds.create({
        payment_intent: pi.id,
        reason: 'requested_by_customer',
        metadata: { kind: 'subscription_charge_race_refund', cycle_id: row.id },
      });
    } catch (refundErr) {
      console.warn('[subscriptions] charge/pause race refund failed:', row.id, refundErr.message);
    }
    return { charged: false, skipped: true, amount: 0, planCents: due, deliveryCents: fee };
  }
  return { charged: true, skipped: false, amount, planCents: due, deliveryCents: fee };
}

async function markPaymentFailed(sub, sunday, cutoffLabel, stripeErr) {
  const declineReason = declineReasonFrom(stripeErr);
  await supabase
    .from('subscriptions')
    .update({
      status: 'paused',
      pause_reason: 'payment_failed',
      paused_at: new Date().toISOString(),
      last_decline_code: declineReason,
      last_decline_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  const card = await cardForPaymentMethod(sub.stripe_payment_method_id);
  const planPrice = formatDollars(sub.subscription_plans?.price_cents || 0);
  const fulfillmentDate = sundayLabelFromYmd(sunday);
  try {
    await notifyUser(sub.user_id, {
      kind: 'payment_failed',
      mealCount: sub.subscription_plans?.meal_count,
      fulfillmentDate,
      deliveryLabel: fulfillmentDate,
      cutoffLabel,
      planPrice,
      card,
    });
  } catch (err) {
    console.warn('[subscriptions] payment-failed email failed:', err.message);
  }
  try {
    const user = await getUserByAuthId(sub.user_id);
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Customer';
    const msg = renderOwnerPaymentFailedEmail({
      customerName: name,
      amount: planPrice,
      fulfillmentDate,
      cardBrand: card?.brand,
      last4: card?.last4,
      declineReason,
      dateTime: formatTorontoStamp(new Date()),
      cutoffDateTime: cutoffLabel,
    });
    await sendOwnerEmail(msg);
  } catch (err) {
    console.warn('[subscriptions] owner payment-failed email failed:', err.message);
  }
}

async function sendChargeNotice(sub, cycle, sunday, dates, chargeResult) {
  const user = await getUserByAuthId(sub.user_id);
  if (!user?.email) return;
  const charged = !!chargeResult?.charged;
  // Receipts always send. Already-paid Tuesday mail is a meal reminder — honor unsubscribe.
  if (!charged && !emailPrefOn(user, 'wednesday_reminder')) return;
  const labeled = await labeledItemsForCycle(cycle.id);
  const card = charged ? await cardForPaymentMethod(sub.stripe_payment_method_id) : null;
  const msg = renderSubscriptionChargeEmail({
    firstName: user.first_name,
    mealCount: sub.subscription_plans?.meal_count,
    delivery: !!cycle.delivery,
    deliveryLabel: sundayLabelFromYmd(sunday),
    pickupSlot: cycle.pickup_time_slot,
    cutoffLabel: dates.cutoff_label,
    charged,
    planCents: charged ? (Number(chargeResult.planCents) || 0) : 0,
    deliveryCents: charged ? (Number(chargeResult.deliveryCents) || 0) : 0,
    chargedCents: charged ? (Number(chargeResult.amount) || 0) : 0,
    meals: itemsByKind(labeled, 'plan'),
    addons: itemsByKind(labeled, 'addon'),
    subscriptionId: sub.id,
    cardBrand: card?.brand,
    last4: card?.last4,
    unsubscribeHref: charged ? undefined : unsubscribeUrl(sub.user_id),
  });
  await sendCustomerEmail({ to: user.email, msg });
}

async function sendLockNotice(sub, cycle, sunday, addonResult) {
  const user = await getUserByAuthId(sub.user_id);
  if (!user?.email) return;
  const items = await cycleItemsByCycleId(cycle.id);
  const labeled = await sluggedItems(items);
  const chargedAddons = !!addonResult?.charged;
  const card = chargedAddons ? await cardForPaymentMethod(sub.stripe_payment_method_id) : null;
  const due = chargedAddons ? (Number(addonResult.due) || 0) : 0;
  const chargedCents = chargedAddons ? (Number(addonResult.amount) || 0) : 0;
  const raw = addonRawCents({ subscription_cycle_items: items });
  const pct = Number(cycle.promo_percent) || (chargedAddons ? await promoPercentForAddons(sub, cycle) : 0);
  const discountCents = chargedAddons && pct > 0 ? Math.max(0, raw - due) : 0;
  const discountKind = discountCents > 0
    ? await firstWeekDiscountKind(sub.first_promo_code)
    : '';
  const discountLabel = discountCents > 0
    ? firstWeekDiscountLabel(sub.first_promo_code, discountKind)
    : '';
  const planMealCount = Number(cycle.meal_count) || Number(sub.subscription_plans?.meal_count) || 0;
  const msg = renderSubscriptionLockEmail({
    firstName: user.first_name,
    mealCount: planMealCount,
    delivery: !!cycle.delivery,
    deliveryLabel: sundayLabelFromYmd(sunday),
    pickupSlot: cycle.pickup_time_slot,
    postalCode: cycle.delivery_postal_code,
    address: cycle.delivery ? (cycle.special_note || cycle.delivery_postal_code) : undefined,
    notes: cycle.special_note,
    chargedAddons,
    addonCents: discountCents > 0 ? raw : due,
    discountCents,
    discountLabel,
    chargedCents,
    addonItems: itemsByKind(labeled, 'addon'),
    meals: itemsByKind(labeled, 'plan'),
    cardBrand: card?.brand,
    last4: card?.last4,
  });
  await sendCustomerEmail({ to: user.email, msg });
}

/** Plan size vs selected meals at lock — customer is already billed. */
async function mealCountMismatch(sub, cycle) {
  const meals = (await cycleItemsByCycleId(cycle.id)).filter((item) => item.kind === 'plan');
  const got = sumPlanMealQty(meals);
  const need = resolvePlanMealNeed(cycle.meal_count, sub.subscription_plans?.meal_count);
  const mismatch = mealCountMismatchOf(got, need);
  if (!mismatch) return null;
  return { need: mismatch.need, got: mismatch.got, meals };
}

async function sendMealMismatchNotices(sub, cycle, sunday, mismatch) {
  if (!mismatch) return;
  const labeled = await sluggedItems(mismatch.meals);
  const mealLines = itemsByKind(labeled, 'plan');
  const deliveryLabel = sundayLabelFromYmd(sunday);
  const user = await getUserByAuthId(sub.user_id);

  await recordOpsEvent({
    kind: 'lock_meal_mismatch',
    subscriptionId: sub.id,
    cycleId: cycle.id,
    deliveryDate: sunday,
    need: mismatch.need,
    got: mismatch.got,
    orderId: cycle.order_id || null,
    note: mismatch.got < mismatch.need ? 'short at lock' : 'over at lock',
  });

  const billed = Number(cycle.plan_paid_cents) > 0;

  if (user?.email) {
    try {
      const msg = renderSubscriptionMealMismatchEmail({
        firstName: user.first_name,
        mealCount: mismatch.need,
        selectedCount: mismatch.got,
        deliveryLabel,
        meals: mealLines,
        billed,
      });
      await sendCustomerEmail({ to: user.email, msg });
    } catch (err) {
      console.warn('[subscriptions] meal-mismatch customer email failed:', sub.id, err.message);
    }
  }

  try {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
      || user?.email
      || 'Customer';
    const msg = renderOwnerMealMismatchEmail({
      customerName: name,
      email: user?.email,
      phone: user?.phone_number,
      mealCount: mismatch.need,
      selectedCount: mismatch.got,
      deliveryLabel,
      orderId: cycle.order_id || null,
      meals: mealLines,
      billed,
    });
    await sendOwnerEmail(msg);
  } catch (err) {
    console.warn('[subscriptions] meal-mismatch owner email failed:', sub.id, err.message);
  }
}

async function runPlanCharge({ force = false, now = new Date() } = {}) {
  const settings = await getSettings();
  const dates = getSignupDates(now, settings || {});
  const sunday = dates.job_sunday;
  const charge = getChargeDeadline(now, settings || {}, sunday);
  if (!force && charge.before_wednesday) {
    return { ok: true, skipped: true, reason: 'before_charge', sunday };
  }
  if (!force && await jobAlreadyFinished(sunday, 'wednesday_charge')) {
    return { ok: true, skipped: true, reason: 'already_ran', sunday };
  }

  if (isYmdBlocked(sunday)) {
    const skipped = await skipHolidayWeek(sunday, charge.charge_label);
    await recordRun(sunday, 'wednesday_charge', { holiday: true, ...skipped });
    return { ok: true, holiday: true, sunday, ...skipped };
  }

  const subs = await loadSubsForSunday();
  let charged = 0;
  let already = 0;
  let skipped = 0;
  let emailed = 0;
  const emailedIds = await emailedIdsFor(sunday, 'wednesday_charge');
  const failures = [];

  for (const sub of subs) {
    // Paused plans never auto-charge — including payment_failed. Recovery is
    // resume or update-card (retryFailedCharge), not the Tuesday job.
    if (sub.status === 'paused') {
      skipped += 1;
      continue;
    }
    let cycle;
    let weekSunday = sunday;
    try {
      cycle = await ensureCycle(sub, weekSunday, settings);
      // Admin "run now" after Wednesday lock: bill the newly opened week, not the locked one.
      if (force && cycle && (cycle.status === 'locked' || cycle.status === 'skipped')) {
        weekSunday = nextOpenSunday(weekSunday);
        cycle = await ensureCycle(sub, weekSunday, settings);
      }
    } catch (err) {
      failures.push({ subscription_id: sub.id, error: err.message || String(err) });
      continue;
    }
    if (!cycle || cycle.status === 'skipped' || cycle.status === 'locked') {
      skipped += 1;
      continue;
    }

    let chargeResult = { charged: false, skipped: true, amount: 0, planCents: 0, deliveryCents: 0 };
    if (Number(cycle.plan_paid_cents) > 0) {
      already += 1;
    } else {
      try {
        chargeResult = await chargePlanDelivery(sub, cycle, weekSunday);
        if (chargeResult.charged) charged += 1;
        else already += 1;
      } catch (err) {
        failures.push({ subscription_id: sub.id, error: err.message || String(err) });
        console.warn('[subscriptions] Plan charge failed:', sub.id, err.message);
        await markPaymentFailed(sub, weekSunday, dates.cutoff_label, err);
        continue;
      }
    }

    if (!emailedIds.has(sub.id)) {
      try {
        await sendChargeNotice(sub, cycle, weekSunday, dates, chargeResult);
        emailedIds.add(sub.id);
        emailed += 1;
      } catch (err) {
        console.warn('[subscriptions] Charge email failed:', sub.id, err.message);
      }
    }

    // After this Sunday is paid, apply pending pause immediately so status is
    // Paused (not Active+pending) until Wednesday lock. Pending cancel still
    // waits for lock so the kitchen job still loads the row.
    const weekPaid = Number(cycle.plan_paid_cents) > 0 || Boolean(chargeResult.charged);
    if (sub.pending_status === 'paused' && weekPaid) {
      try {
        await applyPendingAfterLock({ ...sub, pending_status: 'paused' });
      } catch (err) {
        failures.push({ subscription_id: sub.id, error: `pending pause: ${err.message || err}` });
      }
    }
  }

  const stats = {
    charged,
    already,
    skipped,
    failed: failures.length,
    emailed,
    emailed_ids: [...emailedIds],
  };
  await recordRun(sunday, 'wednesday_charge', stats);
  return { ok: true, sunday, ...stats, failures };
}

async function skipHolidayWeek(sunday, chargeLabel) {
  const { data: cycles } = await supabase
    .from('subscription_cycles')
    .select('id, subscription_id, status')
    .eq('delivery_date', sunday)
    .eq('status', 'open');
  for (const cycle of cycles || []) {
    await supabase.from('subscription_cycles').update({ status: 'skipped' }).eq('id', cycle.id);
  }
  const subs = await loadSubsForSunday();
  let emailed = 0;
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    try {
      const user = await getUserByAuthId(sub.user_id);
      if (!user?.email) continue;
      const nextSunday = sundayLabelFromYmd(nextOpenSunday(sunday));
      const msg = renderSubscriptionHolidaySkipEmail({
        firstName: user.first_name,
        skippedSunday: sundayLabelFromYmd(sunday),
        nextSunday,
        chargeLabel,
      });
      await sendCustomerEmail({ to: user.email, msg });
      emailed += 1;
    } catch (err) {
      console.warn('[subscriptions] holiday skip email failed:', err.message);
    }
  }
  try {
      const nextSunday = sundayLabelFromYmd(nextOpenSunday(sunday));
      const msg = renderSubscriptionHolidaySkipEmail({
        skippedSunday: sundayLabelFromYmd(sunday),
        nextSunday,
        owner: true,
      });
      await sendOwnerEmail(msg);
    } catch (err) {
      console.warn('[subscriptions] holiday owner email failed:', err.message);
    }
  return { emailed, skipped_cycles: (cycles || []).length };
}

async function chargeAddons(sub, cycle, sunday) {
  const pct = await promoPercentForAddons(sub, cycle);
  if (pct > 0 && Number(cycle.promo_percent) !== pct) {
    await supabase.from('subscription_cycles').update({ promo_percent: pct }).eq('id', cycle.id);
    cycle.promo_percent = pct;
  }
  const due = addonDueCents(cycle, pct);
  const amount = Math.round(due * HST);
  if (amount < 50) return { charged: false, amount: 0, due: 0 };
  if (!sub.stripe_customer_id || !sub.stripe_payment_method_id) {
    throw new Error('no_card');
  }
  const stripe = getStripe();
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
    idempotencyKey: `sub-addon-${cycle.id}-${sunday}`,
  });
  const paid = Number(cycle.addon_paid_cents) || 0;
  await supabase
    .from('subscription_cycles')
    .update({ addon_paid_cents: paid + due })
    .eq('id', cycle.id);
  cycle.addon_paid_cents = paid + due;
  return { charged: true, amount, due };
}

/** Drop unpaid extras so the kitchen never cooks what Stripe declined. */
async function stripUnpaidAddonsAfterChargeFailure(sub, cycle, sunday, err) {
  const alreadyPaid = Number(cycle.addon_paid_cents) || 0;
  const when = sundayLabelFromYmd(sunday);
  const reason = declineReasonFrom(err);
  const user = await getUserByAuthId(sub.user_id);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
    || user?.email
    || 'Customer';

  if (alreadyPaid > 0) {
    try {
      await sendOwnerEmail({
        subject: `Add-on charge failed — ${name}, ${when}`,
        html: `<p><strong>${name}</strong>: add-on charge failed (${reason}) for ${when}. Some add-ons were already paid — check Admin before the kitchen run.</p>`,
        text: `${name}: add-on charge failed (${reason}) for ${when}. Some add-ons were already paid — check Admin.`,
      });
    } catch (mailErr) {
      console.warn('[subscriptions] addon-fail owner email failed:', mailErr.message);
    }
    return { stripped: false };
  }

  const { error } = await supabase
    .from('subscription_cycle_items')
    .delete()
    .eq('cycle_id', cycle.id)
    .eq('kind', 'addon');
  if (error) throw error;
  if (Array.isArray(cycle.subscription_cycle_items)) {
    cycle.subscription_cycle_items = cycle.subscription_cycle_items.filter((item) => item.kind !== 'addon');
  }

  try {
    await notifyUser(sub.user_id, {
      kind: 'addons_dropped',
      mealCount: sub.subscription_plans?.meal_count,
      deliveryLabel: when,
      fulfillmentDate: when,
    });
  } catch (mailErr) {
    console.warn('[subscriptions] addon-dropped customer email failed:', mailErr.message);
  }
  try {
    await sendOwnerEmail({
      subject: `Add-on charge failed — ${name}, ${when}`,
      html: `<p><strong>${name}</strong>: add-on charge failed (${reason}) for ${when}. Unpaid extras were removed; plan meals still lock.</p>`,
      text: `${name}: add-on charge failed (${reason}) for ${when}. Unpaid extras removed; plan meals still lock.`,
    });
  } catch (mailErr) {
    console.warn('[subscriptions] addon-fail owner email failed:', mailErr.message);
  }
  return { stripped: true };
}

async function orderIdForThisCycle(cycle) {
  const cycleId = cycle?.id;
  if (!cycleId) return null;

  const belongs = (row) => row && String(row.subscription_cycle_id) === String(cycleId);

  if (cycle.order_id) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, subscription_cycle_id')
      .eq('id', cycle.order_id)
      .maybeSingle();
    if (!error && belongs(data)) return data.id;
  }

  const { data: bySession, error: sessionErr } = await supabase
    .from('orders')
    .select('id, subscription_cycle_id')
    .eq('stripe_session_id', `sub-cycle-${cycleId}`)
    .maybeSingle();
  if (!sessionErr && belongs(bySession)) return bySession.id;
  return null;
}

async function createKitchenOrder(sub, cycle, sunday) {
  const existingId = await orderIdForThisCycle(cycle);
  if (existingId) {
    cycle.order_id = existingId;
    await supabase
      .from('subscription_cycles')
      .update({ order_id: existingId, status: 'locked' })
      .eq('id', cycle.id);
    return existingId;
  }

  const items = await cycleItemsByCycleId(cycle.id);
  const products = items.map((item) => ({
    id: item.product_id,
    quantity: item.quantity,
    price_cents: item.unit_price_cents,
  })).filter((item) => item.id && item.quantity > 0);
  if (!products.length) {
    await supabase.from('subscription_cycles').update({ status: 'locked' }).eq('id', cycle.id);
    return null;
  }

  const sessionKey = `sub-cycle-${cycle.id}`;
  const user = await getUserByAuthId(sub.user_id);
  const planPaid = Number(cycle.plan_paid_cents) || 0;
  const addonPaid = Number(cycle.addon_paid_cents) || 0;
  const fee = Number(cycle.delivery_fee_cents) || 0;
  const total = Math.round(planPaid * HST) + Math.round(addonPaid * HST) + Math.round(fee * HST);

  const order = await createOrderWithProducts({
    user_id: sub.user_id,
    buyer_email: user?.email || '',
    buyer_name: [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || 'Subscriber',
    buyer_phone_number: user?.phone_number || '',
    buyer_address: cycle.special_note || '',
    status: 'pending',
    stripe_session_id: sessionKey,
    total_cents: total,
    products,
    pickup_date: cycle.delivery ? null : sunday,
    pickup_time_slot: cycle.delivery ? null : cycle.pickup_time_slot,
    delivery: !!cycle.delivery,
    delivery_date: cycle.delivery ? sunday : null,
    special_note: cycle.special_note || '',
    item_subtotal_cents: planPaid + addonPaid,
    subscription_cycle_id: cycle.id,
  });

  cycle.order_id = order.id;
  await supabase
    .from('subscription_cycles')
    .update({ order_id: order.id, status: 'locked' })
    .eq('id', cycle.id);
  return order.id;
}

async function applyPendingAfterLock(sub) {
  if (sub.pending_status === 'cancelled') {
    await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: sub.cancelled_reason || null,
        pending_status: null,
        pause_reason: null,
      })
      .eq('id', sub.id);
    return { cancelled: true };
  }
  if (sub.pending_status === 'paused') {
    await supabase
      .from('subscriptions')
      .update({
        status: 'paused',
        pause_reason: 'manual',
        paused_at: new Date().toISOString(),
        pending_status: null,
      })
      .eq('id', sub.id);
    return { paused: true };
  }
  if (sub.pending_plan_id) {
    await supabase
      .from('subscriptions')
      .update({
        plan_id: sub.pending_plan_id,
        pending_plan_id: null,
      })
      .eq('id', sub.id);
    sub.plan_id = sub.pending_plan_id;
    return { plan: true };
  }
  return {};
}

async function openNextWeek(sub, lockedCycle, nextSunday, settings) {
  if (sub.status === 'cancelled' || sub.pending_status === 'cancelled') return;
  if (sub.status === 'paused' || sub.pending_status === 'paused') return;
  const plan = await getPlanById(sub.plan_id);
  const delivery = !!lockedCycle.delivery;
  const { data: next, error } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: sub.plan_id,
      plan_price_cents: Number(plan?.price_cents) || Number(lockedCycle.plan_price_cents) || 0,
      meal_count: Number(plan?.meal_count) || Number(lockedCycle.meal_count) || null,
      cutoff_at: cutoffAtForSunday(nextSunday, settings) || getSignupDates(new Date(), settings || {}).cutoff_at,
      delivery_date: nextSunday,
      pickup_date: delivery ? null : nextSunday,
      status: 'open',
      delivery,
      delivery_postal_code: lockedCycle.delivery_postal_code,
      pickup_time_slot: lockedCycle.pickup_time_slot,
      special_note: lockedCycle.special_note,
      delivery_fee_cents: delivery ? (Number(lockedCycle.delivery_fee_cents) || 0) : 0,
      plan_paid_cents: 0,
      addon_paid_cents: 0,
      promo_percent: 0,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      const existing = await cycleForSunday(sub.id, nextSunday);
      if (existing) await copyPlanMealsIfEmpty(existing, lockedCycle);
      return;
    }
    throw error;
  }
  const need = Number(plan?.meal_count) || 0;
  const lockedItems = await cycleItemsByCycleId(lockedCycle.id);
  const { seed, mealQty, meals } = shouldSeedPlanMealsFromSource(lockedItems, need);
  // Do not seed next week with a short/over box after a plan size change.
  if (seed && meals.length) {
    await supabase.from('subscription_cycle_items').insert(
      meals.map((item) => ({
        cycle_id: next.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        kind: 'plan',
      }))
    );
  } else if (meals.length && need > 0) {
    await recordOpsEvent({
      kind: 'copy_forward_skipped',
      subscriptionId: sub.id,
      cycleId: next.id,
      sourceCycleId: lockedCycle.id,
      deliveryDate: nextSunday,
      need,
      got: mealQty,
      note: 'openNextWeek: locked qty ≠ plan meal_count',
    });
  }
}

async function runMealLock({ force = false, now = new Date() } = {}) {
  const settings = await getSettings();
  const dates = getSignupDates(now, settings || {});
  if (!force && !dates.cutoff_passed) {
    return { ok: true, skipped: true, reason: 'before_lock' };
  }
  const sunday = dates.job_sunday;
  if (!force && await jobAlreadyFinished(sunday, 'thursday_lock')) {
    return { ok: true, skipped: true, reason: 'already_ran', sunday };
  }
  const nextSunday = nextOpenSunday(sunday);
  const subs = await loadSubsForSunday();
  const boxLines = [];
  let locked = 0;
  let skipped = 0;
  let addonsCharged = 0;
  let emailed = 0;
  let mealMismatches = 0;
  const emailedIds = await emailedIdsFor(sunday, 'thursday_lock');
  const failures = [];

  async function maybeSendLockAndMismatch(sub, cycle, sundayYmd, addonResult) {
    if (emailedIds.has(sub.id)) return;
    try {
      await sendLockNotice(sub, cycle, sundayYmd, addonResult);
      emailedIds.add(sub.id);
      emailed += 1;
    } catch (err) {
      console.warn('[subscriptions] Lock email failed:', sub.id, err.message);
    }
    try {
      const mismatch = await mealCountMismatch(sub, cycle);
      if (mismatch) {
        await sendMealMismatchNotices(sub, cycle, sundayYmd, mismatch);
        mealMismatches += 1;
      }
    } catch (err) {
      console.warn('[subscriptions] Meal-mismatch notices failed:', sub.id, err.message);
    }
  }

  for (const sub of subs) {
    let cycle = await cycleForSunday(sub.id, sunday);
    if (!cycle) {
      skipped += 1;
      continue;
    }
    if (cycle.status === 'skipped') {
      const { data: allCycles, error: allErr } = await supabase
        .from('subscription_cycles')
        .select('id, delivery_date, status, plan_paid_cents')
        .eq('subscription_id', sub.id);
      if (allErr) throw allErr;
      const firstYmd = firstBoxSunday(sub, settings || {}, now, allCycles);
      if (
        firstBoxStillDue(sub, settings || {}, now, allCycles)
        && String(cycle.delivery_date) === String(firstYmd)
      ) {
        cycle = await reopenSkippedCycle(cycle);
      } else {
        skipped += 1;
        continue;
      }
    }
    const linkedOrderId = await orderIdForThisCycle(cycle);
    // Locked boxes still go out after a later pause or cancel. Keep them on the
    // kitchen email even when the plan is no longer active.
    if (cycle.status === 'locked') {
      if (linkedOrderId) cycle.order_id = linkedOrderId;
      locked += 1;
      {
        const addonPaid = Number(cycle.addon_paid_cents) || 0;
        await maybeSendLockAndMismatch(sub, cycle, sunday, {
          charged: addonPaid > 0,
          due: addonPaid,
          amount: Math.round(addonPaid * HST),
        });
      }
      try {
        boxLines.push(await ownerBoxFrom(sub, cycle));
      } catch (err) {
        console.warn('[subscriptions] Lock owner row failed:', err.message);
      }
      if (sub.status !== 'paused' && sub.status !== 'cancelled') {
        try {
          await openNextWeek(sub, cycle, nextSunday, settings);
        } catch (err) {
          failures.push({ subscription_id: sub.id, error: `next: ${err.message || err}` });
        }
      }
      continue;
    }

    const unpaidFail = sub.pause_reason === 'payment_failed' && Number(cycle.plan_paid_cents) <= 0;
    const manualPauseUnpaid = sub.status === 'paused' && sub.pause_reason !== 'payment_failed' && Number(cycle.plan_paid_cents) <= 0;
    if (unpaidFail || manualPauseUnpaid) {
      await supabase.from('subscription_cycles').update({ status: 'skipped' }).eq('id', cycle.id);
      skipped += 1;
      continue;
    }

    let addon = { charged: false, amount: 0, due: 0 };
    try {
      addon = await chargeAddons(sub, cycle, sunday);
      if (addon.charged) addonsCharged += 1;
    } catch (err) {
      failures.push({ subscription_id: sub.id, error: `addons: ${err.message || err}` });
      console.warn('[subscriptions] Lock add-on charge failed:', sub.id, err.message);
      try {
        await stripUnpaidAddonsAfterChargeFailure(sub, cycle, sunday, err);
      } catch (stripErr) {
        failures.push({ subscription_id: sub.id, error: `addon strip: ${stripErr.message || stripErr}` });
        console.warn('[subscriptions] Could not strip unpaid add-ons:', sub.id, stripErr.message);
      }
    }

    try {
      await createKitchenOrder(sub, cycle, sunday);
      locked += 1;
    } catch (err) {
      failures.push({ subscription_id: sub.id, error: `order: ${err.message || err}` });
      console.warn('[subscriptions] Lock order failed:', sub.id, err.message);
      continue;
    }

    await maybeSendLockAndMismatch(sub, cycle, sunday, addon);

    const pending = await applyPendingAfterLock(sub);
    if (!pending.cancelled && !pending.paused) {
      try {
        const latest = pending.plan ? { ...sub, plan_id: sub.plan_id } : sub;
        await openNextWeek(latest, cycle, nextSunday, settings);
      } catch (err) {
        failures.push({ subscription_id: sub.id, error: `next: ${err.message || err}` });
      }
    }

    try {
      // pending pause at lock still ships this Sunday — surface the same kitchen note.
      const ownerSub = pending.paused ? { ...sub, status: 'paused' } : sub;
      boxLines.push(await ownerBoxFrom(ownerSub, cycle));
    } catch (err) {
      console.warn('[subscriptions] Lock owner row failed:', err.message);
    }
  }

  if (boxLines.length) {
    try {
      const msg = renderOwnerLockEmail({
        sunday: sundayLabelFromYmd(sunday),
        boxes: boxLines,
      });
      await sendOwnerEmail(msg);
    } catch (err) {
      console.warn('[subscriptions] Lock owner email failed:', err.message);
    }
  }

  const stats = {
    locked,
    skipped,
    addonsCharged,
    failed: failures.length,
    emailed,
    meal_mismatches: mealMismatches,
    emailed_ids: [...emailedIds],
  };
  await recordRun(sunday, 'thursday_lock', stats);
  return { ok: true, sunday, ...stats, failures };
}

async function unpauseAfterPayment(subId) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      pause_reason: null,
      last_decline_code: null,
      last_decline_at: null,
      resumed_at: new Date().toISOString(),
    })
    .eq('id', subId);
  if (error) throw error;
}

/**
 * Open unpaid cycle whose kitchen lock has not passed.
 * When onlySunday is set (cook week), never pull next Tuesday's week forward.
 */
async function findChargeableUnpaidCycle(subscriptionId, settings, now = new Date(), { onlySunday } = {}) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .eq('status', 'open')
    .order('delivery_date', { ascending: true });
  if (error) throw error;
  for (const row of data || []) {
    if (onlySunday != null && String(row.delivery_date) !== String(onlySunday)) continue;
    if (Number(row.plan_paid_cents) > 0) continue;
    if (lockPassedForSunday(row.delivery_date, now, settings)) continue;
    return { cycle: await withCycleItems(row), sunday: row.delivery_date };
  }
  return null;
}

/**
 * Bill this cook week's unpaid open cycle now, then unpause.
 * Used for payment_failed recovery (resume / card-update) and for manual
 * resume after the Tuesday charge window when that Sunday is still unpaid.
 * Does not charge a future week after Wednesday lock.
 */
async function retryFailedCharge(sub) {
  if (!sub) return { ok: false, reason: 'missing' };
  const settings = await getSettings();
  const now = new Date();
  const dates = getSignupDates(now, settings || {});
  const found = await findChargeableUnpaidCycle(sub.id, settings || {}, now, {
    onlySunday: dates.job_sunday,
  });
  if (!found) {
    try {
      await unpauseAfterPayment(sub.id);
    } catch (err) {
      console.warn('[subscriptions] unpause after no-charge resume failed:', sub.id, err.message);
      return { ok: false, charged: false, reason: err.message || 'unpause_failed' };
    }
    return { ok: true, charged: false, reason: 'no_open_unpaid' };
  }
  try {
    // Suffix keyed off last decline/pause so a cached Tuesday decline is not
    // replayed, while double-click resume still shares one Stripe attempt.
    const attemptStamp = String(sub.last_decline_at || sub.paused_at || sub.card_updated_at || 'retry')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 24) || 'retry';
    const chargeResult = await chargePlanDelivery(sub, found.cycle, found.sunday, {
      idempotencySuffix: `r-${attemptStamp}`,
    });
    try {
      await unpauseAfterPayment(sub.id);
    } catch (err) {
      // Charge already succeeded — do not surface as a failed charge to the customer.
      console.warn('[subscriptions] unpause after successful charge failed:', sub.id, err.message);
    }
    try {
      await sendChargeNotice(sub, found.cycle, found.sunday, dates, chargeResult);
    } catch (err) {
      console.warn('[subscriptions] retry receipt email failed:', err.message);
    }
    return {
      ok: true,
      charged: !!chargeResult.charged,
      sunday: found.sunday,
      amount: chargeResult.amount || 0,
    };
  } catch (err) {
    console.warn('[subscriptions] resume/card charge failed:', sub.id, err.message);
    return { ok: false, charged: false, reason: err.message || 'card_declined', sunday: found.sunday };
  }
}

/**
 * TEMP one-off: owner kitchen list only (no Stripe, no customer mail, no lock).
 * Rebuilds from currently locked cycles for this cook Sunday.
 */
async function sendCorrectedOwnerLockEmail({ now = new Date() } = {}) {
  const settings = await getSettings();
  const dates = getSignupDates(now, settings || {});
  const sunday = dates.locked_delivery_date || dates.job_sunday;
  if (!sunday) {
    return { ok: false, reason: 'no_sunday' };
  }

  const { data: cycles, error } = await supabase
    .from('subscription_cycles')
    .select('id, subscription_id, status, order_id, delivery, delivery_postal_code, pickup_time_slot, special_note, meal_count, delivery_date')
    .eq('delivery_date', sunday)
    .eq('status', 'locked');
  if (error) throw error;

  const boxLines = [];
  const failures = [];
  for (const row of cycles || []) {
    try {
      const { data: sub, error: subErr } = await supabase
        .from('subscriptions')
        .select(`
          id, user_id, status, plan_id,
          subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents )
        `)
        .eq('id', row.subscription_id)
        .maybeSingle();
      if (subErr) throw subErr;
      if (!sub) {
        failures.push({ cycle_id: row.id, error: 'missing_subscription' });
        continue;
      }
      const cycle = await withCycleItems(row);
      if (cycle.order_id) {
        /* keep */
      } else {
        const linked = await orderIdForThisCycle(cycle);
        if (linked) cycle.order_id = linked;
      }
      boxLines.push(await ownerBoxFrom(sub, cycle));
    } catch (err) {
      failures.push({
        cycle_id: row.id,
        subscription_id: row.subscription_id,
        error: err.message || String(err),
      });
      console.warn('[subscriptions] Corrected owner row failed:', row.id, err.message);
    }
  }

  if (!boxLines.length) {
    return { ok: false, reason: 'no_locked_boxes', sunday, failures };
  }

  const correctionNote = [
    'CORRECTED kitchen list — disregard the earlier Wednesday lock email for this Sunday.',
    'A test subscription was removed. Trust only this email.',
  ].join(' ');

  const msg = renderOwnerLockEmail({
    sunday: sundayLabelFromYmd(sunday),
    boxes: boxLines,
    correctionNote,
  });
  await sendOwnerEmail(msg);
  return {
    ok: true,
    sunday,
    boxes: boxLines.length,
    failures,
  };
}

module.exports = {
  runPlanCharge,
  runMealLock,
  sendCorrectedOwnerLockEmail,
  retryFailedCharge,
  addonDueCents,
  applyPromoPercent,
};

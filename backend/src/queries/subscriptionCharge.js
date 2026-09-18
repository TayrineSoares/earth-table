/**
 * Weekly jobs: Wednesday plan+delivery charge, Thursday extras + kitchen lock.
 * Safe to re-run: already-paid cycles and locked rows are skipped.
 */

const supabase = require('../../supabase/db');
const { createOrderWithProducts, getOrderByStripeSessionId } = require('./order');
const { getUserByAuthId } = require('./user');
const { getSettings, getPlanById } = require('./subscription');
const {
  renderSubscriptionManageEmail,
  renderOwnerThursdayLockEmail,
  renderSubscriptionHolidaySkipEmail,
  renderSubscriptionWednesdayEmail,
  renderSubscriptionThursdayEmail,
  renderOwnerPaymentFailedEmail,
  formatDollars,
} = require('../utils/emailTemplates');
const {
  sendCustomerEmail,
  sendOwnerEmail,
  emailPrefOn,
  cardForPaymentMethod,
  declineReasonFrom,
} = require('../emails/sendSubscriptionMail');
const {
  getSignupDates,
  getChargeDeadline,
  getTargetSundayYmd,
  isYmdBlocked,
  sundayLabelFromYmd,
  formatPickupSlot,
  formatTorontoStamp,
} = require('./subscriptionWeek');
const { PICKUP_ADDRESS, DELIVERY_WINDOW } = require('../emails/subscriptionEmailSpec');

const HST = 1.13;

function getStripe() {
  return require('stripe')(process.env.STRIPE_SECRET_SK);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function addDaysYmd(ymdStr, days) {
  const [year, month, day] = String(ymdStr || '').split('-').map(Number);
  if (!year || !month || !day) return ymdStr;
  const utc = Date.UTC(year, month - 1, day + days);
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function nextOpenSunday(ymdStr) {
  let next = addDaysYmd(ymdStr, 7);
  for (let i = 0; i < 6; i += 1) {
    if (!isYmdBlocked(next)) return next;
    next = addDaysYmd(next, 7);
  }
  return next;
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

async function sluggedItems(items) {
  const ids = [...new Set((items || []).map((item) => item.product_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from('products').select('id, slug').in('id', ids);
  if (error) throw error;
  const names = new Map((data || []).map((row) => [row.id, row.slug]));
  return (items || []).map((item) => ({
    slug: names.get(item.product_id) || 'Item',
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    kind: item.kind,
  }));
}

function itemsByKind(items, kind) {
  return (items || []).filter((item) => item.kind === kind);
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
  const factor = already === 0 && pct > 0 ? (100 - pct) / 100 : 1;
  const discounted = Math.floor(raw * factor);
  return Math.max(0, discounted - already);
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
  const labeled = await sluggedItems(cycle.subscription_cycle_items);
  const win = splitWin(!!cycle.delivery, cycle.pickup_time_slot);
  return {
    name: [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Customer',
    mealCount: sub.subscription_plans?.meal_count,
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
    meals: itemsByKind(labeled, 'plan'),
    extras: itemsByKind(labeled, 'addon'),
  };
}

async function loadSubsForSunday() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id, user_id, status, plan_id, pending_status, pending_plan_id, pause_reason,
      stripe_customer_id, stripe_payment_method_id, delivery, delivery_postal_code,
      pickup_time_slot, special_note,
      subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents )
    `)
    .in('status', ['active', 'paused']);
  if (error) throw error;
  return data || [];
}

async function cycleForSunday(subscriptionId, sunday) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select(`
      *,
      subscription_cycle_items ( id, product_id, quantity, unit_price_cents, kind )
    `)
    .eq('subscription_id', subscriptionId)
    .eq('delivery_date', sunday)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function lastCycle(subscriptionId) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select(`
      *,
      subscription_cycle_items ( product_id, quantity, unit_price_cents, kind )
    `)
    .eq('subscription_id', subscriptionId)
    .order('delivery_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureCycle(sub, sunday, settings) {
  const existing = await cycleForSunday(sub.id, sunday);
  if (existing) return existing;
  const dates = getSignupDates(new Date(), settings || {});
  const src = await lastCycle(sub.id);
  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
  const delivery = src ? !!src.delivery : !!sub.delivery;
  const { data: cycle, error } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: sub.plan_id,
      plan_price_cents: Number(plan?.price_cents) || Number(src?.plan_price_cents) || 0,
      cutoff_at: dates.cutoff_at,
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
    })
    .select(`
      *,
      subscription_cycle_items ( id, product_id, quantity, unit_price_cents, kind )
    `)
    .single();
  if (error) {
    if (error.code === '23505') return cycleForSunday(sub.id, sunday);
    throw error;
  }
  const meals = (src?.subscription_cycle_items || []).filter((item) => item.kind === 'plan');
  if (meals.length) {
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
  return cycle;
}

async function chargePlanDelivery(sub, cycle, sunday) {
  const already = Number(cycle.plan_paid_cents) || 0;
  const planCents = Number(cycle.plan_price_cents) || Number(sub.subscription_plans?.price_cents) || 0;
  const fee = cycle.delivery ? (Number(cycle.delivery_fee_cents) || 0) : 0;
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
        .eq('id', cycle.id);
    }
    return { charged: false, skipped: true, amount: 0, planCents: due, deliveryCents: fee };
  }
  if (!sub.stripe_customer_id || !sub.stripe_payment_method_id) {
    throw new Error('no_card');
  }
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.create({
    amount,
    currency: 'cad',
    customer: sub.stripe_customer_id,
    payment_method: sub.stripe_payment_method_id,
    off_session: true,
    confirm: true,
    description: 'Weekly plan',
    metadata: {
      kind: 'subscription_wednesday',
      subscription_id: sub.id,
      cycle_id: cycle.id,
    },
  }, {
    idempotencyKey: `sub-plan-${cycle.id}-${sunday}`,
  });
  const patch = {
    plan_paid_cents: planCents,
    charged_at: new Date().toISOString(),
  };
  if (!cycle.stripe_payment_intent_id && pi?.id) patch.stripe_payment_intent_id = pi.id;
  const { error } = await supabase.from('subscription_cycles').update(patch).eq('id', cycle.id);
  if (error) throw error;
  return { charged: true, skipped: false, amount, planCents: due, deliveryCents: fee };
}

async function markPaymentFailed(sub, sunday, cutoffLabel, stripeErr) {
  await supabase
    .from('subscriptions')
    .update({
      status: 'paused',
      pause_reason: 'payment_failed',
      paused_at: new Date().toISOString(),
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
      declineReason: declineReasonFrom(stripeErr),
      dateTime: formatTorontoStamp(new Date()),
      cutoffDateTime: cutoffLabel,
    });
    await sendOwnerEmail(msg);
  } catch (err) {
    console.warn('[subscriptions] owner payment-failed email failed:', err.message);
  }
}

async function sendWednesdayNotice(sub, cycle, sunday, dates, chargeResult) {
  const user = await getUserByAuthId(sub.user_id);
  if (!user?.email) return;
  if (!emailPrefOn(user, 'wednesday_reminder')) return;
  const labeled = await sluggedItems(cycle.subscription_cycle_items);
  const charged = !!chargeResult?.charged;
  const card = charged ? await cardForPaymentMethod(sub.stripe_payment_method_id) : null;
  const msg = renderSubscriptionWednesdayEmail({
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
  });
  await sendCustomerEmail({ to: user.email, msg });
}

async function sendThursdayNotice(sub, cycle, sunday, addonResult) {
  const user = await getUserByAuthId(sub.user_id);
  if (!user?.email) return;
  const labeled = await sluggedItems(cycle.subscription_cycle_items);
  const chargedAddons = !!addonResult?.charged;
  const card = chargedAddons ? await cardForPaymentMethod(sub.stripe_payment_method_id) : null;
  const msg = renderSubscriptionThursdayEmail({
    firstName: user.first_name,
    mealCount: sub.subscription_plans?.meal_count,
    delivery: !!cycle.delivery,
    deliveryLabel: sundayLabelFromYmd(sunday),
    pickupSlot: cycle.pickup_time_slot,
    address: cycle.delivery ? cycle.special_note : undefined,
    notes: cycle.special_note,
    chargedAddons,
    addonCents: chargedAddons ? (Number(addonResult.due) || 0) : 0,
    chargedCents: chargedAddons ? (Number(addonResult.amount) || 0) : 0,
    addonItems: itemsByKind(labeled, 'addon'),
    meals: itemsByKind(labeled, 'plan'),
    cardBrand: card?.brand,
    last4: card?.last4,
  });
  await sendCustomerEmail({ to: user.email, msg });
}

async function runWednesdayCharge({ force = false, now = new Date() } = {}) {
  const settings = await getSettings();
  const dates = getSignupDates(now, settings || {});
  const sunday = getTargetSundayYmd(now, settings || {});
  const charge = getChargeDeadline(now, settings || {}, sunday);
  if (!force && charge.before_wednesday) {
    return { ok: true, skipped: true, reason: 'before_charge', sunday };
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
    const manualPause = sub.status === 'paused' && sub.pause_reason !== 'payment_failed';
    if (manualPause) {
      skipped += 1;
      continue;
    }
    let cycle;
    try {
      cycle = await ensureCycle(sub, sunday, settings);
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
        chargeResult = await chargePlanDelivery(sub, cycle, sunday);
        if (chargeResult.charged) charged += 1;
        else already += 1;
        if (sub.pause_reason === 'payment_failed') {
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              pause_reason: null,
              resumed_at: new Date().toISOString(),
            })
            .eq('id', sub.id);
        }
      } catch (err) {
        failures.push({ subscription_id: sub.id, error: err.message || String(err) });
        console.warn('[subscriptions] Wednesday charge failed:', sub.id, err.message);
        await markPaymentFailed(sub, sunday, dates.cutoff_label, err);
        continue;
      }
    }

    if (!emailedIds.has(sub.id)) {
      try {
        await sendWednesdayNotice(sub, cycle, sunday, dates, chargeResult);
        emailedIds.add(sub.id);
        emailed += 1;
      } catch (err) {
        console.warn('[subscriptions] Wednesday email failed:', sub.id, err.message);
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
  const due = addonDueCents(cycle);
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

async function createKitchenOrder(sub, cycle, sunday) {
  if (cycle.order_id) return cycle.order_id;
  const items = cycle.subscription_cycle_items || [];
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
  const existing = await getOrderByStripeSessionId(sessionKey);
  if (existing?.id) {
    await supabase
      .from('subscription_cycles')
      .update({ order_id: existing.id, status: 'locked' })
      .eq('id', cycle.id);
    return existing.id;
  }

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
        pending_status: null,
        pending_plan_id: null,
        stripe_payment_method_id: null,
        label: null,
        special_note: null,
        delivery_postal_code: null,
        pickup_time_slot: null,
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
  const dates = getSignupDates(new Date(), settings || {});
  const plan = await getPlanById(sub.plan_id);
  const delivery = !!lockedCycle.delivery;
  const { data: next, error } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: sub.plan_id,
      plan_price_cents: Number(plan?.price_cents) || Number(lockedCycle.plan_price_cents) || 0,
      cutoff_at: dates.cutoff_at,
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
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return;
    throw error;
  }
  const meals = (lockedCycle.subscription_cycle_items || []).filter((item) => item.kind === 'plan');
  if (meals.length) {
    await supabase.from('subscription_cycle_items').insert(
      meals.map((item) => ({
        cycle_id: next.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        kind: 'plan',
      }))
    );
  }
}

async function runThursdayLock({ force = false, now = new Date() } = {}) {
  const settings = await getSettings();
  const dates = getSignupDates(now, settings || {});
  if (!force && !dates.cutoff_passed) {
    return { ok: true, skipped: true, reason: 'before_lock' };
  }
  const sunday = getTargetSundayYmd(now, settings || {});
  const nextSunday = nextOpenSunday(sunday);
  const subs = await loadSubsForSunday();
  const boxLines = [];
  let locked = 0;
  let skipped = 0;
  let addonsCharged = 0;
  let emailed = 0;
  const emailedIds = await emailedIdsFor(sunday, 'thursday_lock');
  const failures = [];

  for (const sub of subs) {
    const cycle = await cycleForSunday(sub.id, sunday);
    if (!cycle) {
      skipped += 1;
      continue;
    }
    if (cycle.status === 'skipped') {
      skipped += 1;
      continue;
    }
    if (cycle.status === 'locked' && cycle.order_id) {
      locked += 1;
      if (!emailedIds.has(sub.id)) {
        try {
          const addonPaid = Number(cycle.addon_paid_cents) || 0;
          await sendThursdayNotice(sub, cycle, sunday, {
            charged: addonPaid > 0,
            due: addonPaid,
            amount: Math.round(addonPaid * HST),
          });
          emailedIds.add(sub.id);
          emailed += 1;
        } catch (err) {
          console.warn('[subscriptions] Thursday email failed:', sub.id, err.message);
        }
      }
      try {
        boxLines.push(await ownerBoxFrom(sub, cycle));
      } catch (err) {
        console.warn('[subscriptions] Thursday owner row failed:', err.message);
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
      console.warn('[subscriptions] Thursday add-on charge failed:', sub.id, err.message);
    }

    try {
      await createKitchenOrder(sub, cycle, sunday);
      locked += 1;
    } catch (err) {
      failures.push({ subscription_id: sub.id, error: `order: ${err.message || err}` });
      console.warn('[subscriptions] Thursday order failed:', sub.id, err.message);
      continue;
    }

    if (!emailedIds.has(sub.id)) {
      try {
        await sendThursdayNotice(sub, cycle, sunday, addon);
        emailedIds.add(sub.id);
        emailed += 1;
      } catch (err) {
        console.warn('[subscriptions] Thursday email failed:', sub.id, err.message);
      }
    }

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
      boxLines.push(await ownerBoxFrom(sub, cycle));
    } catch (err) {
      console.warn('[subscriptions] Thursday owner row failed:', err.message);
    }
  }

  if (boxLines.length) {
    try {
      const msg = renderOwnerThursdayLockEmail({
        sunday: sundayLabelFromYmd(sunday),
        boxes: boxLines,
      });
      await sendOwnerEmail(msg);
    } catch (err) {
      console.warn('[subscriptions] Thursday owner email failed:', err.message);
    }
  }

  const stats = {
    locked,
    skipped,
    addonsCharged,
    failed: failures.length,
    emailed,
    emailed_ids: [...emailedIds],
  };
  await recordRun(sunday, 'thursday_lock', stats);
  return { ok: true, sunday, ...stats, failures };
}

async function retryFailedCharge(sub) {
  if (!sub || sub.pause_reason !== 'payment_failed') return { ok: false };
  const settings = await getSettings();
  const sunday = getTargetSundayYmd(new Date(), settings || {});
  const dates = getSignupDates(new Date(), settings || {});
  if (dates.cutoff_passed) return { ok: false, reason: 'lock_passed' };
  const cycle = await cycleForSunday(sub.id, sunday);
  if (!cycle || Number(cycle.plan_paid_cents) > 0) return { ok: false };
  await chargePlanDelivery(sub, cycle, sunday);
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      pause_reason: null,
      resumed_at: new Date().toISOString(),
    })
    .eq('id', sub.id);
  return { ok: true };
}

module.exports = {
  runWednesdayCharge,
  runThursdayLock,
  chargeThursdayAddons: runThursdayLock,
  retryFailedCharge,
};

/**
 * Subscription plans, customer subscriptions, and open-cycle edits.
 * First-week payment lives in subscriptionCheckout.js.
 * Recurring Wednesday 9:00 AM ET charge / Thursday 5:00 PM ET lock.
 */

const supabase = require('../../supabase/db');
const { getAllCategories } = require('./category');
const { getAllProducts } = require('./product');
const {
  getSignupDates,
  getEditWeek,
  getChargeDeadline,
  torontoYmd,
  sundayLabelFromYmd,
  nextOpenSunday,
  cutoffLabelForSunday,
  cutoffAtForSunday,
} = require('./subscriptionWeek');

class SubscriptionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'SubscriptionError';
  }
}

/** Shown on plan cards when description is null/blank. */
const DEFAULT_PLAN_DESCRIPTION = 'Choose any combination of bowls, salads, and mains.';

function planPublicFields(row) {
  if (!row) return null;
  const trimmed = (row.description || '').trim();
  return {
    ...row,
    display_description: trimmed || DEFAULT_PLAN_DESCRIPTION,
  };
}

async function listPlans({ activeOnly = false } = {}) {
  let query = supabase
    .from('subscription_plans')
    .select('*')
    .order('meal_count', { ascending: true })
    .order('price_cents', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts = await subscriberCountsByPlan();
  return (data || []).map((row) =>
    planPublicFields({ ...row, subscriber_count: counts[row.id] || 0 })
  );
}

async function getPlanById(id) {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const subscriber_count = await countActiveSubscribers(id);
  return planPublicFields({ ...data, subscriber_count });
}

async function createPlan({ name, meal_count, price_cents, description, is_active }) {
  const cleanedName = String(name || '').trim();
  if (!cleanedName) {
    throw new SubscriptionError(400, 'Name is required.');
  }

  const mealCount = parseInt(String(meal_count), 10);
  if (!Number.isFinite(mealCount) || mealCount < 1) {
    throw new SubscriptionError(400, 'Meal count must be a whole number of 1 or more.');
  }

  const priceCents = parseInt(String(price_cents), 10);
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    throw new SubscriptionError(400, 'Price must be 0 or more (cents).');
  }

  const desc = description == null ? null : String(description).trim() || null;

  const { data, error } = await supabase
    .from('subscription_plans')
    .insert({
      name: cleanedName,
      meal_count: mealCount,
      price_cents: priceCents,
      description: desc,
      is_active: is_active !== false,
    })
    .select()
    .single();

  if (error) throw error;
  return planPublicFields({ ...data, subscriber_count: 0 });
}

/**
 * Name and meal_count are frozen after create so existing subscribers
 * keep the plan they signed up for. Price, description, and is_active may change.
 */
async function updatePlan(id, body) {
  if (!id) throw new SubscriptionError(400, 'Plan id is required.');

  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, 'price_cents')) {
    const priceCents = parseInt(String(body.price_cents), 10);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      throw new SubscriptionError(400, 'Price must be 0 or more (cents).');
    }
    patch.price_cents = priceCents;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
    patch.is_active = !!body.is_active;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    if (body.description == null) {
      patch.description = null;
    } else {
      patch.description = String(body.description).trim() || null;
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new SubscriptionError(400, 'Nothing to update. Only price, description, and active can change.');
  }

  const existing = await getPlanById(id);
  if (!existing) throw new SubscriptionError(404, 'Plan not found.');

  const { data, error } = await supabase
    .from('subscription_plans')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  const priceChanged =
    Object.prototype.hasOwnProperty.call(patch, 'price_cents') &&
    patch.price_cents !== existing.price_cents;
  if (priceChanged) {
    notifyPlanPriceChange(existing, data).catch((err) => {
      console.warn('[subscriptions] price-change email failed:', err.message);
    });
  }
  return {
    plan: planPublicFields({
      ...data,
      subscriber_count: existing.subscriber_count || 0,
    }),
    priceChanged,
  };
}

async function notifyPlanPriceChange(oldPlan, newPlan) {
  const { sendEmail } = require('../utils/email');
  const { renderSubscriptionPriceEmail } = require('../utils/emailTemplates');
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('plan_id', newPlan.id)
    .in('status', ['active', 'paused']);
  if (error) throw error;
  const settings = await getSettings();
  const charge = getChargeDeadline(new Date(), settings || {});
  for (const row of subs || []) {
    try {
      const { getUserByAuthId } = require('./user');
      const user = await getUserByAuthId(row.user_id);
      if (!user?.email) continue;
      const msg = renderSubscriptionPriceEmail({
        firstName: user.first_name,
        mealCount: newPlan.meal_count,
        oldPriceCents: oldPlan.price_cents,
        newPriceCents: newPlan.price_cents,
        chargeLabel: charge.charge_label,
      });
      await sendEmail({
        to: user.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: 'hello@earthtableco.ca',
      });
    } catch (err) {
      console.warn('[subscriptions] price email failed:', err.message);
    }
  }
}

/** Current people on the plan (active or paused). Cancelled do not count. */
async function subscriberCountsByPlan() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .in('status', ['active', 'paused']);
  if (error) throw error;

  const counts = {};
  for (const row of data || []) {
    if (!row.plan_id) continue;
    counts[row.plan_id] = (counts[row.plan_id] || 0) + 1;
  }
  return counts;
}

function pickDisplayCycle(cycles, now = new Date()) {
  const today = torontoYmd(now);
  const rows = [...(cycles || [])];
  const upcoming = rows
    .filter((row) => row.delivery_date && String(row.delivery_date) >= today)
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)));
  // Skip already-locked / skipped weeks when a later open box exists.
  // Otherwise Sep 20 locked beats Sep 27 open just because it is sooner.
  const editable = upcoming.filter((row) => row.status !== 'locked' && row.status !== 'skipped');
  if (editable.length) return editable[0];
  if (upcoming.length) return upcoming[0];
  return rows.sort((a, b) => String(b.delivery_date).localeCompare(String(a.delivery_date)))[0] || null;
}

/** The week My Plans should show: getEditWeek's Sunday, not the locked leftover. */
function currentCycleForWeek(cycles, week, fallback = null) {
  const sunday = week?.delivery_date;
  if (sunday) {
    const match = (cycles || []).find((row) => String(row.delivery_date) === String(sunday));
    if (match) return match;
  }
  return fallback;
}

/** Prefer this cook Sunday's row so a force-locked cycle still informs getEditWeek. */
function hintCycleForEdit(cycles, now, settings) {
  const thisSunday = getSignupDates(now, settings || {}).first_delivery_date;
  const thisCycle = (cycles || []).find((row) => String(row.delivery_date) === String(thisSunday));
  return thisCycle || pickDisplayCycle(cycles, now);
}

function requireOpenCycle(cycle) {
  if (cycle && cycle.status === 'open') return cycle;
  throw new SubscriptionError(
    400,
    'This week\'s box is locked. You can still change next week\'s meals from My Subscriptions.'
  );
}

const CYCLE_ITEM_SELECT = `
  id, cycle_id, product_id, quantity, unit_price_cents, kind,
  products ( id, slug, image_url, is_available )
`;

const CYCLE_SELECT = `
  id, subscription_id, status, order_id, cutoff_at, delivery_date, pickup_date, delivery,
  delivery_postal_code, pickup_time_slot, special_note, delivery_fee_cents,
  plan_paid_cents, addon_paid_cents, promo_percent, plan_price_cents
`;

async function attachCycleItems(cycles) {
  const rows = cycles || [];
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id).filter(Boolean);
  const { data, error } = await supabase
    .from('subscription_cycle_items')
    .select(CYCLE_ITEM_SELECT)
    .in('cycle_id', ids);
  if (error) throw error;
  const byCycle = {};
  for (const item of data || []) {
    const key = String(item.cycle_id);
    if (!ids.some((id) => String(id) === key)) continue;
    if (!byCycle[key]) byCycle[key] = [];
    byCycle[key].push(item);
  }
  return rows.map((cycle) => ({
    ...cycle,
    subscription_cycle_items: byCycle[String(cycle.id)] || [],
  }));
}

async function cardsByPaymentMethodId(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const map = {};
  if (!unique.length) return map;
  const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
  await Promise.all(unique.map(async (id) => {
    try {
      const pm = await stripe.paymentMethods.retrieve(id);
      const last4 = pm.card?.last4;
      if (!last4) return;
      map[id] = {
        brand: String(pm.card.brand || 'card'),
        last4,
        expMonth: pm.card.exp_month || null,
        expYear: pm.card.exp_year || null,
      };
    } catch (err) {
      console.warn('[subscriptions] card lookup failed:', err.message);
    }
  }));
  return map;
}

async function listMine(userId) {
  if (!userId) throw new SubscriptionError(400, 'User id is required.');
  const settings = await getSettings();
  const now = new Date();
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id, status, plan_id, label, delivery, delivery_postal_code, pickup_time_slot, special_note,
      pending_plan_id, pending_status, pause_reason, paused_at, created_at, stripe_payment_method_id,
      first_promo_percent, first_promo_applied, first_promo_code,
      subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents ),
      pending_plan:subscription_plans!subscriptions_pending_plan_id_fkey ( id, name, meal_count, price_cents )
    `)
    .eq('user_id', userId)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false });
  if (error) throw error;

  const subs = data || [];
  if (!subs.length) return [];

  const ids = subs.map((row) => row.id);
  const { data: cycles, error: cycleErr } = await supabase
    .from('subscription_cycles')
    .select(CYCLE_SELECT)
    .in('subscription_id', ids);
  if (cycleErr) throw cycleErr;
  const cyclesWithItems = await attachCycleItems(cycles);

  const cardMap = await cardsByPaymentMethodId(subs.map((row) => row.stripe_payment_method_id));

  const promoCodes = [...new Set(
    subs.map((row) => String(row.first_promo_code || '').toUpperCase()).filter(Boolean)
  )];
  const referralCodes = new Set();
  if (promoCodes.length) {
    const { data: partnerRows, error: partnerErr } = await supabase
      .from('partners')
      .select('referral_code')
      .in('referral_code', promoCodes);
    if (partnerErr) {
      console.warn('[subscriptions] partner code lookup failed:', partnerErr.message);
    } else {
      for (const row of partnerRows || []) {
        referralCodes.add(String(row.referral_code || '').toUpperCase());
      }
    }
  }

  const bySub = {};
  for (const cycle of cyclesWithItems || []) {
    if (!bySub[cycle.subscription_id]) bySub[cycle.subscription_id] = [];
    bySub[cycle.subscription_id].push(cycle);
  }

  return subs.map((sub) => {
    const list = bySub[sub.id] || [];
    const hint = hintCycleForEdit(list, now, settings || {});
    const week = getEditWeek(now, settings || {}, hint);
    const thisSunday = getSignupDates(now, settings || {}).job_sunday;
    const thisWeekCycle = (list || []).find((row) => (
      String(row.delivery_date) === String(thisSunday) && row.status !== 'skipped'
    )) || null;
    // Meals/extras follow the editable week. After cutoff, this_week_date is the
    // locked Sunday still in motion (Next box), when that cycle exists.
    const current = currentCycleForWeek(list, week, null);
    const shown = current || {
      delivery_date: week.delivery_date,
      pickup_date: sub.delivery ? null : week.delivery_date,
      delivery: !!sub.delivery,
      delivery_postal_code: sub.delivery_postal_code,
      pickup_time_slot: sub.pickup_time_slot,
      special_note: sub.special_note,
      promo_percent: 0,
      subscription_cycle_items: [],
    };
    const charge = getChargeDeadline(now, settings || {}, week.delivery_date);
    const planMeals = (shown.subscription_cycle_items || [])
      .filter((item) => item.kind === 'plan')
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const mealCount = Number(sub.subscription_plans?.meal_count) || 0;
    const earliestYmd = list
      .map((row) => row.delivery_date)
      .filter(Boolean)
      .sort()[0] || null;
    const storedPct = Number(shown?.promo_percent) || 0;
    const firstWeekPct = Number(sub.first_promo_percent) || 0;
    const addonPromoPercent = storedPct > 0
      ? storedPct
      : (shown && earliestYmd && String(shown.delivery_date) === String(earliestYmd) ? firstWeekPct : 0);
    const { stripe_payment_method_id: _pm, ...publicSub } = sub;
    void _pm;
    return {
      ...publicSub,
      card: cardMap[sub.stripe_payment_method_id] || null,
      cycle: shown,
      edit_cycle: current,
      this_week_date: thisWeekCycle?.delivery_date || null,
      week,
      charge,
      can_edit: sub.status === 'active',
      meals_need_update: sub.status === 'active' && mealCount > 0 && planMeals !== mealCount,
      addon_promo_percent: addonPromoPercent,
      first_promo_kind: sub.first_promo_code
        ? (referralCodes.has(String(sub.first_promo_code).toUpperCase()) ? 'referral' : 'promo')
        : null,
    };
  });
}

function adminWeekMeta(now = new Date(), settings = {}) {
  const dates = getSignupDates(now, settings || {});
  const thisSunday = dates.job_sunday;
  const nextSunday = dates.cutoff_passed
    && dates.first_delivery_date
    && dates.first_delivery_date !== thisSunday
    ? dates.first_delivery_date
    : nextOpenSunday(thisSunday);
  return {
    cutoff_passed: dates.cutoff_passed,
    cutoff_at: dates.cutoff_at,
    cutoff_label: dates.cutoff_label,
    this_sunday: thisSunday,
    this_sunday_label: sundayLabelFromYmd(thisSunday),
    this_cutoff_label: cutoffLabelForSunday(thisSunday, settings) || dates.cutoff_label,
    next_sunday: nextSunday,
    next_sunday_label: sundayLabelFromYmd(nextSunday),
    next_cutoff_label: cutoffLabelForSunday(nextSunday, settings) || dates.cutoff_label,
  };
}

async function listAll() {
  const settings = await getSettings();
  const now = new Date();
  const meta = adminWeekMeta(now, settings || {});
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id, user_id, status, plan_id, label, delivery, delivery_postal_code,
      pickup_time_slot, special_note, created_at, paused_at, cancelled_at, pause_reason,
      pending_plan_id, pending_status,
      subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents ),
      pending_plan:subscription_plans!subscriptions_pending_plan_id_fkey ( id, name, meal_count, price_cents )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const subs = data || [];
  if (!subs.length) return { meta, subscriptions: [] };

  const userIds = [...new Set(subs.map((row) => row.user_id).filter(Boolean))];
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('auth_user_id, first_name, last_name, email, phone_number')
    .in('auth_user_id', userIds);
  if (userErr) throw userErr;
  const byUser = Object.fromEntries((users || []).map((row) => [row.auth_user_id, row]));

  const ids = subs.map((row) => row.id);
  const { data: cycles, error: cycleErr } = await supabase
    .from('subscription_cycles')
    .select(CYCLE_SELECT)
    .in('subscription_id', ids);
  if (cycleErr) throw cycleErr;
  const cyclesWithItems = await attachCycleItems(cycles);

  const orderIds = [...new Set((cyclesWithItems || []).map((row) => row.order_id).filter(Boolean))];
  let byOrder = {};
  if (orderIds.length) {
    const { data: kitchen, error: kitchenErr } = await supabase
      .from('orders')
      .select('id, picked_up, status')
      .in('id', orderIds);
    if (kitchenErr) throw kitchenErr;
    byOrder = Object.fromEntries((kitchen || []).map((row) => [row.id, row]));
  }

  const bySub = {};
  for (const cycle of cyclesWithItems || []) {
    if (!bySub[cycle.subscription_id]) bySub[cycle.subscription_id] = [];
    bySub[cycle.subscription_id].push(cycle);
  }

  const kitchenFor = (cycle) => (cycle?.order_id ? byOrder[cycle.order_id] || null : null);

  const subscriptions = subs.map((sub) => {
    const list = bySub[sub.id] || [];
    const thisCycle = list.find((row) => row.delivery_date === meta.this_sunday) || null;
    const nextCycle = list.find((row) => row.delivery_date === meta.next_sunday) || null;
    const display = thisCycle || nextCycle || pickDisplayCycle(list, now);
    const week = getEditWeek(now, settings || {}, hintCycleForEdit(list, now, settings || {}));
    return {
      ...sub,
      customer: byUser[sub.user_id] || null,
      this_cycle: thisCycle,
      next_cycle: nextCycle,
      this_kitchen: kitchenFor(thisCycle),
      next_kitchen: kitchenFor(nextCycle),
      cycle: display,
      kitchen: kitchenFor(display),
      week,
      charge: getChargeDeadline(now, settings || {}, week.delivery_date),
    };
  });

  return { meta, subscriptions };
}

async function getOwnedSubscription(userId, subscriptionId) {
  if (!userId) throw new SubscriptionError(400, 'Sign in to manage subscriptions.');
  if (!subscriptionId) throw new SubscriptionError(400, 'Subscription id is required.');
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents )')
    .eq('id', subscriptionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new SubscriptionError(404, 'Subscription not found.');
  return data;
}

async function getOrCreateEditableCycle(sub) {
  const settings = await getSettings();
  const now = new Date();
  const { data: allCycles, error: allErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id);
  if (allErr) throw allErr;
  const hint = hintCycleForEdit(allCycles || [], now, settings || {});
  let week = getEditWeek(now, settings || {}, hint);
  let existing = (allCycles || []).find((row) => String(row.delivery_date) === String(week.delivery_date)) || null;

  // Force lock can close this Sunday before cutoff_at. Never mutate locked/skipped.
  for (let i = 0; i < 4 && existing && existing.status !== 'open'; i += 1) {
    const nextSunday = nextOpenSunday(existing.delivery_date);
    week = {
      ...week,
      applies_to: 'next_week',
      cutoff_passed: true,
      delivery_date: nextSunday,
      delivery_label: sundayLabelFromYmd(nextSunday),
      cutoff_at: cutoffAtForSunday(nextSunday, settings) || week.cutoff_at,
      cutoff_label: cutoffLabelForSunday(nextSunday, settings) || week.cutoff_label,
    };
    existing = (allCycles || []).find((row) => String(row.delivery_date) === String(nextSunday)) || null;
  }
  if (existing) return { cycle: requireOpenCycle(existing), week };

  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
  const src = pickDisplayCycle(allCycles || [], now);
  const { data: cycle, error } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: sub.plan_id,
      plan_price_cents: Number(plan?.price_cents) || 0,
      cutoff_at: week.cutoff_at,
      delivery_date: week.delivery_date,
      pickup_date: src?.delivery ? null : week.delivery_date,
      status: 'open',
      delivery: src ? !!src.delivery : !!sub.delivery,
      delivery_postal_code: src?.delivery_postal_code || sub.delivery_postal_code,
      pickup_time_slot: src?.pickup_time_slot || sub.pickup_time_slot,
      special_note: src?.special_note || sub.special_note,
      delivery_fee_cents: src?.delivery ? (Number(src.delivery_fee_cents) || 0) : 0,
      plan_paid_cents: 0,
      addon_paid_cents: 0,
      promo_percent: 0,
    })
    .select()
    .single();
  if (error) throw error;

  // Next week starts from last week's meals (add-ons never carry).
  if (src) {
    const { data: items } = await supabase
      .from('subscription_cycle_items')
      .select('product_id, quantity, unit_price_cents, kind')
      .eq('cycle_id', src.id)
      .eq('kind', 'plan');
    if (items && items.length) {
      const { error: copyErr } = await supabase.from('subscription_cycle_items').insert(
        items.map((item) => ({ ...item, cycle_id: cycle.id }))
      );
      if (copyErr) throw copyErr;
    }
  }

  return { cycle, week };
}

async function loadCycleItems(cycleId) {
  const { data, error } = await supabase
    .from('subscription_cycle_items')
    .select('id, product_id, quantity, unit_price_cents, kind, products ( slug )')
    .eq('cycle_id', cycleId);
  if (error) throw error;
  return data || [];
}

async function sendBoxUpdatedNow(userId, sub, cycle, week) {
  const { getUserByAuthId } = require('./user');
  const { renderSubscriptionUpdatedEmail } = require('../utils/emailTemplates');
  const { sendCustomerEmail } = require('../emails/sendSubscriptionMail');
  const user = await getUserByAuthId(userId);
  const email = user?.email;
  if (!email) return;
  const items = await loadCycleItems(cycle.id);
  const meals = items.filter((item) => item.kind === 'plan').map((item) => ({
    slug: item.products?.slug,
    quantity: item.quantity,
  }));
  const addons = items.filter((item) => item.kind === 'addon').map((item) => ({
    slug: item.products?.slug,
    quantity: item.quantity,
  }));
  const msg = renderSubscriptionUpdatedEmail({
    firstName: user.first_name,
    mealCount: sub.subscription_plans?.meal_count,
    delivery: !!cycle.delivery,
    deliveryLabel: week.delivery_label,
    pickupSlot: cycle.pickup_time_slot,
    cutoffLabel: week.cutoff_label,
    meals,
    addons,
    subscriptionId: sub.id,
    notes: cycle.special_note,
    appliesTo: week.applies_to,
  });
  await sendCustomerEmail({ to: email, msg });
}

async function notifyCustomerUpdate(userId, sub, cycle, week) {
  const { CADENCE } = require('../emails/subscriptionEmailSpec');
  const sendAt = new Date(Date.now() + CADENCE.UPDATE_DEBOUNCE_MS).toISOString();
  const { error } = await supabase.from('subscription_email_debounce').upsert({
    subscription_id: sub.id,
    kind: 'box_updated',
    send_at: sendAt,
    payload: { userId, cycleId: cycle.id },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'subscription_id' });
  if (error) {
    console.warn('[subscriptions] debounce queue failed:', error.message);
    await sendBoxUpdatedNow(userId, sub, cycle, week);
  }
}

async function flushDebouncedEmails(now = new Date()) {
  const { data, error } = await supabase
    .from('subscription_email_debounce')
    .select('*')
    .lte('send_at', now.toISOString());
  if (error) {
    console.warn('[subscriptions] debounce flush failed:', error.message);
    return { ok: false, error: error.message };
  }
  let sent = 0;
  for (const row of data || []) {
    const { data: taken } = await supabase
      .from('subscription_email_debounce')
      .delete()
      .eq('subscription_id', row.subscription_id)
      .eq('updated_at', row.updated_at)
      .select('payload')
      .maybeSingle();
    if (!taken) continue;
    try {
      const sub = await getOwnedSubscription(row.payload.userId, row.subscription_id);
      const settings = await getSettings();
      const { data: cycle } = await supabase
        .from('subscription_cycles')
        .select('*')
        .eq('id', row.payload.cycleId)
        .maybeSingle();
      if (!cycle) continue;
      const week = getEditWeek(now, settings || {}, cycle);
      await sendBoxUpdatedNow(row.payload.userId, sub, cycle, week);
      sent += 1;
    } catch (err) {
      console.warn('[subscriptions] debounce send failed:', err.message);
    }
  }
  return { ok: true, sent };
}

/** Monday 9:00 AM ET cron: email once if the saved card expires within CARD_EXPIRY_DAYS. */
async function runCardExpiryNotices(now = new Date()) {
  const { getUserByAuthId } = require('./user');
  const { renderSubscriptionManageEmail } = require('../utils/emailTemplates');
  const { sendCustomerEmail, cardForPaymentMethod } = require('../emails/sendSubscriptionMail');
  const { CADENCE } = require('../emails/subscriptionEmailSpec');
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_payment_method_id')
    .eq('status', 'active');
  if (error) throw error;
  let emailed = 0;
  const horizon = now.getTime() + CADENCE.CARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  for (const sub of subs || []) {
    const card = await cardForPaymentMethod(sub.stripe_payment_method_id);
    if (!card?.last4 || !card.expMonth || !card.expYear) continue;
    const expires = new Date(card.expYear, card.expMonth, 0, 23, 59, 59);
    if (expires.getTime() < now.getTime() || expires.getTime() > horizon) continue;
    const { data: existing } = await supabase
      .from('subscription_card_expiry_notices')
      .select('subscription_id')
      .eq('subscription_id', sub.id)
      .eq('payment_method_id', sub.stripe_payment_method_id)
      .eq('exp_month', card.expMonth)
      .eq('exp_year', card.expYear)
      .maybeSingle();
    if (existing) continue;
    try {
      const user = await getUserByAuthId(sub.user_id);
      if (!user?.email) continue;
      const msg = renderSubscriptionManageEmail({
        kind: 'card_expiry',
        firstName: user.first_name,
        cardBrand: card.brand,
        last4: card.last4,
        expMonth: String(card.expMonth).padStart(2, '0'),
        expYear: card.expYear,
      });
      await sendCustomerEmail({ to: user.email, msg });
      await supabase.from('subscription_card_expiry_notices').insert({
        subscription_id: sub.id,
        payment_method_id: sub.stripe_payment_method_id,
        exp_month: card.expMonth,
        exp_year: card.expYear,
      });
      emailed += 1;
    } catch (err) {
      console.warn('[subscriptions] card-expiry email failed:', sub.id, err.message);
    }
  }
  return { ok: true, emailed };
}

async function replaceCycleKindItems(cycleId, kind, resolved) {
  const { error: delErr } = await supabase
    .from('subscription_cycle_items')
    .delete()
    .eq('cycle_id', cycleId)
    .eq('kind', kind);
  if (delErr) throw delErr;

  const rows = resolved.map((item) => ({
    cycle_id: cycleId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    kind,
  }));
  if (!rows.length) return;
  const { error: insErr } = await supabase.from('subscription_cycle_items').insert(rows);
  if (insErr) throw insErr;
}

/** Save meals and add-ons together so the customer gets one update email. */
async function replaceOpenCyclePlanAndAddons(userId, subscriptionId, meals, addons) {
  const { qtyLines, resolveLines } = require('./subscriptionCheckout');
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status !== 'active') {
    throw new SubscriptionError(400, 'This subscription is not active.');
  }
  const { cycle, week } = await getOrCreateEditableCycle(sub);
  requireOpenCycle(cycle);
  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);

  const mealLines = qtyLines(meals);
  const mealQty = mealLines.reduce((sum, line) => sum + line.quantity, 0);
  if (mealQty !== Number(plan.meal_count)) {
    throw new SubscriptionError(
      400,
      `Pick exactly ${plan.meal_count} meal${plan.meal_count === 1 ? '' : 's'} for this plan.`
    );
  }

  const { data: existingPlan, error: existingErr } = await supabase
    .from('subscription_cycle_items')
    .select('product_id')
    .eq('cycle_id', cycle.id)
    .eq('kind', 'plan');
  if (existingErr) throw existingErr;

  const allowUnavailableIds = new Set((existingPlan || []).map((row) => row.product_id));
  const resolvedMeals = await resolveLines(mealLines, { kind: 'plan', allowUnavailableIds });
  await replaceCycleKindItems(cycle.id, 'plan', resolvedMeals);

  const addonLines = qtyLines(addons);
  const resolvedAddons = addonLines.length ? await resolveLines(addonLines, { kind: 'addon' }) : [];
  await replaceCycleKindItems(cycle.id, 'addon', resolvedAddons);

  try {
    await notifyCustomerUpdate(userId, sub, cycle, week);
  } catch (err) {
    console.warn('[subscriptions] update email failed:', err.message);
  }

  return { ok: true, week };
}

async function chargeDeliveryFee(sub, cycle, feeCents) {
  const amount = Math.round(Number(feeCents) * 1.13);
  if (amount < 50) {
    throw new SubscriptionError(400, 'Delivery fee is too small to charge.');
  }
  if (!sub.stripe_customer_id || !sub.stripe_payment_method_id) {
    throw new SubscriptionError(400, 'No card on file for the delivery fee. Email hello@earthtableco.ca.');
  }
  const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
  try {
    return await stripe.paymentIntents.create({
      amount,
      currency: 'cad',
      customer: sub.stripe_customer_id,
      payment_method: sub.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: 'Subscription delivery fee',
      metadata: {
        kind: 'subscription_delivery',
        subscription_id: sub.id,
        cycle_id: cycle.id,
      },
    });
  } catch (err) {
    console.error('[subscriptions] delivery fee charge failed', err.message);
    throw new SubscriptionError(
      402,
      'We could not charge the delivery fee to your card. Try again or email hello@earthtableco.ca.'
    );
  }
}

async function updateOpenCycleFulfillment(userId, subscriptionId, body = {}) {
  const { PICKUP_SLOTS } = require('./subscriptionCheckout');
  const { getServerDeliveryQuote } = require('../lib/deliveryQuote');
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status !== 'active') {
    throw new SubscriptionError(400, 'This subscription is not active.');
  }
  const { cycle, week } = await getOrCreateEditableCycle(sub);
  requireOpenCycle(cycle);

  const specialNote = String(body.special_note || '').trim() || null;

  if (body.notes_only) {
    if (cycle.delivery && (!specialNote || specialNote.length < 8)) {
      throw new SubscriptionError(400, 'Please enter your full delivery address.');
    }
    const { error: subErr } = await supabase
      .from('subscriptions')
      .update({ special_note: specialNote })
      .eq('id', sub.id);
    if (subErr) throw subErr;
    const { error: cycleErr } = await supabase
      .from('subscription_cycles')
      .update({ special_note: specialNote })
      .eq('id', cycle.id);
    if (cycleErr) throw cycleErr;
    const updated = { ...cycle, special_note: specialNote };
    try {
      await notifyCustomerUpdate(userId, sub, updated, week);
    } catch (err) {
      console.warn('[subscriptions] notes update email failed:', err.message);
    }
    return { ok: true, cycle: updated };
  }

  const delivery = !!body.delivery;
  const pickupSlot = String(body.pickup_time_slot || '').trim();
  const wasPickup = !cycle.delivery;

  const patch = {
    delivery,
    special_note: specialNote,
  };

  if (delivery) {
    if (!specialNote || specialNote.length < 8) {
      throw new SubscriptionError(400, 'Please enter your full delivery address.');
    }
    const quote = await getServerDeliveryQuote(body.delivery_postal_code);
    if (!quote.ok) {
      throw new SubscriptionError(
        400,
        quote.reason === 'OUT_OF_ZONE'
          ? 'Delivery not available for this address.'
          : 'Invalid delivery postal code.'
      );
    }
    let postal = String(body.delivery_postal_code || '').toUpperCase().replace(/\s+/g, '');
    if (postal.length === 6) postal = `${postal.slice(0, 3)} ${postal.slice(3)}`;
    patch.delivery_postal_code = postal;
    patch.pickup_time_slot = null;
    patch.delivery_fee_cents = quote.fee_cents;

    const chargeNow = week.applies_to === 'this_sunday' && wasPickup && Number(cycle.plan_paid_cents) > 0;
    if (chargeNow) {
      await chargeDeliveryFee(sub, cycle, quote.fee_cents);
    }
  } else {
    if (!PICKUP_SLOTS.has(pickupSlot)) {
      throw new SubscriptionError(400, 'Choose a pickup time.');
    }
    patch.delivery_postal_code = null;
    patch.pickup_time_slot = pickupSlot;
    if (wasPickup) patch.delivery_fee_cents = 0;
  }

  const { error: subErr } = await supabase
    .from('subscriptions')
    .update({
      delivery: patch.delivery,
      delivery_postal_code: patch.delivery_postal_code,
      pickup_time_slot: patch.pickup_time_slot,
      special_note: patch.special_note,
    })
    .eq('id', sub.id);
  if (subErr) throw subErr;

  const { error: cycleErr } = await supabase
    .from('subscription_cycles')
    .update({
      delivery: patch.delivery,
      delivery_postal_code: patch.delivery_postal_code,
      pickup_time_slot: patch.pickup_time_slot,
      special_note: patch.special_note,
      delivery_fee_cents: patch.delivery_fee_cents ?? cycle.delivery_fee_cents,
      pickup_date: delivery ? null : week.delivery_date,
    })
    .eq('id', cycle.id);
  if (cycleErr) throw cycleErr;

  const updated = { ...cycle, ...patch };
  const switched = delivery !== !wasPickup;
  try {
    if (switched) {
      const { getUserByAuthId } = require('./user');
      const { renderSubscriptionManageEmail, renderOwnerFulfillmentEmail } = require('../utils/emailTemplates');
      const { sendCustomerEmail, sendOwnerEmail } = require('../emails/sendSubscriptionMail');
      const { formatPickupSlot } = require('./subscriptionWeek');
      const { PICKUP_ADDRESS, DELIVERY_WINDOW } = require('../emails/subscriptionEmailSpec');
      const user = await getUserByAuthId(userId);
      if (user?.email) {
        const msg = renderSubscriptionManageEmail({
          kind: delivery ? 'fulfillment_delivery' : 'fulfillment_pickup',
          firstName: user.first_name,
          fulfillmentDate: week.delivery_label,
          deliveryLabel: week.delivery_label,
          address: delivery ? specialNote : PICKUP_ADDRESS,
          pickupSlot,
        });
        await sendCustomerEmail({ to: user.email, msg });
      }
      const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Customer';
      const win = delivery ? DELIVERY_WINDOW : formatPickupSlot(pickupSlot);
      const parts = String(win || '').split(/\s*[–-]\s*/);
      await sendOwnerEmail(renderOwnerFulfillmentEmail({
        customerName: name,
        oldMethod: wasPickup ? 'pickup' : 'delivery',
        newMethod: delivery ? 'delivery' : 'pickup',
        fulfillmentDate: week.delivery_label,
        address: delivery ? specialNote : PICKUP_ADDRESS,
        windowStart: (parts[0] || '').trim(),
        windowEnd: (parts.slice(1).join(' – ') || '').trim(),
      }));
    }
  } catch (err) {
    console.warn('[subscriptions] fulfillment email failed:', err.message);
  }

  return {
    ok: true,
    week,
    delivery_fee_cents: patch.delivery_fee_cents ?? cycle.delivery_fee_cents,
  };
}

async function countActiveSubscribers(planId) {
  const { count, error } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .in('status', ['active', 'paused']);
  if (error) throw error;
  return count || 0;
}

async function deletePlan(id) {
  if (!id) throw new SubscriptionError(400, 'Plan id is required.');

  const existing = await getPlanById(id);
  if (!existing) throw new SubscriptionError(404, 'Plan not found.');

  const current = await countActiveSubscribers(id);
  if (current > 0) {
    throw new SubscriptionError(
      409,
      `This plan has ${current} subscriber${current === 1 ? '' : 's'}. Deactivate it instead of deleting.`
    );
  }

  const { error } = await supabase
    .from('subscription_plans')
    .delete()
    .eq('id', id);

  if (error) {
    throw new SubscriptionError(
      409,
      'This plan is still linked to past subscriptions and cannot be deleted. Deactivate it instead.'
    );
  }

  return { ok: true };
}

async function getSettings() {
  const { data, error } = await supabase
    .from('subscription_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Test charge/lock timestamps. Pass null (or '') to clear and use live
 * Wednesday 9:00 AM plan charge / Thursday 5:00 PM meal lock, America/Toronto.
 */
async function updateSettings(body) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, 'test_charge_at')) {
    patch.test_charge_at = parseTimestampOrNull(body.test_charge_at);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'test_lock_at')) {
    patch.test_lock_at = parseTimestampOrNull(body.test_lock_at);
  }

  if (Object.keys(patch).length === 0) {
    throw new SubscriptionError(400, 'Nothing to update.');
  }

  const { data, error } = await supabase
    .from('subscription_settings')
    .update(patch)
    .eq('id', 1)
    .select()
    .single();

  if (error) throw error;
  return data;
}

function parseTimestampOrNull(value) {
  if (value == null || value === '') return null;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    throw new SubscriptionError(400, 'Invalid date/time.');
  }
  return new Date(ms).toISOString();
}

/** Trimmed category names that count as plan meals (not add-ons). */
const PLAN_MEAL_CATEGORY_NAMES = new Set(['bowls', 'salads', 'main plates']);

/** Ignore the $1 test plan so "Save up to 99%" does not leak onto the marketing page. */
const MIN_PLAN_CENTS_FOR_SAVINGS = 1000;

async function getMaxEligibleMealPriceCents() {
  const [categories, products] = await Promise.all([getAllCategories(), getAllProducts()]);
  const categoryIds = new Set(
    (categories || [])
      .filter((cat) => PLAN_MEAL_CATEGORY_NAMES.has(String(cat.name || '').trim().toLowerCase()))
      .map((cat) => cat.id)
  );

  let maxCents = 0;
  for (const product of products || []) {
    if (!categoryIds.has(product.category_id)) continue;
    if (product.is_active === false) continue;
    if (product.is_available === false) continue;
    const cents = Number(product.price_cents) || 0;
    if (cents > maxCents) maxCents = cents;
  }
  return maxCents;
}

/**
 * Best % off vs buying the same number of the priciest Bowl/Salad/Main Plate.
 * Returns null when nothing is actually cheaper (hide "Save up to").
 */
function saveUpToPercent(plans, maxItemCents) {
  if (!maxItemCents) return null;
  let best = 0;
  for (const plan of plans || []) {
    if (!plan || plan.price_cents < MIN_PLAN_CENTS_FOR_SAVINGS) continue;
    const aLaCarte = maxItemCents * plan.meal_count;
    if (aLaCarte <= 0) continue;
    const pct = Math.floor(((aLaCarte - plan.price_cents) / aLaCarte) * 100);
    if (pct > best) best = pct;
  }
  return best > 0 ? best : null;
}

async function getPublicSignupInfo() {
  const settings = await getSettings();
  const dates = getSignupDates(new Date(), settings || {});
  const plans = await listPlans({ activeOnly: true });
  const maxItemCents = await getMaxEligibleMealPriceCents();
  return {
    ...dates,
    save_up_to_percent: saveUpToPercent(plans, maxItemCents),
  };
}

module.exports = {
  SubscriptionError,
  listPlans,
  getPlanById,
  listMine,
  listAll,
  createPlan,
  updatePlan,
  deletePlan,
  getSettings,
  updateSettings,
  getPublicSignupInfo,
  replaceOpenCyclePlanAndAddons,
  updateOpenCycleFulfillment,
  getOwnedSubscription,
  flushDebouncedEmails,
  runCardExpiryNotices,
};

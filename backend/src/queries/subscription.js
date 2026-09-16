/**
 * Subscription catalog + settings (Phase 1).
 * Later phases add subscriptions / cycles / billing in this same file.
 */

const supabase = require('../../supabase/db');
const { getAllCategories } = require('./category');
const { getAllProducts } = require('./product');
const { getSignupDates, getEditWeek, torontoYmd } = require('./subscriptionWeek');

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
  return {
    plan: planPublicFields({
      ...data,
      subscriber_count: existing.subscriber_count || 0,
    }),
    priceChanged:
      Object.prototype.hasOwnProperty.call(patch, 'price_cents') &&
      patch.price_cents !== existing.price_cents,
  };
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

function canEditCycle(cycle) {
  if (!cycle || cycle.status !== 'open' || !cycle.cutoff_at) return false;
  return Date.now() < new Date(cycle.cutoff_at).getTime();
}

function pickDisplayCycle(cycles, now = new Date()) {
  const today = torontoYmd(now);
  const rows = [...(cycles || [])];
  const upcoming = rows
    .filter((row) => row.delivery_date && String(row.delivery_date) >= today)
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)));
  if (upcoming.length) return upcoming[0];
  return rows.sort((a, b) => String(b.delivery_date).localeCompare(String(a.delivery_date)))[0] || null;
}

const CYCLE_ITEM_SELECT = `
  id, product_id, quantity, unit_price_cents, kind,
  products ( id, slug, image_url, is_available )
`;

const CYCLE_SELECT = `
  id, subscription_id, status, cutoff_at, delivery_date, pickup_date, delivery,
  delivery_postal_code, pickup_time_slot, special_note, delivery_fee_cents,
  plan_paid_cents, addon_paid_cents, promo_percent, plan_price_cents,
  subscription_cycle_items ( ${CYCLE_ITEM_SELECT} )
`;

async function listMine(userId) {
  if (!userId) throw new SubscriptionError(400, 'User id is required.');
  const settings = await getSettings();
  const now = new Date();
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      id, status, plan_id, label, delivery, delivery_postal_code, pickup_time_slot, special_note,
      created_at,
      subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents )
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

  const bySub = {};
  for (const cycle of cycles || []) {
    if (!bySub[cycle.subscription_id]) bySub[cycle.subscription_id] = [];
    bySub[cycle.subscription_id].push(cycle);
  }

  return subs.map((sub) => {
    const list = bySub[sub.id] || [];
    const display = pickDisplayCycle(list, now);
    const week = getEditWeek(now, settings || {}, display);
    const editCycle = list.find((row) => row.delivery_date === week.delivery_date) || null;
    return {
      ...sub,
      cycle: display,
      edit_cycle: editCycle,
      week,
      can_edit: sub.status === 'active',
    };
  });
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

async function latestCycle(subscriptionId) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('delivery_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getOrCreateEditableCycle(sub) {
  const settings = await getSettings();
  const latest = await latestCycle(sub.id);
  const display = pickDisplayCycle(latest ? [latest] : [], new Date()) || latest;
  // latestCycle only returns one row — load all for display pick
  const { data: allCycles, error: allErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id);
  if (allErr) throw allErr;
  const current = pickDisplayCycle(allCycles || [], new Date());
  const week = getEditWeek(new Date(), settings || {}, current);

  const existing = (allCycles || []).find((row) => row.delivery_date === week.delivery_date);
  if (existing) return { cycle: existing, week, previous: current };

  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
  const src = current || latest;
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

  return { cycle, week, previous: current };
}

async function loadCycleItems(cycleId) {
  const { data, error } = await supabase
    .from('subscription_cycle_items')
    .select('id, product_id, quantity, unit_price_cents, kind, products ( slug )')
    .eq('cycle_id', cycleId);
  if (error) throw error;
  return data || [];
}

async function notifyCustomerUpdate(userId, sub, cycle, week) {
  const { getUserByAuthId } = require('./user');
  const { sendEmail } = require('../utils/email');
  const { renderSubscriptionUpdatedEmail } = require('../utils/emailTemplates');
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
  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
  const msg = renderSubscriptionUpdatedEmail({
    firstName: user.first_name,
    mealCount: plan?.meal_count,
    delivery: cycle.delivery,
    deliveryLabel: week.delivery_label,
    pickupSlot: cycle.pickup_time_slot,
    cutoffLabel: week.cutoff_label,
    appliesTo: week.applies_to,
    meals,
    addons,
  });
  await sendEmail({
    to: email,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: 'hello@earthtableco.ca',
  });
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

async function replaceOpenCyclePlanItems(userId, subscriptionId, meals) {
  const { qtyLines, resolveLines } = require('./subscriptionCheckout');
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status !== 'active') {
    throw new SubscriptionError(400, 'This subscription is not active.');
  }
  const { cycle, week } = await getOrCreateEditableCycle(sub);

  const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
  const lines = qtyLines(meals);
  const mealQty = lines.reduce((sum, line) => sum + line.quantity, 0);
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
  const resolved = await resolveLines(lines, { kind: 'plan', allowUnavailableIds });
  await replaceCycleKindItems(cycle.id, 'plan', resolved);

  try {
    await notifyCustomerUpdate(userId, sub, cycle, week);
  } catch (err) {
    console.warn('[subscriptions] update email failed:', err.message);
  }

  return { ok: true, week };
}

async function replaceOpenCycleAddonItems(userId, subscriptionId, addons) {
  const { qtyLines, resolveLines } = require('./subscriptionCheckout');
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status !== 'active') {
    throw new SubscriptionError(400, 'This subscription is not active.');
  }
  const { cycle, week } = await getOrCreateEditableCycle(sub);
  const lines = qtyLines(addons);
  const resolved = lines.length ? await resolveLines(lines, { kind: 'addon' }) : [];
  await replaceCycleKindItems(cycle.id, 'addon', resolved);

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

  const delivery = !!body.delivery;
  const specialNote = String(body.special_note || '').trim() || null;
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
  try {
    await notifyCustomerUpdate(userId, sub, updated, week);
  } catch (err) {
    console.warn('[subscriptions] update email failed:', err.message);
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
 * Only test_charge_at / test_lock_at are editable from admin in Phase 1.
 * Pass null (or '') to clear and go back to live Wednesday/Thursday 5pm.
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
  DEFAULT_PLAN_DESCRIPTION,
  SubscriptionError,
  listPlans,
  getPlanById,
  listMine,
  createPlan,
  updatePlan,
  deletePlan,
  countActiveSubscribers,
  getSettings,
  updateSettings,
  getPublicSignupInfo,
  replaceOpenCyclePlanItems,
  replaceOpenCycleAddonItems,
  updateOpenCycleFulfillment,
};

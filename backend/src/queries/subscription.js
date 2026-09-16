/**
 * Subscription catalog + settings (Phase 1).
 * Later phases add subscriptions / cycles / billing in this same file.
 */

const supabase = require('../../supabase/db');
const { getAllCategories } = require('./category');
const { getAllProducts } = require('./product');
const { getSignupDates } = require('./subscriptionWeek');

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

function pickCurrentCycle(cycles) {
  const rows = cycles || [];
  const open = rows.filter((row) => row.status === 'open');
  const pool = open.length ? open : rows;
  return pool.sort((a, b) => String(b.delivery_date).localeCompare(String(a.delivery_date)))[0] || null;
}

async function listMine(userId) {
  if (!userId) throw new SubscriptionError(400, 'User id is required.');
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
    .select(`
      id, subscription_id, status, cutoff_at, delivery_date, pickup_date, delivery,
      delivery_postal_code, pickup_time_slot, special_note, delivery_fee_cents,
      plan_paid_cents, addon_paid_cents, promo_percent, plan_price_cents,
      subscription_cycle_items (
        id, product_id, quantity, unit_price_cents, kind,
        products ( id, slug, image_url, is_available )
      )
    `)
    .in('subscription_id', ids);
  if (cycleErr) throw cycleErr;

  const bySub = {};
  for (const cycle of cycles || []) {
    if (!bySub[cycle.subscription_id]) bySub[cycle.subscription_id] = [];
    bySub[cycle.subscription_id].push(cycle);
  }

  return subs.map((sub) => {
    const cycle = pickCurrentCycle(bySub[sub.id] || []);
    return {
      ...sub,
      cycle,
      can_edit: canEditCycle(cycle),
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

async function getOpenCycle(subscriptionId) {
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .eq('status', 'open')
    .order('delivery_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function assertCycleEditable(cycle) {
  if (!cycle) {
    throw new SubscriptionError(400, "This week's box is not open for edits.");
  }
  if (!canEditCycle(cycle)) {
    throw new SubscriptionError(400, 'The Thursday 5:00 PM cutoff has passed for this week.');
  }
}

async function replaceOpenCyclePlanItems(userId, subscriptionId, meals) {
  const { qtyLines, resolveLines } = require('./subscriptionCheckout');
  const sub = await getOwnedSubscription(userId, subscriptionId);
  const cycle = await getOpenCycle(sub.id);
  assertCycleEditable(cycle);

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

  const { error: delErr } = await supabase
    .from('subscription_cycle_items')
    .delete()
    .eq('cycle_id', cycle.id)
    .eq('kind', 'plan');
  if (delErr) throw delErr;

  const rows = resolved.map((item) => ({
    cycle_id: cycle.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    kind: 'plan',
  }));
  if (rows.length) {
    const { error: insErr } = await supabase.from('subscription_cycle_items').insert(rows);
    if (insErr) throw insErr;
  }

  return { ok: true };
}

async function updateOpenCycleFulfillment(userId, subscriptionId, body = {}) {
  const { PICKUP_SLOTS } = require('./subscriptionCheckout');
  const { getServerDeliveryQuote } = require('../lib/deliveryQuote');
  const sub = await getOwnedSubscription(userId, subscriptionId);
  const cycle = await getOpenCycle(sub.id);
  assertCycleEditable(cycle);

  const delivery = !!body.delivery;
  const specialNote = String(body.special_note || '').trim() || null;
  const pickupSlot = String(body.pickup_time_slot || '').trim();

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
  } else {
    if (!PICKUP_SLOTS.has(pickupSlot)) {
      throw new SubscriptionError(400, 'Choose a pickup time.');
    }
    patch.delivery_postal_code = null;
    patch.pickup_time_slot = pickupSlot;
    patch.delivery_fee_cents = 0;
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

  const cyclePatch = {
    delivery: patch.delivery,
    delivery_postal_code: patch.delivery_postal_code,
    pickup_time_slot: patch.pickup_time_slot,
    special_note: patch.special_note,
    delivery_fee_cents: patch.delivery_fee_cents,
  };
  const { error: cycleErr } = await supabase
    .from('subscription_cycles')
    .update(cyclePatch)
    .eq('id', cycle.id);
  if (cycleErr) throw cycleErr;

  return { ok: true };
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
  updateOpenCycleFulfillment,
};

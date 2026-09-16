/**
 * Subscription catalog + settings (Phase 1).
 * Later phases add subscriptions / cycles / billing in this same file.
 */

const supabase = require('../../supabase/db');

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

module.exports = {
  DEFAULT_PLAN_DESCRIPTION,
  SubscriptionError,
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  countActiveSubscribers,
  getSettings,
  updateSettings,
};

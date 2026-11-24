/**
 * Subscription plans, customer subscriptions, and open-cycle edits.
 * First-week payment lives in subscriptionCheckout.js.
 * Recurring Tuesday 9:00 AM ET charge / Wednesday 5:00 PM ET lock.
 */

const supabase = require('../../supabase/db');
const { getAllCategories } = require('./category');
const { getAllProducts } = require('./product');
const {
  getSignupDates,
  getEditWeek,
  getChargeDeadline,
  torontoYmd,
  calendarThisSundayYmd,
  sundayLabelFromYmd,
  nextOpenSunday,
  cutoffLabelForSunday,
  cutoffAtForSunday,
  lockPassedForSunday,
  lockAtForSunday,
} = require('./subscriptionWeek');

class SubscriptionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'SubscriptionError';
  }
}

/** Shown on plan cards when description is null/blank. */
const DEFAULT_PLAN_DESCRIPTION = 'Choose any combination of bowls, salads, mains, and soups.';

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
    if (process.env.ALLOW_PLAN_PRICE_CHANGE !== 'true') {
      throw new SubscriptionError(
        403,
        'Plan price changes are handled by Tayrine so every subscriber can be notified. Email hello@earthtableco.ca.'
      );
    }
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

  if (existing.discontinued_at && Object.prototype.hasOwnProperty.call(patch, 'is_active') && patch.is_active) {
    throw new SubscriptionError(
      409,
      'This plan was discontinued and cannot be reactivated. Create a new plan instead.'
    );
  }

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

/** Earliest locked/skipped box still due — the Sunday that is already in motion. */
function subscribedBeforeLock(createdAt, deliveryYmd, settings) {
  const lockAt = lockAtForSunday(deliveryYmd, settings);
  if (!lockAt) return true;
  const created = createdAt ? new Date(createdAt) : null;
  if (!created || !Number.isFinite(created.getTime())) return true;
  return created.getTime() < lockAt.getTime();
}

async function reopenSkippedCycle(cycle) {
  if (!cycle?.id || cycle.status !== 'skipped') return cycle;
  const { data, error } = await supabase
    .from('subscription_cycles')
    .update({ status: 'open' })
    .eq('id', cycle.id)
    .eq('status', 'skipped')
    .select()
    .maybeSingle();
  if (error) throw error;
  return {
    ...cycle,
    ...(data || {}),
    status: 'open',
  };
}

async function reopenPaidSkippedCycle(cycle) {
  if (!(Number(cycle?.plan_paid_cents) > 0)) return cycle;
  return reopenSkippedCycle(cycle);
}

/** Earliest paid or locked week — the real first box, not a recomputed signup Sunday. */
function earliestCommittedBoxYmd(cycles) {
  const row = [...(cycles || [])]
    .filter((cycle) => (
      cycle
      && cycle.delivery_date
      && (cycle.status === 'locked' || Number(cycle.plan_paid_cents) > 0)
    ))
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)))[0];
  return row ? String(row.delivery_date) : null;
}

/**
 * First-box Sunday for pause/cancel protection.
 * Prefer the earliest paid/locked cycle so a later open week (often created by
 * ensureFirstBoxCycle from created_at) is not treated as the signup box.
 */
function firstBoxSunday(sub, settings, now = new Date(), cycles) {
  const fromCycles = earliestCommittedBoxYmd(cycles);
  if (fromCycles) return fromCycles;
  const created = sub?.created_at ? new Date(sub.created_at) : now;
  return getSignupDates(created, settings || {}).first_delivery_date || null;
}

function firstBoxStillDue(sub, settings, now = new Date(), cycles) {
  const ymd = firstBoxSunday(sub, settings, now, cycles);
  return Boolean(ymd && String(ymd) >= torontoYmd(now));
}

function canEditOpenBox(sub, settings, now = new Date(), cycles) {
  if (sub.status === 'active') return true;
  if (sub.status !== 'paused') return false;
  // Paused plans can set meals for the live cook week so resume is never short.
  const open = earliestOpenCycle(cycles);
  if (open?.delivery_date) {
    return !lockPassedForSunday(open.delivery_date, now, settings);
  }
  const firstDueYmd = firstBoxSunday(sub, settings, now, cycles);
  if (firstDueYmd && String(firstDueYmd) >= torontoYmd(now)) {
    return !lockPassedForSunday(firstDueYmd, now, settings);
  }
  const signup = getSignupDates(now, settings || {});
  return !lockPassedForSunday(signup.first_delivery_date, now, settings);
}

function upcomingReceivingCycles(cycles, now, createdAt, settings, firstBoxYmd) {
  const today = torontoYmd(now);
  return [...(cycles || [])]
    .filter((row) => (
      row
      && row.delivery_date
      && String(row.delivery_date) >= today
      && (
        row.status !== 'skipped'
        || Number(row.plan_paid_cents) > 0
        || String(row.delivery_date) === String(firstBoxYmd || '')
      )
      && (
        subscribedBeforeLock(createdAt, row.delivery_date, settings)
        || String(row.delivery_date) === String(firstBoxYmd || '')
      )
    ))
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)));
}

function nextBoxLockedCycle(cycles, now, createdAt, settings, firstBoxYmd) {
  return upcomingReceivingCycles(cycles, now, createdAt, settings, firstBoxYmd)
    .find((row) => row.status === 'locked') || null;
}

/** Earliest open week for this subscription — status, not calendar proximity. */
function earliestOpenCycle(cycles) {
  return [...(cycles || [])]
    .filter((row) => row && row.status === 'open' && row.delivery_date)
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)))[0] || null;
}

/** Prefer this cook Sunday's row so a force-locked cycle still informs getEditWeek. */
function hintCycleForEdit(cycles, now, settings) {
  const open = earliestOpenCycle(cycles);
  if (open) return open;
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
  plan_paid_cents, addon_paid_cents, promo_percent, plan_price_cents,
  meal_count, meals_confirmed_at, stripe_payment_intent_id,
  stripe_delivery_payment_intent_id, stripe_plan_delta_payment_intent_id,
  stripe_plan_delta_payment_intent_ids
`;

/** Best-effort audit row — never fail the customer-facing change. */
async function recordPlanChange({
  subscriptionId,
  fromPlanId,
  toPlanId,
  timing,
  mealsQty,
  deliveryDate,
}) {
  if (!subscriptionId || !toPlanId || !timing) return;
  const { error } = await supabase.from('subscription_plan_changes').insert({
    subscription_id: subscriptionId,
    from_plan_id: fromPlanId || null,
    to_plan_id: toPlanId,
    timing,
    meals_qty: Number.isFinite(Number(mealsQty)) && Number(mealsQty) > 0
      ? Number(mealsQty)
      : null,
    delivery_date: deliveryDate || null,
  });
  if (error) {
    console.warn('[subscriptions] plan change history failed:', error.message);
  }
}

/**
 * Rare safety-net events (lock mismatch, skipped copy-forward).
 * Best-effort — never fail charge/lock/copy.
 */
async function recordOpsEvent({
  kind,
  subscriptionId,
  cycleId,
  sourceCycleId,
  deliveryDate,
  need,
  got,
  orderId,
  note,
}) {
  if (!kind) return;
  const { error } = await supabase.from('subscription_ops_events').insert({
    kind,
    subscription_id: subscriptionId || null,
    cycle_id: cycleId || null,
    source_cycle_id: sourceCycleId || null,
    delivery_date: deliveryDate || null,
    need: Number.isFinite(Number(need)) ? Number(need) : null,
    got: Number.isFinite(Number(got)) ? Number(got) : null,
    order_id: orderId != null && Number.isFinite(Number(orderId)) ? Number(orderId) : null,
    note: note ? String(note).slice(0, 500) : null,
  });
  if (error) {
    console.warn('[subscriptions] ops event failed:', kind, error.message);
  }
}

/** Best-effort notes trail — never fail the customer save. */
async function recordNotesHistory({
  subscriptionId,
  cycleId,
  deliveryDate,
  previousNote,
  note,
  source,
}) {
  const prev = previousNote != null ? String(previousNote) : null;
  const next = note != null ? String(note) : null;
  if ((prev || '') === (next || '')) return;
  const { error } = await supabase.from('subscription_notes_history').insert({
    subscription_id: subscriptionId || null,
    cycle_id: cycleId || null,
    delivery_date: deliveryDate || null,
    previous_note: prev,
    note: next,
    source: source || null,
  });
  if (error) {
    console.warn('[subscriptions] notes history failed:', error.message);
  }
}

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

function planMealItems(cycle) {
  return (cycle?.subscription_cycle_items || []).filter((item) => item.kind === 'plan');
}

function previousCycleFromList(cycles, dest) {
  if (!dest?.id) return null;
  return [...(cycles || [])]
    .filter((row) => (
      row
      && row.id
      && String(row.id) !== String(dest.id)
      && String(row.delivery_date || '') < String(dest.delivery_date || '')
    ))
    .sort((a, b) => String(b.delivery_date).localeCompare(String(a.delivery_date)))[0] || null;
}

/** Newest cycle that still has plan meals — used to seed resume / plan-change review. */
function latestCycleWithPlanMeals(cycles, excludeId = null) {
  return [...(cycles || [])]
    .filter((row) => (
      row
      && row.id
      && String(row.id) !== String(excludeId || '')
      && planMealItems(row).length
    ))
    .sort((a, b) => String(b.delivery_date || '').localeCompare(String(a.delivery_date || '')))[0] || null;
}

/** Open following-week boxes start as last week's meals. Add-ons never carry. */
async function copyPlanMealsIfEmpty(dest, src) {
  if (!dest?.id || !src?.id || String(dest.id) === String(src.id) || dest.status !== 'open') {
    return dest;
  }
  let destMeals = planMealItems(dest);
  if (!destMeals.length) {
    const { data, error } = await supabase
      .from('subscription_cycle_items')
      .select('id, cycle_id, product_id, quantity, unit_price_cents, kind')
      .eq('cycle_id', dest.id)
      .eq('kind', 'plan');
    if (error) throw error;
    destMeals = (data || []).filter((item) => String(item.cycle_id) === String(dest.id));
  }
  if (destMeals.length) {
    if (planMealItems(dest).length) return dest;
    const extras = (dest.subscription_cycle_items || []).filter((item) => item.kind !== 'plan');
    return { ...dest, subscription_cycle_items: [...destMeals, ...extras] };
  }
  const { data: srcMeals, error: srcErr } = await supabase
    .from('subscription_cycle_items')
    .select('product_id, quantity, unit_price_cents, kind')
    .eq('cycle_id', src.id)
    .eq('kind', 'plan');
  if (srcErr) throw srcErr;
  if (!srcMeals || !srcMeals.length) return dest;

  // Never copy a short/over box onto a different plan size (e.g. 10 → 15 upgrade).
  const { sumPlanMealQty, canCopyOrSeedPlanMeals } = require('../utils/mealCountMatch');
  const srcQty = sumPlanMealQty(srcMeals);
  let need = Number(dest.meal_count) || 0;
  if (!need && dest.plan_id) {
    try {
      const destPlan = await getPlanById(dest.plan_id);
      need = Number(destPlan?.meal_count) || 0;
    } catch (err) {
      console.warn('[subscriptions] copy meal-count check failed:', err.message);
    }
  }
  if (!canCopyOrSeedPlanMeals(srcQty, need)) {
    await recordOpsEvent({
      kind: 'copy_forward_skipped',
      subscriptionId: dest.subscription_id,
      cycleId: dest.id,
      sourceCycleId: src.id,
      deliveryDate: dest.delivery_date,
      need,
      got: srcQty,
      note: 'copyPlanMealsIfEmpty: source qty ≠ destination meal_count',
    });
    return dest;
  }

  const { error: copyErr } = await supabase.from('subscription_cycle_items').insert(
    srcMeals.map((item) => ({
      cycle_id: dest.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      kind: 'plan',
    }))
  );
  if (copyErr) throw copyErr;
  const attached = await attachCycleItems([dest]);
  return attached[0] || dest;
}

async function ensureFirstBoxCycle(sub, cycles, settings, now = new Date()) {
  const firstYmd = firstBoxSunday(sub, settings, now, cycles);
  const today = torontoYmd(now);
  if (!firstYmd || String(firstYmd) < today) {
    return { firstYmd, cycle: null, cycles: cycles || [] };
  }
  let list = [...(cycles || [])];
  let cycle = list.find((row) => String(row.delivery_date) === String(firstYmd)) || null;
  const earliest = list
    .slice()
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)))[0] || null;
  const src = [...list]
    .filter((row) => row && String(row.id) !== String(cycle?.id || '') && planMealItems(row).length)
    .sort((a, b) => String(a.delivery_date).localeCompare(String(b.delivery_date)))[0]
    || earliest;

  if (!cycle) {
    const plan = sub.subscription_plans || await getPlanById(sub.plan_id);
    const delivery = src ? !!src.delivery : !!sub.delivery;
    const { data, error } = await supabase
      .from('subscription_cycles')
      .insert({
        subscription_id: sub.id,
        plan_id: sub.plan_id,
        plan_price_cents: Number(plan?.price_cents) || Number(src?.plan_price_cents) || 0,
        meal_count: Number(plan?.meal_count) || Number(src?.meal_count) || null,
        cutoff_at: cutoffAtForSunday(firstYmd, settings) || getSignupDates(now, settings || {}).cutoff_at,
        delivery_date: firstYmd,
        pickup_date: delivery ? null : firstYmd,
        status: 'open',
        delivery,
        delivery_postal_code: src?.delivery_postal_code || sub.delivery_postal_code,
        pickup_time_slot: src?.pickup_time_slot || sub.pickup_time_slot,
        special_note: src?.special_note || sub.special_note,
        delivery_fee_cents: delivery ? (Number(src?.delivery_fee_cents) || 0) : 0,
        plan_paid_cents: Number(src?.plan_paid_cents) || 0,
        addon_paid_cents: 0,
        promo_percent: Number(src?.promo_percent) || Number(sub.first_promo_percent) || 0,
      })
      .select()
      .single();
    if (error) {
      if (error.code !== '23505') throw error;
      const { data: existing, error: findErr } = await supabase
        .from('subscription_cycles')
        .select(CYCLE_SELECT)
        .eq('subscription_id', sub.id)
        .eq('delivery_date', firstYmd)
        .maybeSingle();
      if (findErr) throw findErr;
      cycle = existing || list.find((row) => String(row.delivery_date) === String(firstYmd)) || null;
    } else {
      cycle = data;
    }
    if (cycle && src) cycle = await copyPlanMealsIfEmpty(cycle, src);
    const attached = cycle ? await attachCycleItems([cycle]) : [];
    cycle = attached[0] || cycle;
    if (cycle && !list.some((row) => String(row.id) === String(cycle.id))) list.push(cycle);
  } else if (cycle.status === 'skipped') {
    cycle = await reopenSkippedCycle(cycle);
    if (src && String(src.id) !== String(cycle.id)) {
      cycle = await copyPlanMealsIfEmpty(cycle, src);
    }
    list = list.map((row) => (String(row.id) === String(cycle.id) ? cycle : row));
  } else if (src && String(src.id) !== String(cycle.id) && !planMealItems(cycle).length) {
    cycle = await copyPlanMealsIfEmpty(cycle, src);
    list = list.map((row) => (String(row.id) === String(cycle.id) ? cycle : row));
  }

  return { firstYmd, cycle, cycles: list };
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
      if (!last4) {
        // Stored PM exists but Stripe has no usable card — force update in UI.
        map[id] = { needsUpdate: true };
        return;
      }
      map[id] = {
        brand: String(pm.card.brand || 'card'),
        last4,
        expMonth: pm.card.exp_month || null,
        expYear: pm.card.exp_year || null,
      };
    } catch (err) {
      console.warn('[subscriptions] card lookup failed:', err.message);
      // Dead PM after key rotate / deleted customer — never treat as "no card".
      map[id] = { needsUpdate: true };
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
      pending_plan_id, pending_status, pause_reason, paused_at, cancelled_reason, created_at, stripe_payment_method_id,
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

  return Promise.all(subs.map(async (sub) => {
    const ensured = await ensureFirstBoxCycle(sub, bySub[sub.id] || [], settings || {}, now);
    const list = ensured.cycles;
    const firstYmd = ensured.firstYmd;
    const firstDue = firstBoxStillDue(sub, settings || {}, now, list);
    const editable = canEditOpenBox(sub, settings || {}, now, list);
    const open = earliestOpenCycle(list);
    // Match getOrCreateEditableCycle: after this Sunday's lock, edits target the
    // following open week — don't keep week/edit_cycle stuck on the locked Sunday.
    const clockOpen = open && !lockPassedForSunday(open.delivery_date, now, settings || {})
      ? open
      : null;
    const weekHint = clockOpen
      || (open ? { ...open, status: 'locked' } : null)
      || hintCycleForEdit(list, now, settings || {});
    const week = getEditWeek(now, settings || {}, weekHint);
    const thisSunday = getSignupDates(now, settings || {}).job_sunday;
    let receivingWeeks = upcomingReceivingCycles(list, now, sub.created_at, settings || {}, firstYmd);
    // Manual pause: only committed boxes still go out. Unpaid open weeks are not a next box.
    // Keep unpaid weeks visible for payment_failed so they can pay to resume.
    const manualPause = sub.status === 'paused' && sub.pause_reason !== 'payment_failed';
    if (manualPause && !firstDue) {
      receivingWeeks = receivingWeeks.filter((row) => (
        row
        && row.status !== 'skipped'
        && (row.status === 'locked' || Number(row.plan_paid_cents) > 0)
      ));
    }
    let receiving = receivingWeeks[0] || (firstDue ? ensured.cycle : null) || null;
    if (receiving?.status === 'skipped') {
      receiving = String(receiving.delivery_date) === String(firstYmd)
        ? await reopenSkippedCycle(receiving)
        : await reopenPaidSkippedCycle(receiving);
    }
    const lockedBox = nextBoxLockedCycle(list, now, sub.created_at, settings || {}, firstYmd);
    const thisWeekCycle = lockedBox
      || receiving
      || (list || []).find((row) => (
        String(row.delivery_date) === String(thisSunday)
        && row.status !== 'skipped'
        && (
          subscribedBeforeLock(sub.created_at, row.delivery_date, settings || {})
          || String(row.delivery_date) === String(firstYmd)
        )
      )) || null;
    // Meals/extras follow the editable week. After cutoff, this_week_date is the
    // locked Sunday still in motion (Next box), when that cycle exists.
    let current = clockOpen
      || (list || []).find((row) => (
        row
        && row.status === 'open'
        && String(row.delivery_date) === String(week.delivery_date)
      ))
      || null;
    // Paused with no first-box / committed week: don't surface an unpaid open edit week as "next".
    if (manualPause && !firstDue && current && Number(current.plan_paid_cents) <= 0) {
      current = null;
    }
    const mealSource = previousCycleFromList(list, current)
      || latestCycleWithPlanMeals(list, current?.id)
      || thisWeekCycle;
    if (current?.id && mealSource?.id) {
      current = await copyPlanMealsIfEmpty(current, mealSource);
    }
    const shown = current || receiving || thisWeekCycle || {
      delivery_date: week.delivery_date || firstYmd,
      pickup_date: sub.delivery ? null : (week.delivery_date || firstYmd),
      delivery: !!sub.delivery,
      delivery_postal_code: sub.delivery_postal_code,
      pickup_time_slot: sub.pickup_time_slot,
      special_note: sub.special_note,
      promo_percent: 0,
      subscription_cycle_items: [],
    };
    // Last box with meals (even if skipped/locked) so resume review can keep selections.
    const mealSeedCycle = (planMealItems(shown).length ? shown : null)
      || mealSource
      || latestCycleWithPlanMeals(list);
    const chargeSunday = firstDue && sub.status === 'paused'
      ? nextOpenSunday(firstYmd)
      : (receiving?.delivery_date || week.delivery_date);
    const charge = getChargeDeadline(now, settings || {}, chargeSunday);
    const mealCount = Number(sub.subscription_plans?.meal_count) || 0;
    // Count for the editable cycle only — never compare a pending next-week
    // box (new size) against the still-current plan (old size), or vice versa.
    const editPlanCount = (() => {
      if (!current) return mealCount;
      if (
        sub.pending_plan_id
        && String(current.plan_id) === String(sub.pending_plan_id)
      ) {
        return Number(sub.pending_plan?.meal_count) || Number(current.meal_count) || mealCount;
      }
      return Number(current.meal_count) || mealCount;
    })();
    const planMeals = current
      ? planMealItems(current).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      : 0;
    const today = torontoYmd(now);
    const showFirstDelivery = Boolean(firstDue && firstYmd && String(firstYmd) >= today);
    const storedPct = Number(shown?.promo_percent) || 0;
    const firstWeekPct = Number(sub.first_promo_percent) || 0;
    const addonPromoPercent = storedPct > 0
      ? storedPct
      : (shown && firstYmd && String(shown.delivery_date) === String(firstYmd) ? firstWeekPct : 0);
    // Manual pause: never treat an unpaid open week as "still receiving" — that
    // week should be skipped (or was opened only to review meals before resume).
    // Resume is not a new first box; only paid/locked cycles go out while paused.
    const nextBoxCycle = (manualPause && !firstDue)
      ? (receiving || null)
      : (receiving || thisWeekCycle || (firstDue ? ensured.cycle : null) || null);
    const { stripe_payment_method_id: _pm, ...publicSub } = sub;
    void _pm;
    const lookedUp = cardMap[sub.stripe_payment_method_id] || null;
    // Active/paused plans must always surface a card state — never a blank "no card".
    const card = lookedUp
      || (
        (sub.status === 'active' || sub.status === 'paused')
          ? { needsUpdate: true }
          : null
      );
    return {
      ...publicSub,
      card,
      cycle: shown,
      edit_cycle: current,
      meal_seed_cycle: mealSeedCycle || null,
      this_week_date: thisWeekCycle?.delivery_date || null,
      this_week_cycle: thisWeekCycle,
      next_box_date: nextBoxCycle?.delivery_date || (firstDue ? firstYmd : null),
      next_box_cycle: nextBoxCycle,
      week,
      charge,
      can_edit: editable,
      edit_meal_count: editPlanCount,
      meals_need_update: Boolean(
        editable
        && current
        && editPlanCount > 0
        && planMeals !== editPlanCount
      ),
      addon_promo_percent: addonPromoPercent,
      first_promo_kind: sub.first_promo_code
        ? (referralCodes.has(String(sub.first_promo_code).toUpperCase()) ? 'referral' : 'promo')
        : null,
      first_box_protected: firstDue,
      first_delivery_date: showFirstDelivery ? firstYmd : null,
      first_delivery_label: showFirstDelivery ? sundayLabelFromYmd(firstYmd) : '',
    };
  }));
}

function adminWeekMeta(now = new Date(), settings = {}) {
  const dates = getSignupDates(now, settings || {});
  // Kitchen "This Sunday" is the calendar Sunday (today, when today is Sunday).
  // job_sunday jumps to next week's cook date once Wednesday lock has passed,
  // which would hide today's boxes on Sunday itself.
  const thisSunday = calendarThisSundayYmd(now);
  const nextSunday = nextOpenSunday(thisSunday);
  return {
    cutoff_passed: dates.cutoff_passed,
    cutoff_at: dates.cutoff_at,
    cutoff_label: dates.cutoff_label,
    this_sunday: thisSunday,
    this_sunday_label: sundayLabelFromYmd(thisSunday),
    this_cutoff_label: cutoffLabelForSunday(thisSunday, settings) || dates.cutoff_label,
    this_cutoff_passed: lockPassedForSunday(thisSunday, now, settings),
    next_sunday: nextSunday,
    next_sunday_label: sundayLabelFromYmd(nextSunday),
    next_cutoff_label: cutoffLabelForSunday(nextSunday, settings) || dates.cutoff_label,
    next_cutoff_passed: lockPassedForSunday(nextSunday, now, settings),
  };
}

/** Active plans still get a next-Sunday box; the DB row is usually created at Wednesday lock. */
function expectsNextSundayBox(sub) {
  if (!sub || sub.status !== 'active') return false;
  if (sub.pending_status === 'cancelled' || sub.pending_status === 'paused') return false;
  return true;
}

/** Same rules as admin kitchen list: skipped unpaid weeks are not a "Sunday" for the row. */
function adminReceivesBox(sub, cycle) {
  if (!cycle || cycle.status === 'skipped') return false;
  if (sub?.status === 'active') return true;
  if (cycle.status === 'locked') return true;
  return Number(cycle.plan_paid_cents) > 0;
}

/**
 * Paused/cancelled tab Sunday column: upcoming box if still going out,
 * otherwise the latest real box — never a skipped unpaid week.
 */
function adminDisplayCycle(sub, list, thisCycle, nextCycle) {
  if (adminReceivesBox(sub, thisCycle)) return thisCycle;
  if (adminReceivesBox(sub, nextCycle)) return nextCycle;
  const real = [...(list || [])]
    .filter((row) => row && row.status !== 'skipped')
    .sort((a, b) => String(b.delivery_date).localeCompare(String(a.delivery_date)));
  return real[0] || null;
}

/**
 * Non-persisted cycle so admin "Next Sunday" lists active subscribers before openNextWeek runs.
 * Meals/fulfillment mirror the latest known cycle (usually this Sunday).
 * Deferred plan changes use pending_plan size — never preview the old plan's meal count.
 */
function previewNextSundayCycle(sub, source, nextSunday, settings, now = new Date()) {
  const delivery = source ? !!source.delivery : !!sub.delivery;
  const pending = sub.pending_plan || null;
  const usePending = Boolean(sub.pending_plan_id && pending);
  const need = usePending
    ? (Number(pending.meal_count) || 0)
    : (Number(source?.meal_count) || Number(sub.subscription_plans?.meal_count) || 0);
  const sourceItems = planMealItems(source);
  const sourceQty = sourceItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  // Only mirror this Sunday's meals when the qty still matches next week's plan size.
  const planItems = (need <= 0 || sourceQty === need)
    ? sourceItems.map((item, index) => ({
      ...item,
      id: item?.id != null ? `preview-${item.id}` : `preview-item-${index}`,
      cycle_id: null,
    }))
    : [];
  return {
    id: null,
    subscription_id: sub.id,
    status: 'open',
    order_id: null,
    cutoff_at: cutoffAtForSunday(nextSunday, settings) || getSignupDates(now, settings || {}).cutoff_at,
    delivery_date: nextSunday,
    pickup_date: delivery ? null : nextSunday,
    delivery,
    delivery_postal_code: source?.delivery_postal_code ?? sub.delivery_postal_code ?? null,
    pickup_time_slot: source?.pickup_time_slot ?? sub.pickup_time_slot ?? null,
    special_note: source?.special_note ?? sub.special_note ?? null,
    delivery_fee_cents: delivery ? (Number(source?.delivery_fee_cents) || 0) : 0,
    plan_paid_cents: 0,
    addon_paid_cents: 0,
    promo_percent: 0,
    plan_id: usePending ? sub.pending_plan_id : (source?.plan_id || sub.plan_id || null),
    meal_count: need || null,
    plan_price_cents: usePending
      ? (Number(pending.price_cents) || 0)
      : (
        Number(sub.subscription_plans?.price_cents)
        || Number(source?.plan_price_cents)
        || 0
      ),
    subscription_cycle_items: planItems,
    is_preview: true,
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
      pickup_time_slot, special_note, created_at, paused_at, resumed_at, cancelled_at, card_updated_at,
      pause_reason, cancelled_reason, pending_plan_id, pending_status,
      last_decline_code, last_decline_at,
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
    const thisCycle = list.find((row) => String(row.delivery_date) === String(meta.this_sunday)) || null;
    let nextCycle = list.find((row) => String(row.delivery_date) === String(meta.next_sunday)) || null;
    // Next-week rows are created at Wednesday lock; preview so active kitchens still appear.
    if (!nextCycle && expectsNextSundayBox(sub)) {
      const source = thisCycle || pickDisplayCycle(list, now) || null;
      nextCycle = previewNextSundayCycle(sub, source, meta.next_sunday, settings || {}, now);
    }
    const display = adminDisplayCycle(sub, list, thisCycle, nextCycle)
      || pickDisplayCycle(list, now);
    const week = getEditWeek(now, settings || {}, earliestOpenCycle(list) || hintCycleForEdit(list, now, settings || {}));
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

/** Plan size for an editable cycle — pending deferred plan when that cycle is already stamped. */
async function effectivePlanForEditableCycle(sub, cycle) {
  const current = sub.subscription_plans || await getPlanById(sub.plan_id);
  if (
    sub.pending_plan_id
    && cycle?.plan_id
    && String(cycle.plan_id) === String(sub.pending_plan_id)
  ) {
    const pending = await getPlanById(sub.pending_plan_id);
    if (pending) return pending;
  }
  return current;
}

async function getOrCreateEditableCycle(sub) {
  const settings = await getSettings();
  const now = new Date();
  const { data: allCycles, error: allErr } = await supabase
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', sub.id);
  if (allErr) throw allErr;
  const attached = await attachCycleItems(allCycles || []);
  const ensured = await ensureFirstBoxCycle(sub, attached, settings || {}, now);
  const list = ensured.cycles;
  const hint = hintCycleForEdit(list, now, settings || {});
  const open = earliestOpenCycle(list);
  const clockOpen = open && !lockPassedForSunday(open.delivery_date, now, settings || {})
    ? open
    : null;
  const hintForWeek = clockOpen
    || (open ? { ...open, status: 'locked' } : null)
    || (hint && hint.status !== 'open' ? hint : null);
  let week = getEditWeek(now, settings || {}, hintForWeek);
  if (clockOpen) {
    const src = previousCycleFromList(list, open) || pickDisplayCycle(list, now);
    return { cycle: await copyPlanMealsIfEmpty(open, src), week };
  }

  let existing = (list || []).find((row) => String(row.delivery_date) === String(week.delivery_date)) || null;

  // Pause-before-charge skips this Sunday unpaid. Resume/review should reopen it
  // while that week's lock is still open — not jump to the following Sunday.
  if (
    existing
    && existing.status === 'skipped'
    && Number(existing.plan_paid_cents || 0) <= 0
    && !lockPassedForSunday(existing.delivery_date, now, settings || {})
  ) {
    existing = await reopenSkippedCycle(existing);
  }

  // No open row yet. Never mutate locked/paid-skipped; create the next Sunday instead.
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
    existing = (list || []).find((row) => String(row.delivery_date) === String(nextSunday)) || null;
  }
  if (existing) {
    const openExisting = requireOpenCycle(existing);
    const src = previousCycleFromList(list, openExisting) || pickDisplayCycle(list, now);
    return { cycle: await copyPlanMealsIfEmpty(openExisting, src), week };
  }

  const plan = sub.pending_plan_id
    ? ((await getPlanById(sub.pending_plan_id)) || sub.subscription_plans || await getPlanById(sub.plan_id))
    : (sub.subscription_plans || await getPlanById(sub.plan_id));
  const src = pickDisplayCycle(list, now);
  const need = Number(plan?.meal_count) || 0;
  const { data: cycle, error } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: plan?.id || sub.plan_id,
      plan_price_cents: Number(plan?.price_cents) || 0,
      meal_count: need || null,
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
    const srcQty = (items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    if (items && items.length && (!need || srcQty === need)) {
      const { error: copyErr } = await supabase.from('subscription_cycle_items').insert(
        items.map((item) => ({ ...item, cycle_id: cycle.id }))
      );
      if (copyErr) throw copyErr;
    }
  }

  return { cycle, week };
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

/** Replace plan meals (and optional add-ons) on a specific open cycle. */
async function writeCyclePlanAndAddons(cycleId, meals, addons, { mealCount } = {}) {
  const { qtyLines, resolveLines } = require('./subscriptionCheckout');
  const mealLines = qtyLines(meals);
  const mealQty = mealLines.reduce((sum, line) => sum + line.quantity, 0);
  const need = Number(mealCount) || 0;
  if (need > 0 && mealQty !== need) {
    throw new SubscriptionError(
      400,
      `Pick exactly ${need} meal${need === 1 ? '' : 's'} for this plan.`
    );
  }

  const { data: existingPlan, error: existingErr } = await supabase
    .from('subscription_cycle_items')
    .select('product_id')
    .eq('cycle_id', cycleId)
    .eq('kind', 'plan');
  if (existingErr) throw existingErr;

  const allowUnavailableIds = new Set((existingPlan || []).map((row) => row.product_id));
  const resolvedMeals = await resolveLines(mealLines, { kind: 'plan', allowUnavailableIds });
  await replaceCycleKindItems(cycleId, 'plan', resolvedMeals);

  const addonLines = qtyLines(addons);
  const resolvedAddons = addonLines.length ? await resolveLines(addonLines, { kind: 'addon' }) : [];
  await replaceCycleKindItems(cycleId, 'addon', resolvedAddons);

  const stamp = { meals_confirmed_at: new Date().toISOString() };
  if (need > 0) stamp.meal_count = need;
  const { error: stampErr } = await supabase
    .from('subscription_cycles')
    .update(stamp)
    .eq('id', cycleId);
  if (stampErr) {
    console.warn('[subscriptions] meals_confirmed_at stamp failed:', stampErr.message);
  }
  return { mealQty };
}

/** Load meal/addon lines for emails — by cycle id only (no nested embeds). */
async function labeledBoxItemsForCycle(cycleId) {
  const id = String(cycleId || '');
  if (!id) return { meals: [], addons: [] };
  const { data, error } = await supabase
    .from('subscription_cycle_items')
    .select('cycle_id, product_id, quantity, kind')
    .eq('cycle_id', id);
  if (error) throw error;
  const rows = (data || []).filter((item) => String(item.cycle_id) === id);
  const productIds = [...new Set(rows.map((item) => Number(item.product_id)).filter((n) => n > 0))];
  let names = new Map();
  if (productIds.length) {
    const { data: products, error: productErr } = await supabase
      .from('products')
      .select('id, slug')
      .in('id', productIds);
    if (productErr) throw productErr;
    names = new Map((products || []).map((row) => [Number(row.id), row.slug]));
  }
  const mapped = rows.map((item) => ({
    slug: names.get(Number(item.product_id)) || 'Item',
    quantity: item.quantity,
    kind: item.kind,
  }));
  return {
    meals: mapped.filter((item) => item.kind === 'plan'),
    addons: mapped.filter((item) => item.kind === 'addon'),
  };
}

async function sendBoxUpdatedEmail(userId, sub, cycle, week, plan) {
  const { getUserByAuthId } = require('./user');
  const { renderSubscriptionUpdatedEmail } = require('../utils/emailTemplates');
  const { sendCustomerEmail } = require('../emails/sendSubscriptionMail');
  const user = await getUserByAuthId(userId);
  if (!user?.email) return false;
  const box = await labeledBoxItemsForCycle(cycle?.id);
  const msg = renderSubscriptionUpdatedEmail({
    firstName: user.first_name,
    mealCount: plan?.meal_count ?? sub.subscription_plans?.meal_count,
    delivery: !!cycle?.delivery,
    deliveryLabel: week?.delivery_label,
    pickupSlot: cycle?.pickup_time_slot,
    appliesTo: week?.applies_to,
    meals: box.meals,
    addons: box.addons,
    notes: cycle?.special_note,
  });
  await sendCustomerEmail({ to: user.email, msg });
  return true;
}

/** Save meals and add-ons together so the customer gets one update email. */
async function replaceOpenCyclePlanAndAddons(userId, subscriptionId, meals, addons) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  const settings = await getSettings();
  if (!canEditOpenBox(sub, settings || {})) {
    throw new SubscriptionError(400, 'This box cannot be edited right now.');
  }
  const { cycle, week } = await getOrCreateEditableCycle(sub);
  requireOpenCycle(cycle);
  const plan = await effectivePlanForEditableCycle(sub, cycle);

  await writeCyclePlanAndAddons(cycle.id, meals, addons, {
    mealCount: Number(plan.meal_count) || 0,
  });

  // Paused saves are almost always the resume meal-review step — resume email
  // already lists the box, so skip a second "box updated" mail.
  if (sub.status !== 'paused') {
    try {
      await sendBoxUpdatedEmail(userId, sub, cycle, week, plan);
    } catch (err) {
      console.warn('[subscriptions] box-updated email failed:', err.message);
    }
  }

  return { ok: true, week };
}

/**
 * Mid-week pickup→delivery after the plan is already paid for this Sunday.
 * Unpaid weeks do not use this — delivery rides with Tuesday's plan charge.
 * Persists stripe_delivery_payment_intent_id so pause / delivery→pickup can refund it.
 */
async function chargeDeliveryFee(sub, cycle, feeCents) {
  const amount = Math.round(Number(feeCents) * 1.13);
  if (amount < 50) {
    throw new SubscriptionError(400, 'Delivery fee is too small to charge.');
  }
  if (!sub.stripe_customer_id || !sub.stripe_payment_method_id) {
    throw new SubscriptionError(400, 'No card on file for the delivery fee. Email hello@earthtableco.ca.');
  }
  // Already charged this cycle — only reuse if that PI still holds the fee.
  const { paymentIntentCaptureState } = require('./subscriptionRefunds');
  const seedDeliveryPi = cycle?.stripe_delivery_payment_intent_id
    ? String(cycle.stripe_delivery_payment_intent_id)
    : '';
  if (seedDeliveryPi) {
    const state = await paymentIntentCaptureState(seedDeliveryPi);
    if (state.ok && state.status === 'succeeded' && state.remaining >= amount) {
      return { id: seedDeliveryPi, already: true };
    }
    // Fully refunded — fall through and walk after-{pi} keys.
  }
  const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
  let attempt = seedDeliveryPi ? `after-${seedDeliveryPi.slice(-10)}` : '0';
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
        description: 'Subscription delivery fee',
        metadata: {
          kind: 'subscription_delivery',
          subscription_id: sub.id,
          cycle_id: cycle.id,
        },
      }, {
        idempotencyKey: `sub-delivery-${cycle.id}-${attempt}`,
      });
      const createdId = pi?.id ? String(pi.id) : '';
      if (!createdId) {
        throw new Error('delivery_pi_missing');
      }
      const state = await paymentIntentCaptureState(createdId);
      if (state.ok && state.remaining >= amount) {
        const { error } = await supabase
          .from('subscription_cycles')
          .update({ stripe_delivery_payment_intent_id: createdId })
          .eq('id', cycle.id);
        if (error) {
          console.warn('[subscriptions] failed to store delivery PI:', cycle.id, error.message);
        } else {
          cycle.stripe_delivery_payment_intent_id = createdId;
        }
        return pi;
      }
      console.warn(
        '[subscriptions] delivery PI has insufficient capture; chaining after',
        createdId,
        state
      );
      attempt = `after-${createdId.slice(-10)}`;
    }
    throw new Error('delivery_charge_not_captured');
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
  const settings = await getSettings();
  if (!canEditOpenBox(sub, settings || {})) {
    throw new SubscriptionError(400, 'This box cannot be edited right now.');
  }
  const { cycle, week } = await getOrCreateEditableCycle(sub);
  requireOpenCycle(cycle);

  const specialNote = String(body.special_note || '').trim() || null;

  if (body.notes_only) {
    if (cycle.delivery && (!specialNote || specialNote.length < 8)) {
      throw new SubscriptionError(400, 'Please enter your full delivery address.');
    }
    // Notes are per Sunday/cycle — never overwrite the subscription default or
    // another week's locked box (e.g. edits after cutoff hit the following week).
    const deliveryDate = week.delivery_date || cycle.delivery_date || null;
    await recordNotesHistory({
      subscriptionId: sub.id,
      cycleId: cycle.id,
      deliveryDate,
      previousNote: cycle.special_note,
      note: specialNote,
      source: 'notes_only',
    });
    const { error: cycleErr } = await supabase
      .from('subscription_cycles')
      .update({ special_note: specialNote })
      .eq('id', cycle.id);
    if (cycleErr) throw cycleErr;
    const updated = { ...cycle, special_note: specialNote };
    try {
      const { getUserByAuthId } = require('./user');
      const { renderSubscriptionManageEmail } = require('../utils/emailTemplates');
      const { sendCustomerEmail } = require('../emails/sendSubscriptionMail');
      const user = await getUserByAuthId(userId);
      if (user?.email) {
        const msg = renderSubscriptionManageEmail({
          kind: 'notes_updated',
          firstName: user.first_name,
          mealCount: (sub.subscription_plans || {}).meal_count,
          deliveryLabel: week.delivery_label,
          appliesTo: week.applies_to,
          notes: specialNote || '',
        });
        await sendCustomerEmail({ to: user.email, msg });
      }
    } catch (err) {
      console.warn('[subscriptions] notes-updated email failed:', err.message);
    }
    return {
      ok: true,
      cycle: updated,
      week,
      notes_for_delivery_date: deliveryDate,
    };
  }

  const delivery = !!body.delivery;
  const pickupSlot = String(body.pickup_time_slot || '').trim();
  const wasPickup = !cycle.delivery;
  let deliveryFeeChargedCents = 0;

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
    // Paid delivery week: freeze the fee already billed — postal/address can change
    // without a mid-week Stripe settle for a different quote.
    if (
      week.applies_to === 'this_sunday'
      && !wasPickup
      && Number(cycle.plan_paid_cents) > 0
      && Number(cycle.delivery_fee_cents) > 0
    ) {
      patch.delivery_fee_cents = Number(cycle.delivery_fee_cents);
    } else {
      patch.delivery_fee_cents = quote.fee_cents;
    }

    // Unpaid weeks: fee stays on the cycle and is billed with Tuesday's plan charge.
    // Already-paid this Sunday: charge delivery now (idempotent) so the kitchen is covered.
    const chargeNow = week.applies_to === 'this_sunday' && wasPickup && Number(cycle.plan_paid_cents) > 0;
    if (chargeNow) {
      const charged = await chargeDeliveryFee(sub, cycle, quote.fee_cents);
      // Don't claim a new charge when Stripe reused an already-captured delivery PI.
      deliveryFeeChargedCents = charged?.already
        ? 0
        : Math.round(Number(quote.fee_cents) * 1.13);
    }
  } else {
    if (!PICKUP_SLOTS.has(pickupSlot)) {
      throw new SubscriptionError(400, 'Choose a pickup time.');
    }
    patch.delivery_postal_code = null;
    patch.pickup_time_slot = pickupSlot;
    // Always clear — otherwise a prior delivery quote stays and Tuesday can still bill it.
    patch.delivery_fee_cents = 0;
    // Keep stripe_delivery_payment_intent_id after refund — next pickup→delivery
    // chains after-{id} so Stripe won't replay a refunded delivery PI.

    // Paid this Sunday delivery→pickup: auto-refund delivery fee (+ tax) before lock.
    const refundFeeNow = (
      week.applies_to === 'this_sunday'
      && !wasPickup
      && Number(cycle.plan_paid_cents) > 0
      && (Number(cycle.delivery_fee_cents) > 0 || cycle.stripe_delivery_payment_intent_id)
    );
    if (refundFeeNow) {
      const { refundDeliveryFee } = require('./subscriptionRefunds');
      const feePreTax = Number(cycle.delivery_fee_cents) || 0;
      const refund = await refundDeliveryFee(cycle, {
        feePreTax,
        metadata: {
          kind: 'subscription_delivery_fee_refund',
          subscription_id: sub.id,
          cycle_id: String(cycle.id),
        },
      });
      if (!refund.ok) {
        const { notifyOwnerRefundFailed } = require('./subscriptionManage');
        await notifyOwnerRefundFailed(userId, {
          action: 'delivery_fee',
          reason: refund.error || 'refund_failed',
          deliveryLabel: week?.delivery_label,
          subscriptionId: sub.id,
        });
        throw new SubscriptionError(
          402,
          'We couldn\'t refund the delivery fee, so pickup was not saved and you\'re still on delivery. Try again, or email hello@earthtableco.ca and we\'ll help.'
        );
      }
      patch._deliveryFeeRefundedCents = Number(refund.refundedCents) || 0;
    }
  }

  const deliveryFeeRefundedCents = Number(patch._deliveryFeeRefundedCents) || 0;
  delete patch._deliveryFeeRefundedCents;

  // Delivery prefs stay on the subscription as defaults for new weeks.
  // special_note stays on the cycle only so each Sunday keeps its own notes.
  await recordNotesHistory({
    subscriptionId: sub.id,
    cycleId: cycle.id,
    deliveryDate: week.delivery_date || cycle.delivery_date || null,
    previousNote: cycle.special_note,
    note: specialNote,
    source: 'fulfillment',
  });

  const { error: subErr } = await supabase
    .from('subscriptions')
    .update({
      delivery: patch.delivery,
      delivery_postal_code: patch.delivery_postal_code,
      pickup_time_slot: patch.pickup_time_slot,
    })
    .eq('id', sub.id);
  if (subErr) throw subErr;

  const cycleUpdate = {
    delivery: patch.delivery,
    delivery_postal_code: patch.delivery_postal_code,
    pickup_time_slot: patch.pickup_time_slot,
    special_note: patch.special_note,
    delivery_fee_cents: patch.delivery_fee_cents ?? cycle.delivery_fee_cents,
    pickup_date: delivery ? null : week.delivery_date,
  };
  if (Object.prototype.hasOwnProperty.call(patch, 'stripe_delivery_payment_intent_id')) {
    cycleUpdate.stripe_delivery_payment_intent_id = patch.stripe_delivery_payment_intent_id;
  }
  const { error: cycleErr } = await supabase
    .from('subscription_cycles')
    .update(cycleUpdate)
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
      const planAlreadyPaid = Number(cycle.plan_paid_cents) > 0;
      const deliveryFeeCents = Number(patch.delivery_fee_cents) || 0;
      if (user?.email) {
        const msg = renderSubscriptionManageEmail({
          kind: delivery ? 'fulfillment_delivery' : 'fulfillment_pickup',
          firstName: user.first_name,
          fulfillmentDate: week.delivery_label,
          deliveryLabel: week.delivery_label,
          cutoffLabel: week.cutoff_label,
          address: delivery ? specialNote : PICKUP_ADDRESS,
          pickupSlot,
          planAlreadyPaid,
          refundedCents: deliveryFeeRefundedCents,
          chargedDeltaCents: deliveryFeeChargedCents,
          deliveryFeeCents,
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
        planAlreadyPaid,
        refundedCents: deliveryFeeRefundedCents,
        chargedDeltaCents: deliveryFeeChargedCents,
        deliveryFeeCents,
      }));
    }
  } catch (err) {
    console.warn('[subscriptions] fulfillment email failed:', err.message);
  }

  return {
    ok: true,
    week,
    delivery_fee_cents: patch.delivery_fee_cents ?? cycle.delivery_fee_cents,
    refunded_cents: deliveryFeeRefundedCents,
    charged_delta_cents: deliveryFeeChargedCents,
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
 * Tuesday 9:00 AM plan charge / Wednesday 5:00 PM meal lock, America/Toronto.
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
const PLAN_MEAL_CATEGORY_NAMES = new Set(['bowls', 'salads', 'main plates', 'soups']);

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
  getSettings,
  updateSettings,
  getPublicSignupInfo,
  replaceOpenCyclePlanAndAddons,
  writeCyclePlanAndAddons,
  recordPlanChange,
  recordOpsEvent,
  recordNotesHistory,
  updateOpenCycleFulfillment,
  getOwnedSubscription,
  runCardExpiryNotices,
  copyPlanMealsIfEmpty,
  firstBoxSunday,
  firstBoxStillDue,
  canEditOpenBox,
  ensureFirstBoxCycle,
  getOrCreateEditableCycle,
  planMealItems,
  labeledBoxItemsForCycle,
  reopenSkippedCycle,
  previewNextSundayCycle,
};

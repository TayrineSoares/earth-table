const GUEST_KEY = 'subscription_cart_guest';

function userKey(userId) {
  return `subscription_cart_${userId}`;
}

function emptySubCart() {
  return {
    planId: null,
    planName: '',
    mealCount: 0,
    priceCents: 0,
    meals: [],
    addons: [],
  };
}

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return emptySubCart();
    return {
      ...emptySubCart(),
      ...parsed,
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      addons: Array.isArray(parsed.addons) ? parsed.addons : [],
    };
  } catch {
    return emptySubCart();
  }
}

function readSubCart(userId) {
  return readStored(userId ? userKey(userId) : GUEST_KEY);
}

function writeSubCart(userId, cart) {
  const next = cart && typeof cart === 'object' ? cart : emptySubCart();
  localStorage.setItem(userId ? userKey(userId) : GUEST_KEY, JSON.stringify(next));
  return next;
}

/** If they were mid-signup as a guest, that plan replaces any older user cart. */
function adoptGuestSubCart(userId) {
  const guest = readSubCart(null);
  if (guest.planId) {
    writeSubCart(userId, guest);
    writeSubCart(null, emptySubCart());
    return guest;
  }
  writeSubCart(null, emptySubCart());
  return readSubCart(userId);
}

function applyPlanToCart(cart, plan) {
  const sameCount = Number(cart.mealCount) === Number(plan.meal_count);
  const samePlan = cart.planId === plan.id;
  return {
    ...cart,
    planId: plan.id,
    planName: plan.name,
    mealCount: plan.meal_count,
    priceCents: plan.price_cents,
    meals: sameCount ? cart.meals : [],
    addons: samePlan ? cart.addons : [],
  };
}

function toLine(product) {
  return {
    id: product.id,
    slug: product.slug,
    image_url: product.image_url,
    price_cents: product.price_cents,
    category_id: product.category_id,
    quantity: 0,
  };
}

function seedLinesFromCycle(cycle, kind) {
  return (cycle?.subscription_cycle_items || [])
    .filter((item) => item.kind === kind)
    .map((item) => ({
      id: item.product_id,
      slug: item.products?.slug || '',
      image_url: item.products?.image_url || '',
      price_cents: item.unit_price_cents,
      quantity: item.quantity,
    }));
}

function emptyEditCart() {
  return {
    subscriptionId: null,
    planId: null,
    planName: '',
    mealCount: 0,
    priceCents: 0,
    meals: [],
    addons: [],
    planChangeId: null,
    planChangePending: false,
    // Survives meals → add-ons → cart even if location.state is dropped.
    resumeAfter: false,
  };
}

function editCartKey(userId, subscriptionId) {
  return `subscription_edit_${userId}_${subscriptionId}`;
}

function readEditCart(userId, subscriptionId) {
  if (!userId || !subscriptionId) return emptyEditCart();
  try {
    const raw = localStorage.getItem(editCartKey(userId, subscriptionId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.subscriptionId !== subscriptionId) return emptyEditCart();
    return {
      ...emptyEditCart(),
      ...parsed,
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
      addons: Array.isArray(parsed.addons) ? parsed.addons : [],
      resumeAfter: Boolean(parsed.resumeAfter),
    };
  } catch {
    return emptyEditCart();
  }
}

function writeEditCart(userId, subscriptionId, cart) {
  if (!userId || !subscriptionId) return cart;
  const next = cart && typeof cart === 'object' ? cart : emptyEditCart();
  localStorage.setItem(editCartKey(userId, subscriptionId), JSON.stringify(next));
  return next;
}

function clearEditCart(userId, subscriptionId) {
  if (!userId || !subscriptionId) return;
  localStorage.removeItem(editCartKey(userId, subscriptionId));
}

/** Prefer the editable cycle, then last box / meal seed so resume can keep selections. */
function seedPlanMeals(sub, cycle) {
  const fromCycle = seedLinesFromCycle(cycle, 'plan');
  if (fromCycle.length) return fromCycle;
  const fromEdit = seedLinesFromCycle(sub?.edit_cycle, 'plan');
  if (fromEdit.length) return fromEdit;
  const fromLastBox = seedLinesFromCycle(sub?.this_week_cycle, 'plan');
  if (fromLastBox.length) return fromLastBox;
  return seedLinesFromCycle(sub?.meal_seed_cycle, 'plan');
}

/** Start an edit draft from the cycle they can still change. */
function seedEditCart(sub, cycle) {
  const currentPlan = sub?.subscription_plans || {};
  const pending = sub?.pending_plan;
  // Deferred plan change: the following-week cycle is already stamped with the new plan.
  const usePending = Boolean(
    pending?.id
    && cycle?.plan_id
    && String(cycle.plan_id) === String(pending.id)
  );
  const plan = usePending ? pending : currentPlan;
  const mealCount = usePending
    ? (Number(pending.meal_count) || Number(sub.edit_meal_count) || 0)
    : (Number(sub.edit_meal_count) || Number(plan.meal_count) || 0);
  return {
    subscriptionId: sub.id,
    planId: usePending ? pending.id : sub.plan_id,
    planName: plan.name || '',
    mealCount,
    priceCents: Number(plan.price_cents) || 0,
    // Keep last plan meals when the open week is empty (resume review).
    meals: seedPlanMeals(sub, cycle),
    // Add-ons stay on the editable cycle only — they do not carry from older boxes.
    addons: seedLinesFromCycle(cycle, 'addon'),
    planChangeId: null,
    planChangePending: false,
    resumeAfter: false,
  };
}

/**
 * Draft for a plan switch: new meal count/price, keep current meals as a starting
 * point so they can top up or trim to the exact count before the change commits.
 */
function seedEditCartForPlanChange(sub, cycle, nextPlan, { pending = false } = {}) {
  return {
    subscriptionId: sub.id,
    planId: nextPlan.id,
    planName: nextPlan.name || '',
    mealCount: Number(nextPlan.meal_count) || 0,
    priceCents: Number(nextPlan.price_cents) || 0,
    meals: seedPlanMeals(sub, cycle),
    // Pending switch is for the following week — add-ons do not carry.
    addons: pending ? [] : seedLinesFromCycle(cycle, 'addon'),
    planChangeId: nextPlan.id,
    planChangePending: Boolean(pending),
    resumeAfter: false,
  };
}

function totalQty(lines) {
  return (lines || []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
}

function lineQty(lines, productId) {
  const row = (lines || []).find((line) => line.id === productId);
  return row ? Number(row.quantity) || 0 : 0;
}

function bumpLines(lines, product, delta, maxTotal) {
  const next = (lines || []).map((line) => ({ ...line }));
  const index = next.findIndex((line) => String(line.id) === String(product.id));
  const current = index === -1 ? 0 : (Number(next[index].quantity) || 0);
  let wanted = current + (Number(delta) || 0);
  if (wanted < 0) wanted = 0;

  // Cap only when adding — on plan downgrade the box can be over the new
  // mealCount; clamping on minus would wipe a whole line in one click.
  if (maxTotal != null && delta > 0) {
    const others = next.reduce((sum, line, i) => (
      i === index ? sum : sum + (Number(line.quantity) || 0)
    ), 0);
    if (others + wanted > maxTotal) {
      wanted = Math.max(0, maxTotal - others);
    }
  }

  if (wanted === 0) {
    if (index !== -1) next.splice(index, 1);
    return next;
  }

  if (index === -1) {
    next.push({ ...toLine(product), quantity: wanted });
  } else {
    next[index] = { ...next[index], quantity: wanted };
  }
  return next;
}

function bumpMeal(cart, product, delta) {
  return {
    ...cart,
    meals: bumpLines(cart.meals, product, delta, cart.mealCount),
  };
}

function bumpAddon(cart, product, delta) {
  return {
    ...cart,
    addons: bumpLines(cart.addons, product, delta, null),
  };
}

function addonSubtotalCents(cart) {
  return (cart.addons || []).reduce(
    (sum, line) => sum + (Number(line.price_cents) || 0) * (Number(line.quantity) || 0),
    0
  );
}

function mealALaCarteCents(cart) {
  return (cart.meals || []).reduce(
    (sum, line) => sum + (Number(line.price_cents) || 0) * (Number(line.quantity) || 0),
    0
  );
}

function mealsExact(cart) {
  return totalQty(cart.meals) === Number(cart.mealCount) && Number(cart.mealCount) > 0;
}

/** Internal paths only, so ?next= cannot send people off-site. */
function safeNextPath(search) {
  const raw = new URLSearchParams(search || window.location.search).get('next');
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

function withNextQuery(path, search) {
  const next = safeNextPath(search);
  if (!next) return path;
  return `${path}?next=${encodeURIComponent(next)}`;
}

const PLAN_MEAL_CATEGORY_ORDER = ['bowls', 'salads', 'main plates', 'soups'];
const ADDON_EXCLUDED = new Set(['custom meals']);

function categoryKey(name) {
  return String(name || '').trim().toLowerCase();
}

function isPlanMealCategory(name) {
  return PLAN_MEAL_CATEGORY_ORDER.includes(categoryKey(name));
}

function isAddonCategory(name) {
  const key = categoryKey(name);
  return Boolean(key) && !ADDON_EXCLUDED.has(key);
}

function sortPlanMealCategories(categories) {
  return (categories || [])
    .filter((cat) => isPlanMealCategory(cat.name))
    .sort((a, b) => (
      PLAN_MEAL_CATEGORY_ORDER.indexOf(categoryKey(a.name))
      - PLAN_MEAL_CATEGORY_ORDER.indexOf(categoryKey(b.name))
    ));
}

function addonCategories(categories) {
  return (categories || []).filter((cat) => isAddonCategory(cat.name));
}

export {
  emptySubCart,
  readSubCart,
  writeSubCart,
  adoptGuestSubCart,
  applyPlanToCart,
  seedEditCart,
  seedEditCartForPlanChange,
  emptyEditCart,
  readEditCart,
  writeEditCart,
  clearEditCart,
  totalQty,
  lineQty,
  bumpMeal,
  bumpAddon,
  addonSubtotalCents,
  mealALaCarteCents,
  mealsExact,
  safeNextPath,
  withNextQuery,
  sortPlanMealCategories,
  addonCategories,
};

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

/** Start an edit draft from the cycle they can still change. */
function seedEditCart(sub, cycle) {
  const plan = sub?.subscription_plans || {};
  return {
    subscriptionId: sub.id,
    planId: sub.plan_id,
    planName: plan.name || '',
    mealCount: Number(plan.meal_count) || 0,
    priceCents: Number(plan.price_cents) || 0,
    meals: seedLinesFromCycle(cycle, 'plan'),
    addons: seedLinesFromCycle(cycle, 'addon'),
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
  const index = next.findIndex((line) => line.id === product.id);
  const current = index === -1 ? 0 : next[index].quantity;
  let wanted = current + delta;
  if (wanted < 0) wanted = 0;

  const others = next.reduce((sum, line, i) => (
    i === index ? sum : sum + (Number(line.quantity) || 0)
  ), 0);
  if (maxTotal != null && others + wanted > maxTotal) {
    wanted = Math.max(0, maxTotal - others);
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

const PLAN_MEAL_CATEGORY_ORDER = ['bowls', 'salads', 'main plates'];
const ADDON_EXCLUDED = new Set(['catering', 'custom meals']);

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
  GUEST_KEY,
  emptySubCart,
  readSubCart,
  writeSubCart,
  adoptGuestSubCart,
  applyPlanToCart,
  seedEditCart,
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
  isPlanMealCategory,
  isAddonCategory,
  sortPlanMealCategories,
  addonCategories,
};

import { MEAL_LOCK_BY } from './subscriptionCadence'

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Subscription request failed');
  }
  return data;
}

/** "cilantro lime chicken bowl" -> "Cilantro Lime Chicken Bowl" */
const titleCaseName = (name) => {
  return String(name || '').replace(/\w\S*/g, (word) => (
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ));
};

const titleCaseCycle = (cycle) => {
  if (!cycle) return cycle;
  const items = Array.isArray(cycle.subscription_cycle_items)
    ? cycle.subscription_cycle_items.map((item) => ({
        ...item,
        products: item.products
          ? { ...item.products, slug: titleCaseName(item.products.slug) }
          : item.products,
      }))
    : cycle.subscription_cycle_items;
  return { ...cycle, subscription_cycle_items: items };
};

const fetchSubscriptionPlans = async ({ activeOnly = false } = {}) => {
  const q = activeOnly ? '?active=1' : '';
  const res = await fetch(`/api/subscriptions/plans${q}`);
  return parseJson(res);
};

const createSubscriptionPlan = async (body) => {
  const res = await fetch('/api/subscriptions/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
};

const updateSubscriptionPlan = async (planId, body) => {
  const res = await fetch(`/api/subscriptions/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
};

const deleteSubscriptionPlan = async (planId) => {
  const res = await fetch(`/api/subscriptions/plans/${planId}`, {
    method: 'DELETE',
  });
  return parseJson(res);
};

const fetchSubscriptionSettings = async () => {
  const res = await fetch('/api/subscriptions/settings');
  return parseJson(res);
};

const updateSubscriptionSettings = async (body) => {
  const res = await fetch('/api/subscriptions/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
};

const runSubscriptionCharge = async () => {
  const res = await fetch('/api/subscriptions/admin/run-charge', { method: 'POST' });
  return parseJson(res);
};

const runSubscriptionLock = async () => {
  const res = await fetch('/api/subscriptions/admin/run-lock', { method: 'POST' });
  return parseJson(res);
};

const fetchSubscriptionPlan = async (planId) => {
  const res = await fetch(`/api/subscriptions/plans/${planId}`);
  return parseJson(res);
};

const fetchMySubscriptions = async (userId) => {
  const res = await fetch(`/api/subscriptions/mine/${userId}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });
  const data = await parseJson(res);
  if (!Array.isArray(data)) {
    throw new Error('Subscription request failed');
  }
  return data.map((row) => ({
    ...row,
    cycle: titleCaseCycle(row.cycle),
    edit_cycle: titleCaseCycle(row.edit_cycle),
    this_week_cycle: titleCaseCycle(row.this_week_cycle),
  }));
};

const titleCaseAdminRow = (row) => ({
  ...row,
  cycle: titleCaseCycle(row.cycle),
  this_cycle: titleCaseCycle(row.this_cycle),
  next_cycle: titleCaseCycle(row.next_cycle),
});

const fetchAdminSubscriptions = async () => {
  const res = await fetch('/api/subscriptions/admin');
  const data = await parseJson(res);
  if (Array.isArray(data)) {
    return { meta: {}, subscriptions: data.map(titleCaseAdminRow) };
  }
  const subscriptions = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
  return {
    meta: data?.meta || {},
    subscriptions: subscriptions.map(titleCaseAdminRow),
  };
};

const fetchSubscriptionDates = async () => {
  const res = await fetch('/api/subscriptions/dates');
  return parseJson(res);
};

const startSubscriptionCheckout = async (body) => {
  const res = await fetch('/api/subscriptions/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
};

const fetchSubscriptionSignup = async (sessionId) => {
  const res = await fetch(`/api/subscriptions/signup/${encodeURIComponent(sessionId)}`);
  return parseJson(res);
};

const updateSubscriptionFulfillment = async (userId, subscriptionId, body) => {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/fulfillment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...body }),
  });
  return parseJson(res);
};

const updateSubscriptionItems = async (userId, subscriptionId, meals, addons) => {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/items`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, meals, addons }),
  });
  return parseJson(res);
};

const updateSubscriptionStatus = async (userId, subscriptionId, action) => {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, action }),
  });
  return parseJson(res);
};

const changeSubscriptionPlan = async (userId, subscriptionId, planId) => {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, planId }),
  });
  return parseJson(res);
};

const startCardSetup = async (userId, subscriptionId) => {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/card-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return parseJson(res);
};

const fetchCardSetup = async (sessionId) => {
  const res = await fetch(`/api/subscriptions/card-setup/${encodeURIComponent(sessionId)}`);
  return parseJson(res);
};

const mealsAWeek = (count) => {
  const n = Number(count) || 0;
  return n === 1 ? '1 meal a week' : `${n} meals a week`;
};

/** Pre-tax cents after a first-week promo/referral. Delivery is never passed in. Matches backend floor. */
const applyPromoPercent = (cents, percent) => {
  const raw = Math.max(0, Number(cents) || 0);
  const pct = Number(percent) || 0;
  if (pct <= 0) return raw;
  return Math.floor((raw * (100 - pct)) / 100);
};

/** "Referral (TAYRINE15)" or "Promo (SAVE20)" — same wording as checkout. */
const firstWeekCodeLabel = (code, kind) => {
  const c = String(code || '').toUpperCase();
  if (!c) return '';
  if (kind === 'promo') return `Promo (${c})`;
  if (kind === 'referral') return `Referral (${c})`;
  return c;
};

/** "10:00-13:00" -> "10:00 AM – 1:00 PM" */
const formatPickupSlot = (slot) => {
  const parts = String(slot || '').split('-');
  if (parts.length !== 2 || String(slot).includes('AM') || String(slot).includes('PM')) {
    return String(slot || '').trim();
  }
  const fmt = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    if (!Number.isFinite(h)) return hhmm;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = ((h + 11) % 12) + 1;
    const min = Number.isFinite(m) ? String(m).padStart(2, '0') : '00';
    return `${hour12}:${min} ${period}`;
  };
  return `${fmt(parts[0].trim())} – ${fmt(parts[1].trim())}`;
};

const ET = { timeZone: 'America/Toronto' };

const formatCutoffShort = (iso) => {
  if (!iso) return MEAL_LOCK_BY;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return MEAL_LOCK_BY;
  const label = d.toLocaleString('en-US', {
    ...ET,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${label.replace(/, (\d)/, ' · $1')} ET`;
};

/** "Thu 5:00 PM ET" — weekday + time, no calendar date. */
const formatCutoffWeekdayTime = (iso, fallback = MEAL_LOCK_BY) => {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  const weekday = d.toLocaleString('en-US', { ...ET, weekday: 'short' });
  const time = d.toLocaleString('en-US', { ...ET, hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${time} ET`;
};

/** "Sunday, September 20" -> "September 20" when the sentence already says Sunday. */
const sundayDatePart = (label) => {
  const raw = String(label || '').trim();
  const stripped = raw.replace(/^Sunday,\s*/i, '').trim();
  return stripped || raw || 'this week';
};

const weekSaveCopy = (week, {
  deliveryFeeCents = 0,
  switchingToDelivery = false,
  lockedPriorCycle = false,
} = {}) => {
  const sunday = week?.delivery_label || 'Sunday';
  const sundayDate = sundayDatePart(sunday);
  const cutoff = week?.cutoff_label || MEAL_LOCK_BY;
  const nextWeek = Boolean(lockedPriorCycle);
  const fee = Number(deliveryFeeCents) || 0;
  const feeLine = switchingToDelivery && fee > 0
    ? nextWeek
      ? ` Delivery (${formatPlanPrice(fee)} plus 13% HST) will be added to next week's total.`
      : ` Delivery for this Sunday is ${formatPlanPrice(fee)} plus 13% HST and will be charged to your card on file.`
    : '';
  if (nextWeek) {
    return {
      title: 'These changes are for next week',
      body: `This week's cutoff has passed, so these changes apply to next Sunday, ${sundayDate} only. This Sunday's box is already locked.${feeLine} If you need a delivery change for this Sunday, email hello@earthtableco.ca.`,
    };
  }
  return {
    title: 'These changes are for this Sunday',
    body: `These changes apply to this Sunday, ${sundayDate}. You can keep editing until ${cutoff}.${feeLine}`,
  };
};

const formatPlanPrice = (cents) => {
  const n = Number(cents) || 0;
  return `$${(n / 100).toFixed(2)}`;
};

const dollarsToCents = (value) => {
  const n = Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100);
};

const centsToDollarInput = (cents) => {
  if (cents == null || cents === '') return '';
  return (Number(cents) / 100).toFixed(2);
};

/** datetime-local value from an ISO timestamp, in the browser's local zone. */
const toDatetimeLocalValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export {
  fetchSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  fetchSubscriptionSettings,
  updateSubscriptionSettings,
  runSubscriptionCharge,
  runSubscriptionLock,
  fetchSubscriptionPlan,
  fetchMySubscriptions,
  fetchAdminSubscriptions,
  fetchSubscriptionDates,
  startSubscriptionCheckout,
  fetchSubscriptionSignup,
  updateSubscriptionFulfillment,
  updateSubscriptionItems,
  updateSubscriptionStatus,
  changeSubscriptionPlan,
  startCardSetup,
  fetchCardSetup,
  mealsAWeek,
  applyPromoPercent,
  firstWeekCodeLabel,
  titleCaseName,
  formatPickupSlot,
  formatCutoffShort,
  formatCutoffWeekdayTime,
  weekSaveCopy,
  sundayDatePart,
  formatPlanPrice,
  dollarsToCents,
  centsToDollarInput,
  toDatetimeLocalValue,
};

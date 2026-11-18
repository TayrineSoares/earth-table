import { MEAL_LOCK_BY } from './subscriptionCadence'
import { authFetch, authHeaders } from './authFetch'

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
  const res = activeOnly
    ? await fetch(`/api/subscriptions/plans${q}`)
    : await authFetch(`/api/subscriptions/plans${q}`);
  return parseJson(res);
};

const createSubscriptionPlan = async (body) => {
  const res = await authFetch('/api/subscriptions/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
};

const updateSubscriptionPlan = async (planId, body) => {
  const res = await authFetch(`/api/subscriptions/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
};

const discontinueSubscriptionPlan = async (planId) => {
  const res = await authFetch(`/api/subscriptions/plans/${planId}/discontinue`, {
    method: 'POST',
  });
  return parseJson(res);
};

const fetchSubscriptionSettings = async () => {
  const res = await authFetch('/api/subscriptions/settings');
  return parseJson(res);
};

const updateSubscriptionSettings = async (body) => {
  const res = await authFetch('/api/subscriptions/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
};

const runSubscriptionCharge = async () => {
  const headers = await authHeaders();
  const res = await fetch('/api/subscriptions/admin/run-charge', { method: 'POST', headers });
  return parseJson(res);
};

const runSubscriptionLock = async () => {
  const headers = await authHeaders();
  const res = await fetch('/api/subscriptions/admin/run-lock', { method: 'POST', headers });
  return parseJson(res);
};

/** TEMP one-off: corrected owner kitchen list email (no lock / no customer mail). */
const resendOwnerLockEmail = async () => {
  const headers = await authHeaders();
  const res = await fetch('/api/subscriptions/admin/resend-owner-lock', {
    method: 'POST',
    headers,
  });
  return parseJson(res);
};

const fetchSubscriptionPlan = async (planId) => {
  const res = await fetch(`/api/subscriptions/plans/${planId}`);
  return parseJson(res);
};

const fetchMySubscriptions = async () => {
  const res = await authFetch('/api/subscriptions/mine', {
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
    next_box_cycle: titleCaseCycle(row.next_box_cycle),
  }));
};

const titleCaseAdminRow = (row) => ({
  ...row,
  cycle: titleCaseCycle(row.cycle),
  this_cycle: titleCaseCycle(row.this_cycle),
  next_cycle: titleCaseCycle(row.next_cycle),
});

const fetchAdminSubscriptions = async () => {
  const res = await authFetch('/api/subscriptions/admin');
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
  const { userId: _ignored, ...rest } = body || {};
  const res = await authFetch('/api/subscriptions/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rest),
  });
  return parseJson(res);
};

const fetchSubscriptionSignup = async (sessionId) => {
  const res = await fetch(`/api/subscriptions/signup/${encodeURIComponent(sessionId)}`);
  return parseJson(res);
};

const updateSubscriptionFulfillment = async (subscriptionId, body) => {
  const res = await authFetch(`/api/subscriptions/${subscriptionId}/fulfillment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return parseJson(res);
};

const updateSubscriptionItems = async (subscriptionId, meals, addons) => {
  const res = await authFetch(`/api/subscriptions/${subscriptionId}/items`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meals, addons }),
  });
  return parseJson(res);
};

const updateSubscriptionStatus = async (subscriptionId, action) => {
  const res = await authFetch(`/api/subscriptions/${subscriptionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return parseJson(res);
};

const changeSubscriptionPlan = async (subscriptionId, planId, { meals, addons } = {}) => {
  const res = await authFetch(`/api/subscriptions/${subscriptionId}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, meals, addons }),
  });
  return parseJson(res);
};

const startCardSetup = async (subscriptionId) => {
  const res = await authFetch(`/api/subscriptions/${subscriptionId}/card-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
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

/** "Sunday, September 20" -> "September 20" when the sentence already says Sunday. */
const sundayDatePart = (label) => {
  const raw = String(label || '').trim();
  const stripped = raw.replace(/^Sunday,\s*/i, '').trim();
  return stripped || raw || 'this week';
};

/** Prefer YMD so "next Sunday, November 30" cannot drift from a stale label. */
const sundayDateFromWeek = (week) => {
  const ymd = week?.delivery_date;
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (y && m && d) {
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
  }
  return sundayDatePart(week?.delivery_label || 'Sunday');
};

const weekSaveCopy = (week, {
  deliveryFeeCents = 0,
  switchingToDelivery = false,
  switchingToPickup = false,
  lockedPriorCycle = false,
  planAlreadyPaid = false,
} = {}) => {
  const sundayDate = sundayDateFromWeek(week);
  const cutoff = week?.cutoff_label || MEAL_LOCK_BY;
  const nextWeek = Boolean(lockedPriorCycle);
  const fee = Number(deliveryFeeCents) || 0;
  const feeLine = switchingToDelivery && fee > 0
    ? nextWeek
      ? ` Delivery (${formatPlanPrice(fee)} plus 13% HST) will be charged with that week's Tuesday plan charge. Questions? Email hello@earthtableco.ca.`
      : planAlreadyPaid
        ? ` This Sunday's plan is already charged, so delivery (${formatPlanPrice(fee)} plus 13% HST) will be charged to your card now. Questions? Email hello@earthtableco.ca.`
        : ` Delivery (${formatPlanPrice(fee)} plus 13% HST) will be charged with your plan on Tuesday at 9:00 AM ET. Switch back to pickup before then if you change your mind. Questions? Email hello@earthtableco.ca.`
    : switchingToPickup && planAlreadyPaid && !nextWeek
      ? ' If the delivery fee was already charged for this Sunday, email hello@earthtableco.ca to ask about a refund of the delivery fee only.'
      : '';
  if (nextWeek) {
    return {
      title: 'These changes are for next week',
      body: `This week's cutoff has passed, so these changes apply to next Sunday, ${sundayDate} only. This Sunday's box is already locked.${feeLine}`,
    };
  }
  return {
    title: 'These changes are for this Sunday',
    body: `These changes apply to this Sunday, ${sundayDate}. You can swap meals and add extras until ${cutoff}.${feeLine}`,
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
  discontinueSubscriptionPlan,
  fetchSubscriptionSettings,
  updateSubscriptionSettings,
  runSubscriptionCharge,
  runSubscriptionLock,
  resendOwnerLockEmail,
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
  weekSaveCopy,
  sundayDatePart,
  formatPlanPrice,
  dollarsToCents,
  centsToDollarInput,
  toDatetimeLocalValue,
};

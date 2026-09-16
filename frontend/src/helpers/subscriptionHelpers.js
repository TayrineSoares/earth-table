async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Subscription request failed');
  }
  return data;
}

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

const fetchSubscriptionPlan = async (planId) => {
  const res = await fetch(`/api/subscriptions/plans/${planId}`);
  return parseJson(res);
};

const fetchMySubscriptions = async (userId) => {
  const res = await fetch(`/api/subscriptions/mine/${userId}`);
  return parseJson(res);
};

const fetchAdminSubscriptions = async () => {
  const res = await fetch('/api/subscriptions/admin');
  return parseJson(res);
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

const updateSubscriptionMeals = async (userId, subscriptionId, meals) => {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/meals`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, meals }),
  });
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

const updateSubscriptionAddons = async (userId, subscriptionId, addons) => {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/addons`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, addons }),
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

const mealsAWeek = (count) => {
  const n = Number(count) || 0;
  return n === 1 ? '1 meal a week' : `${n} meals a week`;
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

const formatCutoffShort = (iso) => {
  if (!iso) return 'Thu · 5:00 PM ET';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Thu · 5:00 PM ET';
  const label = d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${label.replace(/, (\d)/, ' · $1')} ET`;
};

/** "Sunday, September 20" -> "September 20" when the sentence already says Sunday. */
const sundayDatePart = (label) => {
  const raw = String(label || '').trim();
  const stripped = raw.replace(/^Sunday,\s*/i, '').trim();
  return stripped || raw || 'this week';
};

const weekSaveCopy = (week, { deliveryFeeCents = 0, switchingToDelivery = false } = {}) => {
  const sunday = week?.delivery_label || 'Sunday';
  const sundayDate = sundayDatePart(sunday);
  const cutoff = week?.cutoff_label || 'Thursday at 5:00 PM ET';
  const nextWeek = week?.applies_to === 'next_week' || week?.cutoff_passed;
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
  fetchSubscriptionPlan,
  fetchMySubscriptions,
  fetchAdminSubscriptions,
  fetchSubscriptionDates,
  startSubscriptionCheckout,
  fetchSubscriptionSignup,
  updateSubscriptionMeals,
  updateSubscriptionFulfillment,
  updateSubscriptionAddons,
  updateSubscriptionItems,
  mealsAWeek,
  formatPickupSlot,
  formatCutoffShort,
  weekSaveCopy,
  sundayDatePart,
  formatPlanPrice,
  dollarsToCents,
  centsToDollarInput,
  toDatetimeLocalValue,
};

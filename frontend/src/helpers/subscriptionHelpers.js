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
  fetchSubscriptionDates,
  startSubscriptionCheckout,
  fetchSubscriptionSignup,
  updateSubscriptionMeals,
  updateSubscriptionFulfillment,
  formatPlanPrice,
  dollarsToCents,
  centsToDollarInput,
  toDatetimeLocalValue,
};

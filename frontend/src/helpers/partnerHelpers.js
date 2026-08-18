async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Partner request failed');
  }
  return data;
}

const fetchPartners = async () => {
  const res = await fetch('/api/partners');
  return parseJson(res);
};

const fetchPartnerDetail = async (partnerId) => {
  const res = await fetch(`/api/partners/${partnerId}`);
  return parseJson(res);
};

const createPartner = async ({ user_id, referral_code }) => {
  const res = await fetch('/api/partners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, referral_code }),
  });
  return parseJson(res);
};

const setPartnerActive = async (partnerId, active) => {
  const res = await fetch(`/api/partners/${partnerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: !!active }),
  });
  return parseJson(res);
};

const updatePartnerCode = async (partnerId, referralCode) => {
  const res = await fetch(`/api/partners/${partnerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referral_code: referralCode }),
  });
  return parseJson(res);
};

const setPayoutPreference = async (authUserId, payoutType) => {
  if (!authUserId) throw new Error('authUserId is required');

  const res = await fetch(`/api/partners/by-user/${authUserId}/payout-preference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payout_type: payoutType }),
  });
  return parseJson(res);
};

const formatCents = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

const formatPayoutLabel = (type) => (type === 'credit' ? 'Store credit' : 'Cash');

const invoiceCashCents = (invoice) => {
  if (!invoice) return 0;
  if (invoice.cash_cents != null && invoice.cash_cents !== '') {
    return Math.max(0, Number(invoice.cash_cents) || 0);
  }
  if (invoice.payout_type === 'cash') return Math.max(0, Number(invoice.total_cents) || 0);
  return 0;
};

const invoiceCreditCents = (invoice) => {
  if (!invoice) return 0;
  if (invoice.credit_cents != null && invoice.credit_cents !== '') {
    return Math.max(0, Number(invoice.credit_cents) || 0);
  }
  if (invoice.payout_type === 'credit') return Math.max(0, Number(invoice.total_cents) || 0);
  return 0;
};

const formatInvoiceSummary = (invoice, statusLabel) => {
  if (!invoice) return 'None yet (settles at month-end)';
  const cash = invoiceCashCents(invoice);
  const credit = invoiceCreditCents(invoice);
  const parts = [];
  if (cash > 0) {
    parts.push(`Cash ${formatCents(cash)}${statusLabel ? ` (${statusLabel(invoice.status)})` : ''}`);
  }
  if (credit > 0) parts.push(`Store credit ${formatCents(credit)}`);
  if (!parts.length && invoice.total_cents) {
    return `${formatCents(invoice.total_cents)}${statusLabel ? ` (${statusLabel(invoice.status)})` : ''}`;
  }
  return parts.join(' · ');
};

const formatYmd = (ymd) => {
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(ymd);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatOrderDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export {
  fetchPartners,
  fetchPartnerDetail,
  createPartner,
  setPartnerActive,
  updatePartnerCode,
  setPayoutPreference,
  formatCents,
  formatPayoutLabel,
  formatInvoiceSummary,
  formatOrderDate,
  formatYmd,
};

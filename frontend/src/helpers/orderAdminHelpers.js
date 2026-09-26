const TORONTO_TZ = 'America/Toronto';

/** Calendar YYYY-MM-DD in America/Toronto (ignores clock time). */
export const todayYmdToronto = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

export const getOrderDueYmd = (order) => {
  const raw = order?.delivery ? order.delivery_date : order.pickup_date;
  if (!raw) return null;
  const ymd = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
};

export const isDueToday = (order, todayYmd = todayYmdToronto()) => {
  const due = getOrderDueYmd(order);
  return Boolean(due && due === todayYmd);
};

/** Upcoming = due today or later. Past = due before today, or missing due date. */
export const isUpcomingOrder = (order, todayYmd = todayYmdToronto()) => {
  const due = getOrderDueYmd(order);
  if (!due) return false;
  return due >= todayYmd;
};

export const defaultSortDirForView = (view) => (view === 'past' ? 'desc' : 'asc');

export const countOrdersByView = (orders, todayYmd = todayYmdToronto()) => {
  let upcoming = 0;
  let past = 0;
  for (const order of orders || []) {
    if (isUpcomingOrder(order, todayYmd)) upcoming += 1;
    else past += 1;
  }
  return { upcoming, past };
};

const compareDue = (a, b) => {
  const dueA = getOrderDueYmd(a);
  const dueB = getOrderDueYmd(b);
  if (!dueA && !dueB) return 0;
  if (!dueA) return 1;
  if (!dueB) return -1;
  return dueA.localeCompare(dueB);
};

const comparePlaced = (a, b) =>
  String(a.created_at || '').localeCompare(String(b.created_at || ''));

const comparePrimary = (a, b, sortKey) => {
  if (sortKey === 'fulfilment') {
    // Asc: deliveries first
    const fa = a.delivery ? 0 : 1;
    const fb = b.delivery ? 0 : 1;
    return fa - fb;
  }
  if (sortKey === 'note') {
    // Asc: orders with notes first
    const na = String(a.special_note || '').trim() ? 0 : 1;
    const nb = String(b.special_note || '').trim() ? 0 : 1;
    return na - nb;
  }
  // due (default)
  return compareDue(a, b);
};

/**
 * Filter to upcoming|past and sort by sortKey ('due' | 'fulfilment' | 'note').
 * Missing due dates always sort to the end for due comparisons.
 * Ties break on due date, then placed at.
 */
export const splitAndSortOrders = (
  orders,
  view,
  sortDir,
  sortKey = 'due',
  todayYmd = todayYmdToronto()
) => {
  const wantUpcoming = view !== 'past';
  const dir = sortDir === 'desc' ? -1 : 1;
  const key = sortKey === 'fulfilment' || sortKey === 'note' ? sortKey : 'due';

  const filtered = (orders || []).filter((order) => {
    const upcoming = isUpcomingOrder(order, todayYmd);
    return wantUpcoming ? upcoming : !upcoming;
  });

  return [...filtered].sort((a, b) => {
    const primary = comparePrimary(a, b, key);
    if (primary !== 0) return primary * dir;

    const byDue = compareDue(a, b);
    if (byDue !== 0) return byDue;

    return comparePlaced(a, b);
  });
};

/** Due date: "Sep 26, 2026" */
export const formatDueShort = (ymd) => {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/** Placed: "Sep 16 · 2:46 PM" (year only if not current year) */
export const formatPlacedShort = (isoString, now = new Date()) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === now.getFullYear();
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
};

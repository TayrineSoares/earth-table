import { Fragment, useEffect, useMemo, useState } from 'react';
import AdminTabLoading from './AdminTabLoading';
import AdminToolbar from './admin/AdminToolbar';
import AdminButton from './admin/AdminButton';
import Badge from './admin/Badge';
import {
  fetchAdminSubscriptions,
  formatPickupSlot,
  formatPlanPrice,
  sundayDatePart,
} from '../helpers/subscriptionHelpers';
import { DELIVERY_WINDOW, PICKUP_ADDRESS, setOrderPickedUp } from '../helpers/orderHelpers';
import { formatDueShort } from '../helpers/orderAdminHelpers';
import '../styles/PromoAdmin.css';
import '../styles/SubscriptionAdmin.css';
import '../styles/AdminShared.css';
import '../styles/OrderAdmin.css';

const formatPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(phone || '').trim() || '—';
};

const formatMd = (ymd, fallback) => {
  if (!ymd) return sundayDatePart(fallback) || '—';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return sundayDatePart(fallback) || '—';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const patchKitchen = (kitchen, orderId, pickedUp) => {
  if (!kitchen || kitchen.id !== orderId) return kitchen;
  return { ...kitchen, picked_up: pickedUp };
};

const customerName = (customer) => {
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim();
  return name || customer?.email || 'Customer';
};

const subscriptionNote = (row) => String(row?.special_note || '').trim();

const cycleNote = (row, cycle) => String(cycle?.special_note || row?.special_note || '').trim();

const statusLabel = (row) => {
  if (row.status === 'paused' && row.pause_reason === 'payment_failed') return 'Payment failed';
  if (row.status === 'paused') return 'Paused';
  if (row.status === 'cancelled' && row.cancelled_reason === 'plan_discontinued') {
    return 'Plan discontinued';
  }
  if (row.status === 'cancelled') return 'Cancelled';
  return 'Active';
};

const statusBadgeTone = (label) => (label === 'Active' ? 'success' : 'muted');

const mealLabel = (count) => {
  const n = Number(count) || 0;
  return `${n} ${n === 1 ? 'meal' : 'meals'}`;
};

const fulfillmentParts = (cycle) => {
  if (!cycle || (!cycle.delivery_date && !cycle.pickup_date && cycle.delivery == null)) {
    return { kind: null, meta: '' };
  }
  if (cycle.delivery) {
    return {
      kind: 'Delivery',
      meta: DELIVERY_WINDOW || '',
    };
  }
  const slot = formatPickupSlot(cycle.pickup_time_slot);
  return { kind: 'Pickup', meta: slot || '' };
};

const cycleItems = (cycle) => (
  Array.isArray(cycle?.subscription_cycle_items) ? cycle.subscription_cycle_items : []
);

const itemLine = (item, fallback) => (
  `${item.products?.slug || fallback} x ${Number(item.quantity) || 1}`
);

const splitWindow = (delivery, pickupSlot) => {
  const raw = delivery ? DELIVERY_WINDOW : formatPickupSlot(pickupSlot);
  const parts = String(raw || '').split(/\s*[–-]\s*/);
  return {
    start: (parts[0] || '').trim() || '—',
    end: (parts.slice(1).join(' – ') || '').trim() || '—',
  };
};

const planLines = (plans) => {
  const byKey = new Map();
  for (const row of plans) {
    const meal = Number(row.subscription_plans?.meal_count) || 0;
    const price = Number(row.subscription_plans?.price_cents) || 0;
    const key = `${meal}-${price}`;
    const current = byKey.get(key) || { meal, price, qty: 0 };
    current.qty += 1;
    byKey.set(key, current);
  }
  return [...byKey.values()];
};

const cycleIsClosed = (cycle) => {
  const status = cycle?.status;
  return status === 'locked' || status === 'skipped';
};

// A pause or cancel after the box is committed does not pull it off this Sunday.
// Skipped weeks stay off the kitchen list. Later unpaid weeks on a paused plan stay off too.
const receivesSundayBox = (row, cycle) => {
  if (!cycle || cycle.status === 'skipped') return false;
  if (row?.status === 'active') return true;
  if (cycle.status === 'locked') return true;
  return Number(cycle.plan_paid_cents) > 0;
};

const cycleForRow = (row, view) => {
  if (view === 'paused') return row.cycle || row.this_cycle || row.next_cycle || null;
  return view === 'next' ? (row.next_cycle || null) : (row.this_cycle || null);
};

const kitchenForRow = (row, view) => {
  if (view === 'paused') return row.kitchen || row.this_kitchen || row.next_kitchen || null;
  return view === 'next' ? (row.next_kitchen || null) : (row.this_kitchen || null);
};

const matchesSearch = (row, term) => {
  if (!term) return true;
  const customer = row.customer || {};
  const plan = row.subscription_plans || {};
  const hay = [
    customer.first_name,
    customer.last_name,
    customer.email,
    customer.phone_number,
    plan.name,
    row.status,
    statusLabel(row),
    row.id,
    row.special_note,
  ].join(' ').toLowerCase();
  return hay.includes(term);
};

const toPrintBoxes = (weekRows, cycleKey) => {
  const boxes = weekRows.map((row) => {
    const cycle = row[cycleKey] || {};
    const items = cycleItems(cycle);
    const win = splitWindow(!!cycle.delivery, cycle.pickup_time_slot);
    const customer = row.customer || {};
    return {
      id: row.id,
      name: customerName(customer),
      mealCount: Number(row.subscription_plans?.meal_count) || 0,
      delivery: !!cycle.delivery,
      method: cycle.delivery ? 'Delivery' : 'Pickup',
      windowStart: win.start,
      windowEnd: win.end,
      address: cycle.delivery
        ? (cycle.special_note || cycle.delivery_postal_code || '—')
        : PICKUP_ADDRESS,
      phone: formatPhone(customer.phone_number),
      email: customer.email || '—',
      notes: cycleNote(row, cycle),
      orderId: cycle.order_id || null,
      meals: items.filter((item) => item.kind === 'plan'),
      extras: items.filter((item) => item.kind === 'addon'),
    };
  });
  return [...boxes.filter((row) => !row.delivery), ...boxes.filter((row) => row.delivery)];
};

const SubscriberAdmin = () => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [view, setView] = useState('this');

  const handlePickedUp = async (orderId, next) => {
    setRows((prev) => prev.map((row) => ({
      ...row,
      kitchen: patchKitchen(row.kitchen, orderId, next),
      this_kitchen: patchKitchen(row.this_kitchen, orderId, next),
      next_kitchen: patchKitchen(row.next_kitchen, orderId, next),
    })));
    try {
      await setOrderPickedUp(orderId, next);
    } catch (err) {
      console.error(err);
      setRows((prev) => prev.map((row) => ({
        ...row,
        kitchen: patchKitchen(row.kitchen, orderId, !next),
        this_kitchen: patchKitchen(row.this_kitchen, orderId, !next),
        next_kitchen: patchKitchen(row.next_kitchen, orderId, !next),
      })));
      setError(err.message || 'Could not update picked up.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAdminSubscriptions();
        if (!cancelled) {
          setMeta(data.meta || {});
          setRows(Array.isArray(data.subscriptions) ? data.subscriptions : []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load subscriptions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeRows = useMemo(
    () => rows.filter((row) => row.status === 'active'),
    [rows],
  );
  const thisSundayBoxes = useMemo(
    () => rows.filter((row) => receivesSundayBox(row, row.this_cycle)),
    [rows],
  );
  const nextSundayBoxes = useMemo(
    () => rows.filter((row) => receivesSundayBox(row, row.next_cycle)),
    [rows],
  );

  const sundayView = view === 'next' || view === 'this';
  const totalsWeekRows = view === 'next' ? nextSundayBoxes : thisSundayBoxes;

  const totals = {
    activeCount: activeRows.length,
    weeklyCents: activeRows.reduce(
      (sum, row) => sum + (Number(row.subscription_plans?.price_cents) || 0),
      0,
    ),
    meals: totalsWeekRows.reduce(
      (sum, row) => sum + (Number(row.subscription_plans?.meal_count) || 0),
      0,
    ),
  };

  const visibleRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (view === 'paused') {
        if (row.status === 'active') return false;
      } else {
        const cycle = view === 'next' ? row.next_cycle : row.this_cycle;
        if (!receivesSundayBox(row, cycle)) return false;
      }
      return matchesSearch(row, term);
    });
  }, [rows, searchTerm, view]);

  const groups = useMemo(() => {
    const byUser = new Map();
    for (const row of visibleRows) {
      const key = row.user_id || row.id;
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(row);
    }
    return [...byUser.entries()].map(([userId, plans]) => ({
      userId,
      plans,
      customer: plans[0]?.customer || {},
    }));
  }, [visibleRows]);

  const printBoxes = useMemo(() => (
    view === 'next'
      ? toPrintBoxes(nextSundayBoxes, 'next_cycle')
      : toPrintBoxes(thisSundayBoxes, 'this_cycle')
  ), [view, thisSundayBoxes, nextSundayBoxes]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="promo-admin-container">
        <h1 className="promo-admin-title">Subscriptions</h1>
        <AdminTabLoading message="Loading subscriptions…" />
      </div>
    );
  }

  const cutoffLabel = (
    (view === 'next' ? meta.next_cutoff_label : meta.this_cutoff_label)
    || meta.cutoff_label
    || 'Thursday 5:00 PM'
  );
  const viewedBoxes = view === 'next' ? nextSundayBoxes : thisSundayBoxes;
  const viewedCycles = viewedBoxes
    .map((row) => cycleForRow(row, view))
    .filter(Boolean);
  // Locked only after the Thursday job has closed every box (charge, then status locked).
  const weekLocked = viewedCycles.length > 0 && viewedCycles.every(cycleIsClosed);
  const thisLabel = formatMd(meta.this_sunday, meta.this_sunday_label);
  const nextLabel = formatMd(meta.next_sunday, meta.next_sunday_label);
  const printSunday = view === 'next'
    ? (meta.next_sunday_label || 'Sunday')
    : (meta.this_sunday_label || 'Sunday');
  const pausedCount = rows.filter((row) => row.status !== 'active').length;
  const openTitle = 'Plans are not locked yet';
  const openBody = `Please be mindful that meals and add-ons may still change by ${cutoffLabel}.`;
  const selectView = (next) => {
    setView(next);
    setExpandedId(null);
  };

  return (
    <div className="promo-admin-container sub-admin-panel">
      <div className="sub-admin-screen">
        <h1 className="promo-admin-title">Subscriptions</h1>
        <p className="admin-tab-lead">
          {view === 'paused'
            ? 'Plans that are paused or cancelled. If this Sunday’s box is still going out, it stays on the This Sunday tab.'
            : 'Who’s getting a box, and the meals on it. A paused plan stays here when that Sunday’s box is already going out.'}
        </p>

        <div className="sub-admin-totals">
          <div className="sub-admin-total">
            <span className="sub-admin-total-value">{totals.activeCount}</span>
            <span className="sub-admin-total-label">active subscriptions</span>
          </div>
          <div className="sub-admin-total">
            <span className="sub-admin-total-value">
              {formatPlanPrice(totals.weeklyCents)}
              <span className="sub-admin-total-hst"> + hst</span>
            </span>
            <span className="sub-admin-total-label">total</span>
          </div>
          <div className="sub-admin-total">
            <span className="sub-admin-total-value">{totals.meals}</span>
            <span className="sub-admin-total-label">
              {view === 'next' ? 'meals next Sunday' : 'meals this Sunday'} (not including add-ons)
            </span>
          </div>
        </div>

        <AdminToolbar
          searchValue={searchTerm}
          searchPlaceholder="Search by name, email, phone, or plan"
          searchLabel="Search by name, email, phone, or plan"
          onSearchChange={(e) => setSearchTerm(e.target.value)}
          filtersBelow
          filters={(
            <div className="admin-view-tabs" role="tablist" aria-label="Subscription list">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'this'}
                className={view === 'this' ? 'active' : ''}
                onClick={() => selectView('this')}
              >
                This Sunday, {thisLabel}
                <span className="admin-view-tab-count">{thisSundayBoxes.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'next'}
                className={view === 'next' ? 'active' : ''}
                onClick={() => selectView('next')}
              >
                Next Sunday, {nextLabel}
                <span className="admin-view-tab-count">{nextSundayBoxes.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'paused'}
                className={view === 'paused' ? 'active' : ''}
                onClick={() => selectView('paused')}
              >
                Paused & cancelled
                <span className="admin-view-tab-count">{pausedCount}</span>
              </button>
            </div>
          )}
          resultLabel={`${groups.length} ${groups.length === 1 ? 'customer' : 'customers'}`}
        />

        {sundayView ? (
          <div className={`sub-admin-banner ${weekLocked ? 'is-locked' : 'is-open'}`} role="status">
              <div className="sub-admin-banner-copy">
                {weekLocked ? (
                  <>
                    <p className="sub-admin-banner-title">
                      {view === 'next' ? 'Next week is locked' : 'This week is locked'}
                    </p>
                    <p className="sub-admin-banner-text">
                      {view === 'next'
                        ? 'Meals and add-ons are final for next week.'
                        : 'Meals and add-ons are final for this week.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="sub-admin-banner-title">{openTitle}</p>
                    <p className="sub-admin-banner-text">{openBody}</p>
                  </>
                )}
              </div>
              <button
                type="button"
                className="sub-admin-print-button"
                onClick={handlePrint}
              >
                Print the summary
              </button>
          </div>
        ) : null}

        {error ? <p className="sub-admin-error">{error}</p> : null}

        {groups.length === 0 ? (
          <p className="promo-empty">No subscriptions match.</p>
        ) : (
          <div className="sub-admin-table-wrap order-admin-table-wrap">
            <table className="promo-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Sunday</th>
                  <th>Fulfillment</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const { customer, plans, userId } = group;
                  const isOpen = expandedId === userId;
                  const hasNote = plans.some((row) => subscriptionNote(row));
                  const lines = planLines(plans);
                  const statuses = [...new Set(plans.map(statusLabel))];
                  const cycle = cycleForRow(plans[0], view) || {};
                  const sundayYmd = cycle.delivery_date || cycle.pickup_date;
                  const sunday = formatDueShort(sundayYmd) || '—';
                  const fulfill = fulfillmentParts(cycle);
                  const phone = formatPhone(customer.phone_number);

                  return (
                    <Fragment key={userId}>
                      <tr className={isOpen ? 'order-row-open' : undefined}>
                        <td>
                          <div className="admin-person-cell">
                            <span className="admin-person-name">
                              {customerName(customer)}
                              {hasNote ? (
                                <>
                                  {' '}
                                  <Badge tone="accent">Has note</Badge>
                                </>
                              ) : null}
                            </span>
                            {customer.email ? (
                              <span className="admin-person-email">{customer.email}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {plans.length > 1 ? (
                            <>
                              <div>{plans.length} plans:</div>
                              {lines.map((line) => (
                                <div key={`${line.meal}-${line.price}`} className="sub-admin-plan-line">
                                  <div>{mealLabel(line.meal)} x {line.qty}</div>
                                  <div className="sub-admin-muted">{formatPlanPrice(line.price)}</div>
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              {mealLabel(plans[0].subscription_plans?.meal_count)}
                              <div className="sub-admin-muted">
                                {formatPlanPrice(plans[0].subscription_plans?.price_cents)}
                              </div>
                            </>
                          )}
                        </td>
                        <td>
                          <div className="admin-fulfillment-cell">
                            {statuses.map((label) => (
                              <Badge key={label} tone={statusBadgeTone(label)}>{label}</Badge>
                            ))}
                          </div>
                          {plans.map((row) => (
                            row.pending_status ? (
                              <div key={`${row.id}-pending`} className="sub-admin-muted">
                                pending {row.pending_status}
                                {row.pending_plan ? ` · next: ${mealLabel(row.pending_plan.meal_count)}` : ''}
                              </div>
                            ) : null
                          ))}
                        </td>
                        <td>{sunday}</td>
                        <td>
                          {fulfill.kind ? (
                            <div className="admin-fulfillment-cell">
                              <Badge tone={fulfill.kind === 'Delivery' ? 'delivery' : 'pickup'}>
                                {fulfill.kind}
                              </Badge>
                              {fulfill.meta ? (
                                <span className="admin-fulfillment-meta">
                                  {fulfill.kind} · {fulfill.meta}
                                </span>
                              ) : null}
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          <AdminButton
                            variant="secondary"
                            size="sm"
                            className={isOpen ? 'view-items-button is-open' : 'view-items-button'}
                            onClick={() => setExpandedId(isOpen ? null : userId)}
                          >
                            {isOpen ? 'Hide' : 'View Details'}
                          </AdminButton>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="order-admin-details-row">
                          <td colSpan={6}>
                            <div className="order-details-sticky">
                              <div className="order-details-grid">
                                <section className="order-details-col">
                                  <h3 className="order-details-col-title">Customer</h3>
                                  <p className="order-details-name">{customerName(customer)}</p>
                                  {customer.email ? (
                                    <a className="order-details-link" href={`mailto:${customer.email}`}>
                                      {customer.email}
                                    </a>
                                  ) : null}
                                  {phone && phone !== '—' ? (
                                    <a className="order-details-link" href={`tel:${String(customer.phone_number || '').replace(/\D/g, '')}`}>
                                      {phone}
                                    </a>
                                  ) : null}
                                </section>
                                <section className="order-details-col" style={{ gridColumn: 'span 2' }}>
                                  {plans.map((row) => {
                                    const planCycle = cycleForRow(row, view) || {};
                                    const items = cycleItems(planCycle);
                                    const meals = items.filter((item) => item.kind === 'plan');
                                    const addons = items.filter((item) => item.kind === 'addon');
                                    const noteText = cycleNote(row, planCycle);
                                    const kitchen = kitchenForRow(row, view);
                                    const mealCount = Number(row.subscription_plans?.meal_count) || 0;
                                    const planFulfill = fulfillmentParts(planCycle);
                                    return (
                                      <div key={row.id} className="sub-admin-plan-block">
                                        {plans.length > 1 ? (
                                          <p className="order-details-col-title">
                                            {mealLabel(mealCount)}
                                            {' · '}
                                            <Badge tone={statusBadgeTone(statusLabel(row))}>{statusLabel(row)}</Badge>
                                            {planFulfill.kind ? (
                                              <>
                                                {' '}
                                                <Badge tone={planFulfill.kind === 'Delivery' ? 'delivery' : 'pickup'}>
                                                  {planFulfill.kind}
                                                </Badge>
                                              </>
                                            ) : null}
                                          </p>
                                        ) : null}
                                        {noteText ? (
                                          <div className="order-details-note">
                                            <div className="order-details-note-label">Special Note</div>
                                            <div className="order-details-note-box">{noteText}</div>
                                          </div>
                                        ) : null}
                                        <p className="order-details-col-title">Meals</p>
                                        {meals.length ? (
                                          <ul>
                                            {meals.map((item) => (
                                              <li key={item.id}>{itemLine(item, 'Meal')}</li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="order-details-muted">No meals picked yet.</p>
                                        )}
                                        <p className="order-details-col-title">Add-ons</p>
                                        {addons.length ? (
                                          <ul>
                                            {addons.map((item) => (
                                              <li key={item.id}>{itemLine(item, 'Add-on')}</li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="order-details-muted">None this week.</p>
                                        )}
                                        {kitchen?.id ? (
                                          <p>
                                            <AdminButton
                                              type="button"
                                              variant="secondary"
                                              size="sm"
                                              onClick={() => handlePickedUp(kitchen.id, !kitchen.picked_up)}
                                            >
                                              {kitchen.picked_up ? 'Delivered ✓' : 'Mark delivered'}
                                            </AdminButton>
                                          </p>
                                        ) : planCycle.status === 'locked' ? (
                                          <p className="order-details-muted">Locked — kitchen order missing.</p>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </section>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sub-admin-print" aria-hidden="true">
        {weekLocked ? null : (
          <div className="sub-admin-print-provisional">
            <p className="sub-admin-print-provisional-title">{openTitle}</p>
            <p className="sub-admin-print-provisional-text">{openBody}</p>
          </div>
        )}
        <p className="sub-admin-print-kicker">Kitchen</p>
        <h1 className="sub-admin-print-title">
          {view === 'next' ? 'Next Sunday' : 'This Sunday'}&apos;s subscriptions — {printSunday}
        </h1>
        <p className="sub-admin-print-intro">
          <strong>{printBoxes.length} plans</strong>
          {' · '}
          {printBoxes.filter((row) => !row.delivery).length} pickup, {printBoxes.filter((row) => row.delivery).length} delivery
        </p>
        {printBoxes.map((row, index) => (
          <div key={row.id} className="sub-admin-print-box">
            <p className="sub-admin-print-name">
              {index + 1}. {row.name} — {row.mealCount} meals
            </p>
            <p>
              {row.method} {printSunday}, {row.windowStart} – {row.windowEnd}
            </p>
            <p className="sub-admin-print-muted">
              {row.phone} · {row.email}{row.orderId ? ` · order #${row.orderId}` : ''}
            </p>
            {row.delivery ? (
              <p><strong>Delivery Address:</strong> {row.address}</p>
            ) : (
              <p>{PICKUP_ADDRESS}</p>
            )}
            <p className={row.notes ? 'sub-admin-print-notes' : undefined}>
              <strong>Notes:</strong> {row.notes || '-'}
            </p>
            <p><strong>Meals</strong></p>
            {row.meals.length ? (
              <ul>
                {row.meals.map((item) => (
                  <li key={item.id}>{itemLine(item, 'Meal')}</li>
                ))}
              </ul>
            ) : (
              <p>-</p>
            )}
            <p><strong>Add-ons</strong></p>
            {row.extras.length ? (
              <ul className="sub-admin-print-extras">
                {row.extras.map((item) => (
                  <li key={item.id}>{itemLine(item, 'Add-on')}</li>
                ))}
              </ul>
            ) : (
              <p className="sub-admin-print-extras">-</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriberAdmin;

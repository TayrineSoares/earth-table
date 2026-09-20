import { Fragment, useEffect, useMemo, useState } from 'react';
import AdminTabLoading from './AdminTabLoading';
import {
  fetchAdminSubscriptions,
  formatPickupSlot,
  formatPlanPrice,
  sundayDatePart,
} from '../helpers/subscriptionHelpers';
import { DELIVERY_WINDOW, PICKUP_ADDRESS, setOrderPickedUp } from '../helpers/orderHelpers';
import '../styles/PromoAdmin.css';
import '../styles/UsersAdmin.css';
import '../styles/SubscriptionAdmin.css';

const formatPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(phone || '').trim() || '—';
};

const formatYmd = (ymd) => {
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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

const customerName = (customer) => {
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim();
  return name || customer?.email || 'Customer';
};

const subscriptionNote = (row) => String(row?.special_note || '').trim();

const cycleNote = (row, cycle) => String(cycle?.special_note || row?.special_note || '').trim();

const statusLabel = (row) => {
  if (row.status === 'paused' && row.pause_reason === 'payment_failed') return 'Payment failed';
  if (row.status === 'paused') return 'Paused';
  if (row.status === 'cancelled') return 'Cancelled';
  return 'Active';
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

const fulfillmentLabel = (cycle) => {
  if (!cycle || (!cycle.delivery_date && !cycle.pickup_date && cycle.delivery == null)) return '—';
  if (cycle.delivery) {
    return `Delivery${cycle.delivery_postal_code ? ` · ${cycle.delivery_postal_code}` : ''}`;
  }
  return `Pickup${cycle.pickup_time_slot ? ` · ${formatPickupSlot(cycle.pickup_time_slot)}` : ''}`;
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

const cycleForRow = (row, statusTab, weekTab) => {
  if (statusTab === 'other') return row.cycle || row.this_cycle || row.next_cycle || null;
  return weekTab === 'next' ? (row.next_cycle || null) : (row.this_cycle || null);
};

const kitchenForRow = (row, statusTab, weekTab) => {
  if (statusTab === 'other') return row.kitchen || row.this_kitchen || row.next_kitchen || null;
  return weekTab === 'next' ? (row.next_kitchen || null) : (row.this_kitchen || null);
};

const fulfillmentForGroup = (plans, statusTab, weekTab) => {
  const methods = [...new Set(plans.map((row) => {
    const cycle = cycleForRow(row, statusTab, weekTab);
    if (!cycle || (cycle.delivery == null && !cycle.delivery_date && !cycle.pickup_date)) return null;
    return cycle.delivery ? 'Delivery' : 'Pickup';
  }).filter(Boolean))];
  if (plans.length === 1) return fulfillmentLabel(cycleForRow(plans[0], statusTab, weekTab) || {});
  return methods.join(' · ') || '—';
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
  const [statusTab, setStatusTab] = useState('active');
  const [weekTab, setWeekTab] = useState('this');

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
  const thisSundayActive = useMemo(
    () => activeRows.filter((row) => row.this_cycle),
    [activeRows],
  );
  const nextSundayActive = useMemo(
    () => activeRows.filter((row) => row.next_cycle),
    [activeRows],
  );

  const totalsWeekRows = statusTab === 'active' && weekTab === 'next'
    ? nextSundayActive
    : thisSundayActive;

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
      if (statusTab === 'active') {
        if (row.status !== 'active') return false;
        if (weekTab === 'next' && !row.next_cycle) return false;
        if (weekTab !== 'next' && !row.this_cycle) return false;
      } else if (row.status === 'active') {
        return false;
      }
      return matchesSearch(row, term);
    });
  }, [rows, searchTerm, statusTab, weekTab]);

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
    weekTab === 'next'
      ? toPrintBoxes(nextSundayActive, 'next_cycle')
      : toPrintBoxes(thisSundayActive, 'this_cycle')
  ), [weekTab, thisSundayActive, nextSundayActive]);

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
    (weekTab === 'next' ? meta.next_cutoff_label : meta.this_cutoff_label)
    || meta.cutoff_label
    || 'Thursday 5:00 PM'
  );
  const viewedActive = weekTab === 'next' ? nextSundayActive : thisSundayActive;
  const viewedCycles = viewedActive
    .map((row) => cycleForRow(row, statusTab, weekTab))
    .filter(Boolean);
  // Banner follows the selected Sunday's cycle rows, not the live/test clock.
  const weekLocked = viewedCycles.length > 0 && viewedCycles.every(cycleIsClosed);
  const thisLabel = formatMd(meta.this_sunday, meta.this_sunday_label);
  const nextLabel = formatMd(meta.next_sunday, meta.next_sunday_label);
  const printSunday = weekTab === 'next'
    ? (meta.next_sunday_label || 'Sunday')
    : (meta.this_sunday_label || 'Sunday');
  const openTitle = 'Plans are not locked yet';
  const openBody = `Please be mindful that meals and add-ons may still change by ${cutoffLabel}.`;
  const otherCount = rows.filter((row) => row.status !== 'active').length;

  return (
    <div className="promo-admin-container sub-admin-panel">
      <div className="sub-admin-screen">
        <div className="sub-admin-head">
          <h1 className="promo-admin-title">Subscriptions</h1>
          <div className="sub-admin-status-tabs" role="tablist" aria-label="Subscription status">
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'active'}
            className={statusTab === 'active' ? 'active' : ''}
            onClick={() => {
              setStatusTab('active');
              setExpandedId(null);
            }}
          >
            Active ({activeRows.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusTab === 'other'}
            className={statusTab === 'other' ? 'active' : ''}
            onClick={() => {
              setStatusTab('other');
              setExpandedId(null);
            }}
          >
            Other ({otherCount})
          </button>
        </div>
        </div>

        {statusTab === 'active' ? (
          <>
            <div className="sub-admin-status-tabs" role="tablist" aria-label="Cook week">
              <button
                type="button"
                role="tab"
                aria-selected={weekTab === 'this'}
                className={weekTab === 'this' ? 'active' : ''}
                onClick={() => {
                  setWeekTab('this');
                  setExpandedId(null);
                }}
              >
                This Sunday, {thisLabel} ({thisSundayActive.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={weekTab === 'next'}
                className={weekTab === 'next' ? 'active' : ''}
                onClick={() => {
                  setWeekTab('next');
                  setExpandedId(null);
                }}
              >
                Next Sunday, {nextLabel} ({nextSundayActive.length})
              </button>
            </div>

            <div className={`sub-admin-banner ${weekLocked ? 'is-locked' : 'is-open'}`} role="status">
              <div className="sub-admin-banner-copy">
                {weekLocked ? (
                  <>
                    <p className="sub-admin-banner-title">
                      {weekTab === 'next' ? 'Next week is locked' : 'This week is locked'}
                    </p>
                    <p className="sub-admin-banner-text">
                      {weekTab === 'next'
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
          </>
        ) : null}

        {error ? <p className="sub-admin-error">{error}</p> : null}

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
            <span className="sub-admin-total-label">meals this week (not including add-ons)</span>
          </div>
        </div>

        <input
          className="user-search-input"
          type="text"
          placeholder="Search by name, email, phone, or plan"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {groups.length === 0 ? (
          <p className="promo-empty">No subscriptions match.</p>
        ) : (
          <div className="sub-admin-table-wrap">
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
                  const cycle = cycleForRow(plans[0], statusTab, weekTab) || {};
                  const sunday = formatYmd(cycle.delivery_date || cycle.pickup_date);
                  const fulfillment = fulfillmentForGroup(plans, statusTab, weekTab);

                  return (
                    <Fragment key={userId}>
                      <tr>
                        <td>
                          <div className="sub-admin-customer-name">
                            <span>{customerName(customer)}</span>
                            {hasNote ? <span className="sub-admin-note-chip">Note</span> : null}
                          </div>
                          <div className="sub-admin-muted">{customer.email || '—'}</div>
                          <div className="sub-admin-muted">{formatPhone(customer.phone_number)}</div>
                        </td>
                        <td>
                          {plans.length > 1 ? (
                            <>
                              <div>{plans.length} plans:</div>
                              {lines.map((line) => (
                                <div key={`${line.meal}-${line.price}`} className="sub-admin-plan-line">
                                  <div>{line.meal} meals x {line.qty}</div>
                                  <div className="sub-admin-muted">{formatPlanPrice(line.price)}</div>
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              {`${Number(plans[0].subscription_plans?.meal_count) || 0} meals`}
                              <div className="sub-admin-muted">
                                {formatPlanPrice(plans[0].subscription_plans?.price_cents)}
                              </div>
                            </>
                          )}
                        </td>
                        <td>
                          {statuses.join(', ')}
                          {plans.map((row) => (
                            row.pending_status ? (
                              <div key={`${row.id}-pending`} className="sub-admin-muted">
                                pending {row.pending_status}
                                {row.pending_plan ? ` · next: ${Number(row.pending_plan.meal_count) || 0} meals` : ''}
                              </div>
                            ) : null
                          ))}
                        </td>
                        <td>{sunday}</td>
                        <td>{fulfillment}</td>
                        <td>
                          <button
                            type="button"
                            className="promo-delete-button"
                            onClick={() => setExpandedId(isOpen ? null : userId)}
                          >
                            {isOpen ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr>
                          <td colSpan={6}>
                            <div className="sub-admin-details">
                              {plans.map((row) => {
                                const planCycle = cycleForRow(row, statusTab, weekTab) || {};
                                const items = cycleItems(planCycle);
                                const meals = items.filter((item) => item.kind === 'plan');
                                const addons = items.filter((item) => item.kind === 'addon');
                                const noteText = cycleNote(row, planCycle) || '-';
                                const kitchen = kitchenForRow(row, statusTab, weekTab);
                                const mealCount = Number(row.subscription_plans?.meal_count) || 0;
                                return (
                                  <div key={row.id} className="sub-admin-plan-block">
                                    {plans.length > 1 ? (
                                      <p>
                                        <strong>{mealCount} meals</strong>
                                        {' · '}
                                        {statusLabel(row)}
                                        {' · '}
                                        {fulfillmentLabel(planCycle)}
                                      </p>
                                    ) : null}
                                    <p>
                                      <strong>Notes:</strong>{' '}
                                      <span className={noteText === '-' ? 'sub-admin-muted sub-admin-notes' : 'sub-admin-notes'}>
                                        {noteText}
                                      </span>
                                    </p>
                                    <p><strong>Meals</strong></p>
                                    {meals.length ? (
                                      <ul>
                                        {meals.map((item) => (
                                          <li key={item.id}>{itemLine(item, 'Meal')}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="sub-admin-muted">No meals picked yet.</p>
                                    )}
                                    <p><strong>Add-ons</strong></p>
                                    {addons.length ? (
                                      <ul>
                                        {addons.map((item) => (
                                          <li key={item.id}>{itemLine(item, 'Add-on')}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="sub-admin-muted">None this week.</p>
                                    )}
                                    {kitchen?.id ? (
                                      <p>
                                        <button
                                          type="button"
                                          className="promo-delete-button"
                                          onClick={() => handlePickedUp(kitchen.id, !kitchen.picked_up)}
                                        >
                                          {kitchen.picked_up ? 'Delivered ✓' : 'Mark delivered'}
                                        </button>
                                      </p>
                                    ) : planCycle.status === 'locked' ? (
                                      <p className="sub-admin-muted">Locked — kitchen order missing.</p>
                                    ) : null}
                                  </div>
                                );
                              })}
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
          {weekTab === 'next' ? 'Next Sunday' : 'This Sunday'}&apos;s subscriptions — {printSunday}
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
            <p className="sub-admin-print-muted">{row.phone} · {row.email}</p>
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

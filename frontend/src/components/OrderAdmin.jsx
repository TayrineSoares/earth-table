import { useCallback, useEffect, useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchAllOrders,
  fetchOrderById,
  formatMoney,
  formatTimeWindow,
  getPostalFromBuyerInfo,
  setOrderPickedUp,
} from '../helpers/orderHelpers';
import {
  countOrdersByView,
  defaultSortDirForView,
  formatDueShort,
  formatPlacedShort,
  getOrderBreakdown,
  getOrderDueYmd,
  isDueToday,
  splitAndSortOrders,
} from '../helpers/orderAdminHelpers';
import AdminTabLoading from './AdminTabLoading';
import AdminToolbar from './admin/AdminToolbar';
import AdminButton from './admin/AdminButton';
import Badge from './admin/Badge';
import '../styles/OrderAdmin.css';
import '../styles/AdminShared.css';

const ORDER_COL_COUNT = 10;

const listCustomerName = (order) => String(order?.buyer_name || '').trim() || 'Guest';

const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  const cleaned = String(phone).replace(/\D/g, '');
  const digits = cleaned.length === 11 && cleaned.startsWith('1') ? cleaned.slice(1) : cleaned;
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(phone);
};

const telHref = (phone) => {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.length === 10) return `tel:+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `tel:+${cleaned}`;
  return `tel:+${cleaned}`;
};

const OrderAdmin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Local only — remounting the Orders tab always starts on Upcoming.
  const [view, setViewState] = useState('upcoming');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('due');
  const [sortDir, setSortDir] = useState(() => defaultSortDirForView('upcoming'));

  const loadOrders = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const data = await fetchAllOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const setView = (nextView) => {
    const next = nextView === 'past' ? 'past' : 'upcoming';
    if (next === view) {
      loadOrders();
      return;
    }
    setViewState(next);
    setSortKey('due');
    setSortDir(defaultSortDirForView(next));
    setExpandedOrderId(null);
    setOrderDetails(null);
    loadOrders();
  };

  const handleSort = (column) => {
    if (sortKey === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(column);
    setSortDir('asc');
  };

  const handleTogglePickedUp = async (order) => {
    const next = !order.picked_up;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, picked_up: next } : o)));
    try {
      await setOrderPickedUp(order.id, next);
    } catch (e) {
      console.error(e);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, picked_up: !next } : o)));
      alert('Failed to update picked up status.');
    }
  };

  // Drop leftover ?view= from the URL so Past never sticks across visits.
  useEffect(() => {
    if (!searchParams.has('view')) return;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('view');
      return params;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  // Fresh fetch whenever Orders mounts (including after switching admin tabs).
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const data = await fetchAllOrders();
        if (!cancelled) setOrders(data);
      } catch (err) {
        console.error('Failed to load orders:', err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const toggleDetailedOrder = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      setOrderDetails(null);
      return;
    }
    setExpandedOrderId(orderId);
    setOrderDetails(null);
    setDetailsLoading(true);
    try {
      const fullOrder = await fetchOrderById(orderId);
      setOrderDetails(fullOrder);
    } catch (error) {
      console.error('Failed to load order details:', error);
      setOrderDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    if (!term) return orders;
    return orders.filter((order) => {
      const name = listCustomerName(order).toLowerCase();
      const dueYmd = getOrderDueYmd(order);
      const dueLabel = dueYmd ? formatDueShort(dueYmd).toLowerCase() : '';
      return (
        order.id?.toString().includes(term) ||
        order.buyer_email?.toLowerCase().includes(term) ||
        name.includes(term) ||
        order.status?.toLowerCase().includes(term) ||
        dueLabel.includes(term)
      );
    });
  }, [orders, searchTerm]);

  const { upcoming: upcomingCount, past: pastCount } = useMemo(
    () => countOrdersByView(filteredOrders),
    [filteredOrders]
  );

  const visibleOrders = useMemo(
    () => splitAndSortOrders(filteredOrders, view, sortDir, sortKey),
    [filteredOrders, view, sortDir, sortKey]
  );

  const SortableTh = ({ column, label }) => {
    const active = sortKey === column;
    return (
      <th className={active ? 'is-sorted' : ''}>
        <button
          type="button"
          className={`order-sort-header${active ? ' is-active' : ''}`}
          onClick={() => handleSort(column)}
          aria-label={`Sort by ${label}${active ? (sortDir === 'asc' ? ', ascending' : ', descending') : ''}`}
        >
          {label}
          <span className={`order-sort-arrow${active ? ' is-active' : ''}`} aria-hidden="true">
            {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="order-admin-page">
        <h1>Order Admin</h1>
        <AdminTabLoading message="Loading orders…" />
      </div>
    );
  }

  return (
    <div className="order-admin-page">
      <h1>Order Admin</h1>
      <p className="admin-tab-lead">
        Everyday orders placed on the website (not weekly subscription boxes — those are under Subscriptions).
        Search for a customer or order, open the details, and mark it picked up when it’s ready.
      </p>

      <AdminToolbar
        searchValue={searchTerm}
        searchPlaceholder="Search by id, email, name, status, date or postal"
        searchLabel="Search by id, email, name, status, date or postal"
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        filtersBelow
        filters={(
          <div className="admin-view-tabs" role="tablist" aria-label="Order timing">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'upcoming'}
              className={view === 'upcoming' ? 'active' : ''}
              onClick={() => setView('upcoming')}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'past'}
              className={view === 'past' ? 'active' : ''}
              onClick={() => setView('past')}
            >
              Past ({pastCount})
            </button>
          </div>
        )}
      />

      <div className="order-admin-table-wrap">
        <table className="order-admin-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <SortableTh column="due" label="Due Date" />
              <SortableTh column="fulfilment" label="Fulfilment" />
              <SortableTh column="note" label="Note" />
              <th>Total</th>
              <th>Status</th>
              <th>Placed At</th>
              <th>Actions</th>
              <th>Picked Up / Delivered?</th>
            </tr>
          </thead>

          <tbody>
            {visibleOrders.length === 0 ? (
              <tr>
                <td colSpan={ORDER_COL_COUNT} className="order-admin-empty-cell">
                  {view === 'past' ? 'No past orders' : 'No upcoming orders'}
                </td>
              </tr>
            ) : (
              visibleOrders.map((order) => {
                const isOpen = expandedOrderId === order.id;
                const detailsReady = isOpen && !detailsLoading && orderDetails?.id === order.id;
                const detailOrder = detailsReady ? orderDetails : order;
                const items = detailsReady ? (orderDetails.order_products || []) : [];
                const breakdown = detailsReady ? getOrderBreakdown(detailOrder, items) : null;
                const account = detailsReady ? orderDetails?.user : null;
                const customerName = [account?.first_name, account?.last_name]
                  .filter(Boolean)
                  .join(' ')
                  .trim()
                  || (detailsReady ? orderDetails?.buyer_name : '')
                  || order.buyer_name
                  || '';
                const customerEmail = account?.email
                  || (detailsReady ? orderDetails?.buyer_email : '')
                  || order.buyer_email
                  || '';
                const customerPhoneRaw = account?.phone_number
                  || (detailsReady ? orderDetails?.buyer_phone_number : '')
                  || order.buyer_phone_number
                  || '';
                const customerPhone = formatPhoneDisplay(customerPhoneRaw);
                const phoneLink = telHref(customerPhoneRaw);
                const dueYmd = getOrderDueYmd(order);
                const dueLabel = dueYmd ? formatDueShort(dueYmd) : '—';
                const showToday = view === 'upcoming' && isDueToday(order);
                const hasNote = Boolean(String(order.special_note || '').trim());
                const listName = listCustomerName(order);
                const listEmail = String(order.buyer_email || '').trim();
                const postal = breakdown?.postalCode || getPostalFromBuyerInfo(order.buyer_stripe_payment_info);
                const noteText = String(order.special_note || '').trim();

                return (
                  <Fragment key={order.id}>
                    <tr className={isOpen ? 'order-row-open' : undefined}>
                      <td>{order.id}</td>
                      <td>
                        <div className="order-customer-cell">
                          <span className="order-customer-name">{listName}</span>
                          {listEmail ? (
                            <span className="order-customer-email">{listEmail}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="order-cell-nowrap">
                        <span className="order-due-cell">
                          {dueLabel}
                          {showToday ? <Badge tone="accent">Today</Badge> : null}
                        </span>
                      </td>
                      <td className="order-cell-nowrap">
                        <div className="order-fulfilment-cell">
                          <Badge tone={order.delivery ? 'delivery' : 'pickup'}>
                            {order.delivery ? 'Delivery' : 'Pickup'}
                          </Badge>
                          {order.delivery && postal ? (
                            <span className="order-fulfilment-postal">{postal}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="order-cell-nowrap">
                        {hasNote ? (
                          <Badge tone="accent">Has note</Badge>
                        ) : (
                          <Badge tone="muted">None</Badge>
                        )}
                      </td>
                      <td className="order-cell-nowrap">{formatMoney(order.total_cents)}</td>
                      <td>{order.status}</td>
                      <td className="order-cell-nowrap">{formatPlacedShort(order.created_at) || '—'}</td>
                      <td>
                        <AdminButton
                          variant="secondary"
                          size="sm"
                          className={isOpen ? 'view-items-button is-open' : 'view-items-button'}
                          onClick={() => toggleDetailedOrder(order.id)}
                        >
                          {isOpen ? 'Hide' : 'View Details'}
                        </AdminButton>
                      </td>
                      <td>
                        <button
                          className={`picked-btn ${order.picked_up ? 'is-picked' : ''}`}
                          onClick={() => handleTogglePickedUp(order)}
                          aria-pressed={order.picked_up}
                          title={order.picked_up ? 'Mark as NOT picked up' : 'Mark as picked up'}
                        >
                          {order.picked_up ? 'Delivered ✓' : 'Pending'}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="order-admin-details-row">
                        <td colSpan={ORDER_COL_COUNT}>
                          <div className="order-details-sticky">
                            {detailsLoading || !breakdown ? (
                              <em className="order-details-loading">Loading details…</em>
                            ) : (
                              <div className="order-details-grid">
                                <section className="order-details-col">
                                  <h3 className="order-details-col-title">Customer</h3>
                                  <p className="order-details-name">{customerName || 'Guest'}</p>
                                  <p className="order-details-muted">
                                    {account ? 'Registered customer' : 'Guest checkout'}
                                  </p>
                                  {customerEmail ? (
                                    <a className="order-details-link" href={`mailto:${customerEmail}`}>
                                      {customerEmail}
                                    </a>
                                  ) : (
                                    <p className="order-details-muted">No email</p>
                                  )}
                                  {phoneLink ? (
                                    <a className="order-details-link" href={phoneLink}>
                                      {customerPhone || customerPhoneRaw}
                                    </a>
                                  ) : (
                                    <p className="order-details-muted">No phone</p>
                                  )}
                                  {noteText ? (
                                    <div className="order-details-note">
                                      <span className="order-details-note-label">Special Note</span>
                                      <div className="order-details-note-box">{noteText}</div>
                                    </div>
                                  ) : null}
                                </section>

                                <section className="order-details-col">
                                  <h3 className="order-details-col-title">
                                    Items · {breakdown.totalQty}
                                  </h3>
                                  {breakdown.lines.length ? (
                                    <div className="order-details-items">
                                      {breakdown.lines.map((line, idx) => (
                                        <div
                                          key={line.id || `${line.name}-${idx}`}
                                          className="order-details-item"
                                        >
                                          <span className="order-details-item-qty">{line.quantity}×</span>
                                          <div className="order-details-item-main">
                                            <span className="order-details-item-name">{line.name}</span>
                                            {line.quantity > 1 ? (
                                              <span className="order-details-item-unit">
                                                {formatMoney(line.unitPriceCents)} each
                                              </span>
                                            ) : null}
                                          </div>
                                          <span className="order-details-item-price">
                                            {formatMoney(line.lineTotalCents)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="order-details-muted">No items found for this order.</p>
                                  )}
                                </section>

                                <section className="order-details-col">
                                  <h3 className="order-details-col-title order-details-fulfilment-title">
                                    <span>{order.delivery ? 'Delivery' : 'Pickup'}</span>
                                    <Badge tone={order.delivery ? 'delivery' : 'pickup'}>
                                      {order.delivery ? 'Delivery' : 'Pickup'}
                                    </Badge>
                                  </h3>
                                  {order.delivery ? (
                                    <>
                                      <p className="order-details-body">
                                        Postal code {breakdown.postalCode || '—'}
                                      </p>
                                      <p className="order-details-body">
                                        Due {dueYmd ? formatDueShort(dueYmd) : '—'}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="order-details-body">
                                        Pickup window{' '}
                                        {formatTimeWindow(order.pickup_time_slot) || order.pickup_time_slot || '—'}
                                      </p>
                                      <p className="order-details-body">
                                        Due {dueYmd ? formatDueShort(dueYmd) : '—'}
                                      </p>
                                    </>
                                  )}

                                  <div className="order-details-totals">
                                    <div className="order-details-total-row">
                                      <span>Subtotal</span>
                                      <span>{formatMoney(breakdown.subtotalCents)}</span>
                                    </div>
                                    {breakdown.discountCents > 0 ? (
                                      <div className="order-details-total-row">
                                        <span>
                                          Discount
                                          {breakdown.discount?.code ? ` (${breakdown.discount.code})` : ''}
                                        </span>
                                        <span>−{formatMoney(breakdown.discountCents)}</span>
                                      </div>
                                    ) : null}
                                    {order.delivery && breakdown.deliveryFeeInclHstCents > 0 ? (
                                      <div className="order-details-total-block">
                                        <div className="order-details-total-row">
                                          <span>Delivery fee (incl. HST)</span>
                                          <span>{formatMoney(breakdown.deliveryFeeInclHstCents)}</span>
                                        </div>
                                        <p className="order-details-fee-split">
                                          Pre-tax {formatMoney(breakdown.deliveryPreTaxCents)} · HST (13%){' '}
                                          {formatMoney(breakdown.deliveryHstCents)}
                                        </p>
                                      </div>
                                    ) : null}
                                    {breakdown.foodTaxCents > 0 ? (
                                      <div className="order-details-total-row">
                                        <span>Tax</span>
                                        <span>{formatMoney(breakdown.foodTaxCents)}</span>
                                      </div>
                                    ) : null}
                                    {breakdown.creditCents > 0 ? (
                                      <div className="order-details-total-row">
                                        <span>Store credit</span>
                                        <span>−{formatMoney(breakdown.creditCents)}</span>
                                      </div>
                                    ) : null}
                                    <div className="order-details-total-row order-details-total-row--grand">
                                      <span>Total</span>
                                      <span>{formatMoney(breakdown.tableTotalCents || order.total_cents)}</span>
                                    </div>
                                  </div>
                                </section>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderAdmin;

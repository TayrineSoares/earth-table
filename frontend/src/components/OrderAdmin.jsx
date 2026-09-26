import { useEffect, useState, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchAllOrders,
  fetchOrderById,
  formatTimeWindow,
  setOrderPickedUp,
  titleCaseName,
} from '../helpers/orderHelpers';
import {
  countOrdersByView,
  defaultSortDirForView,
  formatDueShort,
  formatPlacedShort,
  getOrderDueYmd,
  isDueToday,
  splitAndSortOrders,
} from '../helpers/orderAdminHelpers';
import AdminTabLoading from './AdminTabLoading';
import AdminToolbar from './admin/AdminToolbar';
import Badge from './admin/Badge';
import '../styles/OrderAdmin.css';
import '../styles/AdminShared.css';

const HST_RATE = 0.13;

const formatMoney = (cents) => {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
};

const getPostalFromInfo = (buyerStripeInfo) => {
  try {
    const parsed = typeof buyerStripeInfo === 'string' ? JSON.parse(buyerStripeInfo) : (buyerStripeInfo || {});
    return parsed?.delivery_meta?.postal_code || '—';
  } catch {
    return '—';
  }
};

const getDeliveryFeeCents = (buyerStripeInfo) => {
  try {
    const parsed = typeof buyerStripeInfo === 'string' ? JSON.parse(buyerStripeInfo) : (buyerStripeInfo || {});
    const preTax = Number(parsed?.delivery_meta?.fee_cents_server) || 0;
    const withTax = Math.round(preTax * (1 + HST_RATE));
    return { preTaxCents: preTax, withTaxCents: withTax };
  } catch {
    return { preTaxCents: 0, withTaxCents: 0 };
  }
};

const listCustomerName = (order) => String(order?.buyer_name || '').trim() || 'Guest';

const OrderAdmin = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'past' ? 'past' : 'upcoming';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('due');
  const [sortDir, setSortDir] = useState(() => defaultSortDirForView(view));

  const setView = (nextView) => {
    const next = nextView === 'past' ? 'past' : 'upcoming';
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('view', next);
      return params;
    }, { replace: true });
    setSortKey('due');
    setSortDir(defaultSortDirForView(next));
    setExpandedOrderId(null);
    setOrderDetails(null);
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

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
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
    loadOrders();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSortKey('due');
    setSortDir(defaultSortDirForView(view));
  }, [view]);

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

  const formatPhoneNumber = (phone) => {
    if (!phone) return '(not set)';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatStripePhoneNumber = (phone) => {
    if (!phone) return '(not set)';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      const area = cleaned.slice(1, 4);
      const prefix = cleaned.slice(4, 7);
      const line = cleaned.slice(7);
      return `(${area}) ${prefix}-${line}`;
    }
    return `+${cleaned}`;
  };

  const filteredOrders = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    if (!term) return orders;
    return orders.filter((order) => {
      const postal = getPostalFromInfo(order.buyer_stripe_payment_info).toLowerCase();
      const name = listCustomerName(order).toLowerCase();
      const dueYmd = getOrderDueYmd(order);
      const dueLabel = dueYmd ? formatDueShort(dueYmd).toLowerCase() : '';
      return (
        order.id?.toString().includes(term) ||
        order.buyer_email?.toLowerCase().includes(term) ||
        name.includes(term) ||
        order.status?.toLowerCase().includes(term) ||
        postal.includes(term) ||
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

      <table className="order-admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Status</th>
            <th>Placed at</th>
            <SortableTh column="due" label="Due Date" />
            <SortableTh column="fulfilment" label="Fulfilment" />
            <th>Total</th>
            <th>Customer</th>
            <SortableTh column="note" label="Note" />
            <th>Actions</th>
            <th>Picked Up / Delivered?</th>
          </tr>
        </thead>

        <tbody>
          {visibleOrders.length === 0 ? (
            <tr>
              <td colSpan={10} className="order-admin-empty-cell">
                {view === 'past' ? 'No past orders' : 'No upcoming orders'}
              </td>
            </tr>
          ) : (
            visibleOrders.map((order) => {
              const isOpen = expandedOrderId === order.id;
              const detailsReady = isOpen && !detailsLoading && orderDetails?.id === order.id;
              const items = detailsReady ? (orderDetails.order_products || []) : [];
              const postal = getPostalFromInfo(order.buyer_stripe_payment_info);
              const { preTaxCents, withTaxCents } = getDeliveryFeeCents(order.buyer_stripe_payment_info);
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
              const customerPhone = account?.phone_number
                ? formatPhoneNumber(account.phone_number)
                : formatStripePhoneNumber(
                    (detailsReady ? orderDetails?.buyer_phone_number : '')
                    || order.buyer_phone_number
                  );
              const dueYmd = getOrderDueYmd(order);
              const dueLabel = dueYmd ? formatDueShort(dueYmd) : '—';
              const showToday = view === 'upcoming' && isDueToday(order);
              const hasNote = Boolean(String(order.special_note || '').trim());
              const listName = listCustomerName(order);
              const listEmail = String(order.buyer_email || '').trim();

              return (
                <Fragment key={order.id}>
                  <tr>
                    <td>{order.id}</td>
                    <td>{order.status}</td>
                    <td className="order-cell-nowrap">{formatPlacedShort(order.created_at) || '—'}</td>
                    <td className="order-cell-nowrap">
                      <span className="order-due-cell">
                        {dueLabel}
                        {showToday ? <Badge tone="accent">Today</Badge> : null}
                      </span>
                    </td>
                    <td className="order-cell-nowrap">
                      <Badge tone={order.delivery ? 'delivery' : 'pickup'}>
                        {order.delivery ? 'Delivery' : 'Pickup'}
                      </Badge>
                    </td>
                    <td>{formatMoney(order.total_cents)}</td>
                    <td>
                      <div className="order-customer-cell">
                        <span className="order-customer-name">{listName}</span>
                        {listEmail ? (
                          <span className="order-customer-email">{listEmail}</span>
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
                    <td>
                      <button
                        className="view-items-button"
                        onClick={() => toggleDetailedOrder(order.id)}
                      >
                        {isOpen ? 'Hide' : 'View Details'}
                      </button>
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
                      <td colSpan={11}>
                        <div className="order-details-card">
                          <div className="order-admin-buyer">
                            <strong>Customer:</strong>{' '}
                            {customerName || 'Guest'}
                            {detailsReady && !account && (
                              <span style={{ color: '#666' }}> (guest checkout)</span>
                            )}
                            <br />
                            <strong>Email: </strong>{customerEmail || 'No email'}
                            <br />
                            <strong>Phone Number:</strong> {customerPhone || 'No phone'}
                            <br />
                            <strong>Special Note:</strong>{' '}
                            <span style={{ whiteSpace: 'pre-wrap' }}>
                              {order.special_note || ''}
                            </span>
                          </div>

                          {detailsLoading ? (
                            <em>Loading items…</em>
                          ) : items.length ? (
                            <ul className="order-items-list">
                              {items.map((it, idx) => (
                                <li key={it.id || `${it.product_id || 'item'}-${idx}`}>
                                  {it.quantity}× {titleCaseName(it.product?.slug || it.slug || 'Unnamed product')} — {formatMoney(it.unit_price_cents)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <em>No items found for this order.</em>
                          )}

                          {!order.delivery && order.pickup_time_slot && (
                            <div style={{ marginTop: 8 }}>
                              <strong>Pickup time:</strong>{' '}
                              {formatTimeWindow(order.pickup_time_slot) || order.pickup_time_slot}
                            </div>
                          )}

                          {order.delivery && (
                            <>
                              <div style={{ marginTop: 8 }}>
                                <strong>Delivery postal (for quote):</strong> {postal}
                              </div>
                              <div style={{ marginTop: 4 }}>
                                <strong>Delivery fee:</strong> {formatMoney(withTaxCents)}{' '}
                                <span style={{ color: '#666' }}>(incl HST)</span>
                                {preTaxCents > 0 && (
                                  <div style={{ fontSize: 12, color: '#666' }}>
                                    Pre-tax: {formatMoney(preTaxCents)} • HST (13%): {formatMoney(Math.max(withTaxCents - preTaxCents, 0))}
                                  </div>
                                )}
                              </div>
                            </>
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
  );
};

export default OrderAdmin;

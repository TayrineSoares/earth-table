import { useEffect, useState, Fragment } from 'react';
import { fetchAllOrders, fetchOrderById, setOrderPickedUp } from '../helpers/orderHelpers';
import '../styles/OrderAdmin.css';

const HST_RATE = 0.13;

const formatMoney = (cents) => {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
};

// Safely read postal code from buyer_stripe_payment_info JSON
const getPostalFromInfo = (buyerStripeInfo) => {
  try {
    const parsed = typeof buyerStripeInfo === "string" ? JSON.parse(buyerStripeInfo) : (buyerStripeInfo || {});
    return parsed?.delivery_meta?.postal_code || "—";
  } catch {
    return "—";
  }
};

// Safely read delivery fee (server-quoted, pre-tax) from buyer_stripe_payment_info JSON
const getDeliveryFeeCents = (buyerStripeInfo) => {
  try {
    const parsed = typeof buyerStripeInfo === "string" ? JSON.parse(buyerStripeInfo) : (buyerStripeInfo || {});
    const preTax = Number(parsed?.delivery_meta?.fee_cents_server) || 0; // server quote was pre-tax
    const withTax = Math.round(preTax * (1 + HST_RATE)); // Stripe line item used "includes tax"
    return { preTaxCents: preTax, withTaxCents: withTax };
  } catch {
    return { preTaxCents: 0, withTaxCents: 0 };
  }
};

const OrderAdmin = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // YYYY-MM-DD -> "Month D, YYYY"
  const formatYmd = (ymd) => {
    if (!ymd) return "";
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formattedOrderDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return (
      date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) +
      " at " +
      date.toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric" })
    );
  };

  const isDeliveryText = (delivery) => (delivery ? "Yes." : "No.");
  const specialNoteText = (note) => (note ? "Yes." : "N/A");

  const handleTogglePickedUp = async (order) => {
    const next = !order.picked_up;
    setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, picked_up: next } : o)));
    try {
      await setOrderPickedUp(order.id, next);
    } catch (e) {
      console.error(e);
      setOrders(prev => prev.map(o => (o.id === order.id ? { ...o, picked_up: !next } : o)));
      alert('Failed to update picked up status.');
    }
  };

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await fetchAllOrders();
        setOrders(data);
      } catch (err) {
        console.error("Failed to load orders:", err.message);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  const toggleDetailedOrder = async (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      setOrderDetails(null);
      return;
    }
    setExpandedOrderId(orderId);
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
    if (!phone) return "(not set)";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatStripePhoneNumber = (phone) => {
    if (!phone) return "(not set)";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("1") && cleaned.length === 11) {
      const area = cleaned.slice(1, 4);
      const prefix = cleaned.slice(4, 7);
      const line = cleaned.slice(7);
      return `(${area}) ${prefix}-${line}`;
    }
    return `+${cleaned}`;
  };

  // include postal in search too
  const filteredOrders = orders.filter(order => {
    const term = (searchTerm || "").toLowerCase();
    const postal = getPostalFromInfo(order.buyer_stripe_payment_info).toLowerCase();
    return (
      order.id?.toString().includes(term) ||
      order.buyer_email?.toLowerCase().includes(term) ||
      order.status?.toLowerCase().includes(term) ||
      postal.includes(term) ||
      (order.pickup_date && formatYmd(order.pickup_date).toLowerCase().includes(term)) ||
      (order.delivery_date && formatYmd(order.delivery_date).toLowerCase().includes(term))
    );
  });

  if (loading) return <p>Loading orders...</p>;

  return (
    <div className="order-admin-page">
      <h1>Order Admin</h1>
      <br />

      <input
        className="user-search-input"
        type="text"
        placeholder="Search by id, email, status, date or postal"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <table className="order-admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Status</th>
            <th>Placed at</th>
            <th>Due Date</th>
            <th>Delivery</th>
            <th>Postal (quote)</th>
            <th>Total</th>
            <th>Buyer Email</th>
            <th>Special Note</th>
            <th>Actions</th>
            <th>Picked Up / Delivered?</th>
          </tr>
        </thead>

        <tbody>
          {filteredOrders.map((order) => {
            const isOpen = expandedOrderId === order.id;
            const items = isOpen && orderDetails ? (orderDetails.order_products || []) : [];
            const postal = getPostalFromInfo(order.buyer_stripe_payment_info);
            const { preTaxCents, withTaxCents } = getDeliveryFeeCents(order.buyer_stripe_payment_info);

            return (
              <Fragment key={order.id}>
                <tr>
                  <td>{order.id}</td>
                  <td>{order.status}</td>
                  <td>{formattedOrderDate(order.created_at)}</td>

                  {/* Due Date: delivery date if delivery, else pickup date */}
                  <td>
                    {order.delivery
                      ? (formatYmd(order.delivery_date) || "—")
                      : (formatYmd(order.pickup_date) || "—")
                    }
                  </td>

                  <td>{isDeliveryText(order.delivery)}</td>
                  <td>{postal}</td>
                  <td>{formatMoney(order.total_cents)}</td>
                  <td>{order.buyer_email || "N/A"}</td>
                  <td>{specialNoteText(order.special_note)}</td>

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
                    {/* span across all columns */}
                    <td colSpan={11}>
                      <div className="order-details-card">
                        {/* Buyer info */}
                        {orderDetails?.user ? (
                          <div className="order-admin-buyer">
                            <strong>User:</strong>{' '}
                            {orderDetails.user?.first_name || ''}{' '}
                            {orderDetails.user?.last_name || ''}
                            <br />
                            <strong>Email: </strong>{orderDetails.user?.email || 'No email'}
                            <br />
                            <strong>Phone Number:</strong>{' '}
                            {formatPhoneNumber(orderDetails?.user.phone_number) || 'No phone'}
                            <br />
                            <strong>Special Note:</strong>{' '}
                            <span style={{ whiteSpace: 'pre-wrap' }}>
                              {order.special_note || ''}
                            </span>
                          </div>
                        ) : (
                          <div className="order-admin-buyer">
                            <strong>User not registered. </strong>
                            <br />
                            {orderDetails?.buyer_email || 'guest / unknown'}
                            <br />
                            {formatStripePhoneNumber(orderDetails?.buyer_phone_number) || ' / unknown'}
                            <br />
                            <strong>Special Note:</strong>{' '}
                            <span style={{ whiteSpace: 'pre-wrap' }}>
                              {order.special_note || ''}
                            </span>
                          </div>
                        )}

                        {/* Items */}
                        {detailsLoading ? (
                          <em>Loading items…</em>
                        ) : items.length ? (
                          <ul className="order-items-list">
                            {items.map((it) => (
                              <li key={it.id}>
                                {it.quantity}× {it.product?.slug || 'Unnamed product'} — {formatMoney(it.unit_price_cents)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <em>No items found for this order.</em>
                        )}

                        {/* Pickup time (for pickup orders) */}
                        {!order.delivery && order.pickup_time_slot && (
                          <div style={{ marginTop: 8 }}>
                            <strong>Pickup time:</strong> {order.pickup_time_slot}
                          </div>
                        )}

                        {/* Delivery details */}
                        {order.delivery && (
                          <>
                            <div style={{ marginTop: 8 }}>
                              <strong>Delivery postal (for quote):</strong> {postal}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <strong>Delivery fee:</strong> {formatMoney(withTaxCents)} <span style={{ color:'#666' }}>(incl HST)</span>
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
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OrderAdmin;

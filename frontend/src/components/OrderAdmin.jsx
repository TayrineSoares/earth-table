import { useEffect, useState, Fragment } from 'react';
import { fetchAllOrders, fetchOrderById } from '../helpers/orderHelpers';
import '../styles/OrderAdmin.css';

const OrderAdmin = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const formattedPickupDate = (pickupDate) => {
    if (!pickupDate) return "";

    const [year, month, day] = pickupDate.split("-");
    const localDate = new Date(year, month - 1, day); 
    return localDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const isDelivery = (delivery) => {
    if (!delivery) return 'No.';

    return "Yes.";
  }

  const specialNote = (note) => {
    if (!note) return 'N/A';

    return "Yes.";
  }

  const formattedOrderDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }) + " at " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric"
    });
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
    } else {
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

  const filteredOrders = orders.filter(order => {
    const term = (searchTerm || "").toLowerCase();
    return (
      order.id?.toString().includes(term) ||
      order.buyer_email?.toLowerCase().includes(term) ||
      order.status?.toLowerCase().includes(term) ||
      (order.pickup_date &&
        formattedPickupDate(order.pickup_date).toLowerCase().includes(term))    

    );
  });

  if (loading) return <p>Loading orders...</p>;

  return (
    <div className="order-admin-page">
      <h1>Order Admin</h1>
      <br/>

      <input
        className="user-search-input"
        type="text"
        placeholder="Search by id, email, status or pickup date"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <table className="order-admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Status</th>
            <th>Placed at</th>
            <th>Pickup</th>
            <th>Total</th>
            <th>Buyer Email</th>
            <th>Delivery</th>
            <th>Special Note</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredOrders.map((order) => {
            const isOpen = expandedOrderId === order.id;
            const items = isOpen && orderDetails ? (orderDetails.order_products || []) : [];

            return (
              <Fragment key={order.id}>
                <tr>
                  <td>{order.id}</td>
                  <td>{order.status}</td>
                  <td>{formattedOrderDate(order.created_at)}</td>
                  <td>{formattedPickupDate(order.pickup_date)}, {order.pickup_time_slot}</td>
                  <td>${(order.total_cents / 100).toFixed(2)}</td>
                  <td>{order.buyer_email || "N/A"}</td>
                  <td>{isDelivery(order.delivery)}</td>
                  <td>{specialNote(order.special_note)}</td>
                  <td>
                    <button className="view-items-button" onClick={() => toggleDetailedOrder(order.id)}>
                      {isOpen ? 'Hide' : 'View Details'}
                    </button>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="order-admin-details-row">
                    <td colSpan={6}>
                      <div className="order-details-card">
                        {/* Buyer info */}
                        {orderDetails?.user ? (
                          <div className="order-admin-buyer">
                            <strong>User:</strong>{' '}
                            {orderDetails.user?.first_name || ''}{' '}
                            {orderDetails.user?.last_name || ''}
                            <br></br>
                            <strong>Email: </strong>{orderDetails.user?.email || 'No email'} 
                            <br></br>
                            <strong>Phone Number:</strong> {formatPhoneNumber(orderDetails?.user.phone_number) || 'No phone'}
                            <br></br>
                            <strong>Special Note:</strong>{' '}{order.special_note || ''}{' '}
                          </div>
                        ) : (
                          <div className="order-admin-buyer">
                            <strong>User not registered. </strong> {orderDetails?.buyer_email || 'guest / unknown'}
                          </div>
                        )}

                        {/* Items */}
                        {detailsLoading ? (
                          <em>Loading items…</em>
                        ) : items.length ? (
                          <ul className="order-items-list">
                            {items.map((it) => (
                              <li key={it.id}>
                                {it.quantity}× {it.product?.slug || 'Unnamed product'} — $
                                {(it.unit_price_cents / 100).toFixed(2)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <em>No items found for this order.</em>
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

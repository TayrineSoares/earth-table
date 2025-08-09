import { useEffect, useState, Fragment } from 'react';
import { fetchAllOrders, fetchOrderById } from '../helpers/orderHelpers';

const OrderAdmin = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

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

  if (loading) return <p>Loading orders...</p>;

  return (
    <div className="order-admin-page">
      <h1>Order Admin</h1>

      <table className="order-admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Status</th>
            <th>Placed at</th>
            <th>Total</th>
            <th>Buyer Email</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => {
            const isOpen = expandedOrderId === order.id;
            const items = isOpen && orderDetails ? (orderDetails.order_products || []) : [];

            return (
              <Fragment key={order.id}>
                <tr>
                  <td>{order.id}</td>
                  <td>{order.status}</td>
                  <td>{new Date(order.created_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</td>
                  <td>${(order.total_cents / 100).toFixed(2)}</td>
                  <td>{order.buyer_email || "N/A"}</td>
                  <td>
                    <button onClick={() => toggleDetailedOrder(order.id)}>
                      {isOpen ? 'Hide' : 'View items'}
                    </button>
                  </td>
                </tr>

                {isOpen && (
                  <tr className="order-admin-details-row">
                    <td colSpan={6}>
                      {detailsLoading ? (
                        <em>Loading items…</em>
                      ) : items.length ? (
                        <ul className="order-admin-items">
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

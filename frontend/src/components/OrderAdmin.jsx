import { useEffect, useState } from 'react';
import { fetchAllOrders } from '../helpers/orderHelpers';

const OrderAdmin = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p>Loading orders...</p>;

  return (
    <div className="order-admin">
      <h1>Order Admin</h1>
      <table className="order-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Total ($)</th>
            <th>Email</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.status}</td>
              <td>{(order.total_cents / 100).toFixed(2)}</td>
              <td>{order.buyer_email}</td>
              <td>{new Date(order.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  
};

export default OrderAdmin;

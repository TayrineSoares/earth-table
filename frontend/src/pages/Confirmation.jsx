import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchOrderBySessionId } from '../helpers/orderHelpers';
import { Link } from 'react-router-dom';

const Confirmation = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getOrder = async () => {
      if (!sessionId) return;

      const data = await fetchOrderBySessionId(sessionId);
      setOrder(data); // could still be null if not found
      setLoading(false);
      console.log("This is the order" , order);
    };

    getOrder();
  }, [sessionId]);

  if (loading) return <p>Loading your order...</p>;

  // Prevent crash if order is null
  if (!order) {
    return (
      <div>
        <h1>Oops!</h1>
        <p>We couldn't find your order. Please check your email for confirmation, or contact support.</p>
        <Link to="/">Back to Home</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Thank You for Your Order!</h1>
      <p>Order ID: {order.id}</p>
      <p>Status: {order.status}</p>
      <p>Total: ${(order.total_cents / 100).toFixed(2)}</p>

      <h2>Items:</h2>
      <ul>
        {order.products?.map((product, index) => (
          <li key={index}>
            {product.quantity}x {product.slug} – ${(product.unit_price_cents / 100).toFixed(2)}
          </li>
        ))}
      </ul>

      

      <p>A confirmation email has been sent to you.</p>
      <Link to="/">Back to Home</Link>
    </div>
  );
};

export default Confirmation;

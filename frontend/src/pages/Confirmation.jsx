import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchOrderBySessionId } from '../helpers/orderHelpers';
import Lottie from 'lottie-react';
import loadingAnimation from '../assets/loading.json';
import checkoutImage from "../assets/images/checkoutImage.png";
import "../styles/Cart.css";

const formattedPickupDate = (pickupDate) => {
  if (!pickupDate) return "";
  const [y, m, d] = pickupDate.split("-");
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
};

export default function Confirmation({ clearCart }) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const data = await fetchOrderBySessionId(sessionId);
  
      setOrder(data);
      setLoading(false);
      clearCart?.();
    })();
  }, [sessionId, clearCart]);

  if (loading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="checkout-page">
        <div className="page-wrapper">
          <div className="checkout-page-container">
            <div>
              <p className="checkout-summary-text">Oops!</p>
              <p className="number-of-items">We couldn't find your order. Please contact support.</p>
              <button onClick={() => navigate('/')} className="checkout-button">Back to Home</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = (order.total_cents || 0) / 100;
  const isDelivery = order.delivery === true;

  return (
    <div className="checkout-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">

          <div className="checkout-order-summary">
            <p className="checkout-summary-text">Thank You!</p>

            <div className="checkout-summary-items">
              <p className="number-of-items" style={{ fontSize: "18px" }}>Order Id</p>
              <p className="number-of-items" style={{ fontSize: "18px" }}>{order.id}</p>
            </div>

            <div className="checkout-summary-tax">
              <p className="number-of-items" style={{ fontSize: "18px" }}>Status</p>
              <p className="number-of-items" style={{ fontSize: "18px" }}>{order.status}</p>
            </div>

            <div className="checkout-total">
              <p className="total">Total</p>
              <p className="total">${total.toFixed(2)}</p>
            </div>

            <div style={{ marginTop: "30px", textAlign: "center" }}>
              {isDelivery ? (
                <>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    Delivery confirmed ✅
                  </p>
                  <p className="number-of-items">
                    We'll deliver to the address you provided in Special Instructions.
                  </p>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    A confirmation email has been sent to
                  </p>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    <strong>{order.buyer_email || 'your email address'}</strong>
                  </p>
                </>
              ) : (
                <>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    Your order will be ready for pickup on:
                  </p>
                  <p className="number-of-items">
                    {formattedPickupDate(order.pickup_date)}, between {order.pickup_time_slot}
                  </p>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    A confirmation email has been sent to
                  </p>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    <strong>{order.buyer_email || 'your email address'}</strong>
                  </p>
                </>
              )}
            </div>

            <button onClick={() => navigate('/')} className="checkout-button">
              Back to Home
            </button>
          </div>

          <div className='checkout-items'>
            {(order.products || []).map((p, i) => (
              <div className='checkout-items-container' key={i}>
                <img src={p.image_url} className='checkout-product-image' />
                <div className='checkout-item-details'>
                  <p className='checkout-item-title'>{p.slug}</p>
                  <p className='checkout-item-price'>
                    {p.quantity}x ${(p.unit_price_cents / 100).toFixed(2)}
                  </p>
                  <p className='checkout-quantity' style={{ marginTop: '10px' }}>
                    Total: ${(p.unit_price_cents * p.quantity / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

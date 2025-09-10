import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchOrderBySessionId } from '../helpers/orderHelpers';
import loadingAnimation from '../assets/loading.json';
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png";
import "../styles/Cart.css";

const formattedYmd = (ymd) => {
  if (!ymd) return "";
  const [y, m, d] = (ymd || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const localDate = new Date(y, m - 1, d);
  return localDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export default function Confirmation({ clearCart }) {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id') || "";
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const navigate = useNavigate();

  // Prevent duplicate fetch in React 18 StrictMode (dev) and on rerenders
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setErrMsg("Missing session id.");
      setLoading(false);
      return;
    }
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const ac = new AbortController();

    (async () => {
      try {
        const data = await fetchOrderBySessionId(sessionId);
        if (!data) {
          throw new Error("We couldn't find your order. If you were just charged, please contact support.");
        }
        setOrder(data);
        // Clear the cart once, after we successfully loaded the order
        clearCart?.();
      } catch (e) {
        console.error("[confirmation] failed:", e);
        setErrMsg(e?.message || "Something went wrong loading your order.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [sessionId]); // intentionally NOT depending on clearCart

  if (loading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  if (errMsg) {
    return (
      <div className="checkout-page">
        <div className="page-wrapper">
          <div className="checkout-page-container">
            <div>
              <p className="checkout-summary-text">Oops!</p>
              <p className="number-of-items">{errMsg}</p>
              <button onClick={() => navigate('/')} className="checkout-button">Back to Home</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Super defensive fallbacks
  const total = ((order?.total_cents ?? 0) / 100).toFixed(2);
  const isDelivery = !!order?.delivery;
  const pickupDateTxt = formattedYmd(order?.pickup_date);
  const deliveryDateTxt = order?.delivery_date_formatted || formattedYmd(order?.delivery_date);
  const buyerEmail = order?.buyer_email || "your email address";
  const products = Array.isArray(order?.products) ? order.products : [];

  return (
    <div className="checkout-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">

          <div className="checkout-order-summary">
            <p className="checkout-summary-text">Thank You!</p>

            <div className="checkout-summary-items">
              <p className="number-of-items" style={{ fontSize: "18px" }}>Order Id</p>
              <p className="number-of-items" style={{ fontSize: "18px" }}>{order?.id}</p>
            </div>

            <div className="checkout-summary-tax">
              <p className="number-of-items" style={{ fontSize: "18px" }}>Status</p>
              <p className="number-of-items" style={{ fontSize: "18px" }}>{order?.status || "paid"}</p>
            </div>

            <div className="checkout-total">
              <p className="total">Total</p>
              <p className="total">${total}</p>
            </div>

            <div style={{ marginTop: "30px", textAlign: "center" }}>
              {isDelivery ? (
                <>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    Delivery scheduled for: {deliveryDateTxt || "—"}
                  </p>
                  <p className="number-of-items">Between 11:00 AM and 6:00 PM</p>
                  {order?.special_note && (
                    <p className="number-of-items" style={{ marginTop: 10 }}>
                      Special Instructions and Delivery Address:
                      <br/><br/>{order.special_note}
                    </p>
                  )}
                  <br/>
                  <p className="number-of-items" style={{ fontSize: "16px", marginTop: 16 }}>
                    A confirmation email has been sent to {buyerEmail}
                  </p>
                </>
              ) : (
                <>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    Your order will be ready for pickup on:
                  </p>
                  <p className="number-of-items">
                    {pickupDateTxt || "—"}, between {order?.pickup_time_slot || "—"}
                  </p>
                  <p className="number-of-items" style={{ fontSize: "16px" }}>
                    A confirmation email has been sent to {buyerEmail}
                  </p>
                </>
              )}
            </div>

            <button onClick={() => navigate('/')} className="checkout-button">
              Back to Home
            </button>
          </div>

          <div className="checkout-items">
            {products.map((product, idx) => (
              <div className="checkout-items-container" key={`${product.slug || idx}-${idx}`}>
                {product.image_url ? (
                  <img src={product.image_url} className="checkout-product-image" alt="" />
                ) : (
                  <div className="checkout-product-image" style={{ background: "#f2f2f2" }} />
                )}
                <div className="checkout-item-details">
                  <p className="checkout-item-title">{product.slug || "Item"}</p>
                  <p className="checkout-item-price">
                    {product.quantity}x ${((product.unit_price_cents || 0) / 100).toFixed(2)}
                  </p>
                  <p className="checkout-quantity" style={{ marginTop: '10px' }}>
                    Total: ${(((product.unit_price_cents || 0) * (product.quantity || 1)) / 100).toFixed(2)}
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

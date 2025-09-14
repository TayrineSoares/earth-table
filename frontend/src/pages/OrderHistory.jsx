import React, { useEffect, useState } from "react";
import { fetchOrdersByAuthId } from "../helpers/orderHelpers";
import "../styles/OrderHistory.css";
import loadingAnimation from "../assets/loading.json";
import Lottie from "lottie-react";
import checkoutImage from "../assets/images/checkoutImage.png";

const OrderHistory = ({ user }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Parse "YYYY-MM-DD" as local and format "Weekday, Month D, YYYY"
  const formatYmdLong = (ymd) => {
    if (!ymd) return "—";
    const [y, m, d] = ymd.split("-").map(Number);
    if (!y || !m || !d) return "—";
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Created-at timestamp → "Month D, YYYY at H:MM"
  const formattedOrderDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return (
      date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }) +
      " at " +
      date.toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric" })
    );
  };

  // Safely read postal code from buyer_stripe_payment_info JSON
  const getPostalFromBuyerInfo = (buyerStripeInfo) => {
    try {
      const parsed =
        typeof buyerStripeInfo === "string"
          ? JSON.parse(buyerStripeInfo)
          : buyerStripeInfo || {};
      return parsed?.delivery_meta?.postal_code || "—";
    } catch {
      return "—";
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const loadOrders = async () => {
      try {
        const data = await fetchOrdersByAuthId(user.id);
        setOrders(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load orders:", e);
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrders();
  }, [user]);

  if (isLoading) {
    return (
      <div
        className="loading-container"
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  if (!orders.length) return <p>No orders found.</p>;

  return (
    <div>
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="Checkout" />
      </div>

      <div className="page-wrapper">
        <h2 className="password-text">Your Order History</h2>
        <br />
        {orders.map((order) => {
          const isDelivery = Boolean(order.delivery);
          const postal =
            isDelivery && order.buyer_stripe_payment_info
              ? getPostalFromBuyerInfo(order.buyer_stripe_payment_info)
              : null;

          return (
            <div key={order.id} className="order-card">
              <p>
                <strong>Order ID:</strong> {order.id}
              </p>
              <p>
                <strong>Status:</strong> {order.status}
              </p>
              <p>
                <strong>Placed:</strong> {formattedOrderDate(order.created_at)}
              </p>

              {/* Fulfillment block */}
              {isDelivery ? (
                <>
                  <p>
                    <strong>Order Type:</strong> Delivery
                  </p>
                  <p>
                    <strong>Delivery Date:</strong>{" "}
                    {formatYmdLong(order.delivery_date)}
                  </p>
                  <p>
                    <strong>Delivery Window:</strong> 11:00 AM – 6:00 PM
                  </p>
                  {!!postal && (
                    <p>
                      <strong>Delivery Postal Code used for Quote:</strong> {postal}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    <strong>Order Type:</strong> Pickup
                  </p>
                  <p>
                    <strong>Pickup Date:</strong>{" "}
                    {formatYmdLong(order.pickup_date)}
                  </p>
                  <p>
                    <strong>Pickup Time:</strong>{" "}
                    {order.pickup_time_slot || "—"}
                  </p>
                  <p>
                    <strong>Pickup Address:</strong> 77 Woodstream Blvd,
                    Vaughan, ON - L4L 7Y7
                  </p>
                </>
              )}

              <p>
                <strong>Total:</strong>{" "}
                ${(Number(order.total_cents || 0) / 100).toFixed(2)}
              </p>

              {/* Items */}
              {Array.isArray(order.order_products) &&
                order.order_products.length > 0 && (
                  <>
                    <p>
                      <strong>Items:</strong>
                    </p>
                    <ul className="order-products">
                      {order.order_products.map((item, idx) => (
                        <li key={idx}>
                          {item.quantity}x{" "}
                          {item.product?.slug || "Unnamed product"} - $
                          {(item.unit_price_cents / 100).toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

              {/* Special note */}
              {order.special_note && (
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  <strong>Special Instructions and / or  Delivery Address:</strong>
                  <br />
                  {order.special_note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderHistory;

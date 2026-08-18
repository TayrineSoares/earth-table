import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DELIVERY_WINDOW,
  fetchOrdersByAuthId,
  formatMoney,
  formatOrderPlacedAt,
  formatYmdLong,
  getDeliveryFeeCents,
  getOrderDiscount,
  getPostalFromBuyerInfo,
  isOrderItemAvailable,
  PICKUP_ADDRESS,
  shortOrderId,
  toCartProduct,
} from "../helpers/orderHelpers";
import { supabase } from "../supabaseClient";
import "../styles/Cart.css";
import "../styles/OrderHistory.css";
import loadingAnimation from "../assets/loading.json";
import Lottie from "lottie-react";
import checkoutImage from "../assets/images/checkoutImage.png";

const formatStatus = (status) => {
  const label = String(status || "paid").replace(/_/g, " ").trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Paid";
};

const OrderHistory = ({ user, addToCart }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(Boolean(user?.id));

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      const sessionUserId =
        user?.id ||
        (await supabase.auth.getSession()).data.session?.user?.id ||
        null;

      if (!sessionUserId) {
        if (!cancelled) {
          setSignedIn(false);
          setOrders([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        const data = await fetchOrdersByAuthId(sessionUserId);
        if (!cancelled) {
          setSignedIn(true);
          setOrders(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to load orders:", e);
        if (!cancelled) {
          setSignedIn(true);
          setOrders([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleReorderItem = (item) => {
    if (!isOrderItemAvailable(item)) return;
    addToCart?.(toCartProduct(item), item.quantity);
  };

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

  return (
    <div className="order-history-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <h1 className="order-history-title">Your orders</h1>

        {!signedIn ? (
          <div className="order-history-empty">
            <p className="order-history-empty-copy">Sign in to see your order history.</p>
            <Link to="/login" className="order-history-button">Log in</Link>
          </div>
        ) : !orders.length ? (
          <div className="order-history-empty">
            <p className="order-history-empty-copy">You haven't placed an order yet.</p>
            <Link to="/products/category" className="order-history-button">Shop meals</Link>
          </div>
        ) : (
          orders.map((order) => {
            const isDelivery = Boolean(order.delivery);
            const items = Array.isArray(order.order_products) ? order.order_products : [];
            const postal = isDelivery
              ? getPostalFromBuyerInfo(order.buyer_stripe_payment_info)
              : "";
            const itemSubtotalCents = Number(order.item_subtotal_cents) || 0;
            const discount = getOrderDiscount(order);
            const deliveryFeeCents = isDelivery ? getDeliveryFeeCents(order) : 0;
            const creditCents = Number(order.credit_applied_cents) || 0;

            return (
              <article key={order.id} className="order-card">
                <header className="order-card-header">
                  <div className="order-card-header-main">
                    <p className="order-card-id">Order {shortOrderId(order.id)}</p>
                    <div className="order-card-chips">
                      <span className="order-chip">{formatStatus(order.status)}</span>
                      <span className="order-chip">{isDelivery ? "Delivery" : "Pickup"}</span>
                    </div>
                  </div>
                  <p className="order-card-placed">{formatOrderPlacedAt(order.created_at)}</p>
                </header>

                <div className="order-meta-grid">
                  {isDelivery ? (
                    <>
                      <div className="order-meta-field">
                        <p className="order-meta-label">Delivery date</p>
                        <p className="order-meta-value">{formatYmdLong(order.delivery_date) || "—"}</p>
                      </div>
                      <div className="order-meta-field">
                        <p className="order-meta-label">Window</p>
                        <p className="order-meta-value">{DELIVERY_WINDOW}</p>
                      </div>
                      {!!postal && (
                        <div className="order-meta-field">
                          <p className="order-meta-label">Postal code</p>
                          <p className="order-meta-value">{postal}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="order-meta-field">
                        <p className="order-meta-label">Pickup date</p>
                        <p className="order-meta-value">{formatYmdLong(order.pickup_date) || "—"}</p>
                      </div>
                      <div className="order-meta-field">
                        <p className="order-meta-label">Time</p>
                        <p className="order-meta-value">{order.pickup_time_slot || "—"}</p>
                      </div>
                      <div className="order-meta-field order-meta-field--wide">
                        <p className="order-meta-label">Address</p>
                        <p className="order-meta-value">{PICKUP_ADDRESS}</p>
                      </div>
                    </>
                  )}
                </div>

                {items.length > 0 && (
                  <ul className="order-items">
                    {items.map((item, idx) => {
                      const available = isOrderItemAvailable(item);
                      const name = item.product?.slug || "Unnamed product";
                      const productId = item.product?.id || item.product_id;
                      const row = (
                        <>
                          {item.product?.image_url ? (
                            <img
                              src={item.product.image_url}
                              alt=""
                              className="order-item-image"
                            />
                          ) : (
                            <div className="order-item-image order-item-image--placeholder" />
                          )}
                          <div className="order-item-details">
                            <p className="order-item-name">{name}</p>
                            <p className="order-item-price">
                              {item.quantity}x {formatMoney(item.unit_price_cents)}
                            </p>
                          </div>
                        </>
                      );

                      return (
                        <li
                          key={`${productId || name}-${idx}`}
                          className={`order-item${available ? "" : " is-unavailable"}`}
                        >
                          {available ? (
                            <a
                              href={`/products/${productId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="order-item-link"
                            >
                              {row}
                            </a>
                          ) : (
                            <div className="order-item-link">{row}</div>
                          )}

                          {available ? (
                            <button
                              type="button"
                              className="order-history-button order-history-button--small"
                              onClick={() => handleReorderItem(item)}
                            >
                              Reorder
                            </button>
                          ) : (
                            <span className="order-item-unavailable">Unavailable</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {order.special_note && (
                  <div className="order-notes">
                    <p className="order-meta-label">
                      {isDelivery ? "Address & notes" : "Notes"}
                    </p>
                    <p className="order-notes-body">{order.special_note}</p>
                  </div>
                )}

                <div className="order-totals">
                  {itemSubtotalCents > 0 && (
                    <div className="order-total-row">
                      <span>{discount ? "Subtotal (before discount)" : "Subtotal"}</span>
                      <span>{formatMoney(itemSubtotalCents)}</span>
                    </div>
                  )}
                  {discount && (
                    <div className="order-total-row">
                      <span>
                        {discount.label} ({discount.code})
                        {discount.percent != null ? ` — ${discount.percent}% off` : ""}
                      </span>
                      <span>−{formatMoney(discount.amountOffCents)}</span>
                    </div>
                  )}
                  {deliveryFeeCents > 0 && (
                    <div className="order-total-row">
                      <span>Delivery fee</span>
                      <span>{formatMoney(deliveryFeeCents)}</span>
                    </div>
                  )}
                  {creditCents > 0 && (
                    <div className="order-total-row">
                      <span>Store credit</span>
                      <span>−{formatMoney(creditCents)}</span>
                    </div>
                  )}
                  <div className="order-total-row order-total-row--grand">
                    <span>Total</span>
                    <span>{formatMoney(order.total_cents)}</span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OrderHistory;

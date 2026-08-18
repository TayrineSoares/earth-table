import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchOrderBySessionId } from '../helpers/orderHelpers';
import loadingAnimation from '../assets/loading.json';
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png";
import "../styles/Cart.css";
import "../styles/Confirmation.css";

const PICKUP_ADDRESS = "77 Woodstream Blvd, Vaughan, ON L4L 7Y7";

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

const money = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

const parsePaymentInfo = (order) => {
  try {
    const raw = order?.buyer_stripe_payment_info;
    return typeof raw === "string" ? JSON.parse(raw) : raw || {};
  } catch {
    return {};
  }
};

const getDiscount = (order) => {
  const meta = parsePaymentInfo(order).discount_meta || {};
  const code = String(meta.code || order?.referral_code || "").trim();
  if (!code) return null;

  const kind = meta.kind || (order?.referral_code ? "referral" : "promo");
  const percent = Number(meta.percent);
  const itemSubtotalCents = Number(order?.item_subtotal_cents) || 0;
  let amountOffCents = Number(meta.amount_off_cents);
  if (!Number.isFinite(amountOffCents) || amountOffCents < 0) {
    const pct = Number.isFinite(percent) ? percent : kind === "referral" ? 15 : 0;
    amountOffCents = Math.round(itemSubtotalCents * pct / 100);
  }

  return {
    label: kind === "referral" ? "Referral" : "Promo",
    code: code.toUpperCase(),
    percent: Number.isFinite(percent) ? percent : kind === "referral" ? 15 : null,
    amountOffCents,
  };
};

const getDeliveryFeeCents = (order) => {
  const preTax = Number(parsePaymentInfo(order)?.delivery_meta?.fee_cents_server) || 0;
  return preTax > 0 ? Math.round(preTax * 1.13) : 0;
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

  const isDelivery = !!order?.delivery;
  const pickupDateTxt = formattedYmd(order?.pickup_date);
  const deliveryDateTxt = order?.delivery_date_formatted || formattedYmd(order?.delivery_date);
  const buyerEmail = order?.buyer_email || "your email address";
  const products = Array.isArray(order?.products) ? order.products : [];
  const itemSubtotalCents = Number(order?.item_subtotal_cents) || 0;
  const discount = getDiscount(order);
  const deliveryFeeCents = isDelivery ? getDeliveryFeeCents(order) : 0;
  const creditCents = Number(order?.credit_applied_cents) || 0;

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
              <p className="number-of-items">Order ID</p>
              <p className="number-of-items">{order?.id}</p>
            </div>

            <div className="checkout-summary-items">
              <p className="number-of-items">Status</p>
              <p className="number-of-items">{order?.status || "paid"}</p>
            </div>

            {itemSubtotalCents > 0 && (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">
                  {discount ? "Subtotal (before discount)" : "Subtotal"}
                </p>
                <p className="subtotal">{money(itemSubtotalCents)}</p>
              </div>
            )}

            {discount && (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">
                  {discount.label} ({discount.code})
                  {discount.percent != null ? ` — ${discount.percent}% off` : ""}
                </p>
                <p className="subtotal">-{money(discount.amountOffCents)}</p>
              </div>
            )}

            {deliveryFeeCents > 0 && (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">Delivery fee</p>
                <p className="subtotal">{money(deliveryFeeCents)}</p>
              </div>
            )}

            {creditCents > 0 && (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">Store credit</p>
                <p className="subtotal">-{money(creditCents)}</p>
              </div>
            )}

            <div className="checkout-summary-tax">
              <p className="tax">HST</p>
              <p className="tax">13%</p>
            </div>

            <div className="checkout-total">
              <p className="total">Total</p>
              <p className="total">{money(order?.total_cents)}</p>
            </div>

            <div className="confirmation-fulfillment">
              {isDelivery ? (
                <>
                  <p className="confirmation-note">
                    Delivery scheduled for {deliveryDateTxt || "—"}
                  </p>
                  <p className="confirmation-note">Between 11:00 AM and 6:00 PM</p>
                  {order?.special_note && (
                    <p className="confirmation-note confirmation-note--block">
                      Address &amp; notes
                      <br /><br />{order.special_note}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="confirmation-note">
                    Pickup {pickupDateTxt || "—"}, between {order?.pickup_time_slot || "—"}
                  </p>
                  <p className="confirmation-note">{PICKUP_ADDRESS}</p>
                  {order?.special_note && (
                    <p className="confirmation-note confirmation-note--block">
                      Notes: {order.special_note}
                    </p>
                  )}
                </>
              )}
              <p className="confirmation-note">
                A confirmation email has been sent to {buyerEmail}
              </p>
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
                    {product.quantity}x {money(product.unit_price_cents)}
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

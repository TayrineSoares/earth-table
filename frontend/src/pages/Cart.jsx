import loadingAnimation from '../assets/loading.json'
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png"
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../supabaseClient';
import PickupSelector from '../components/PickupSelector';
import DeliverySelector from '../components/DeliverySelector';
import "../styles/Cart.css"
import { Link } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8080";

const Cart = ({ cart, removeOneFromCart, addOneFromCart, removeAll }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [specialNote, setSpecialNote] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // fulfillment mode + delivery info
  const [fulfillment, setFulfillment] = useState("pickup"); // "pickup" | "delivery"
  const [postalCode, setPostalCode] = useState("");
  const [postalValid, setPostalValid] = useState(false);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");

  // quote status + distance
  const [quoteStatus, setQuoteStatus] = useState("idle"); // idle|loading|ok|out|error
  const [distanceKm, setDistanceKm] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/cart`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error.${res.status}`);
        return res.json();
      })
      .then(() => setIsLoading(false))
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkSession();
  }, []);

  const subtotalCents = cart.reduce((sum, item) => {
    return sum + item.price_cents * item.quantity;
  }, 0);

  // Clear opposite fields when switching fulfillment
  useEffect(() => {
    if (fulfillment === "pickup") {
      // clear delivery-only fields
      setDeliveryDate("");
      setPostalCode("");
      setPostalValid(false);
      setDeliveryFeeCents(0);
      setQuoteStatus("idle");
      setDistanceKm(null);
    } else if (fulfillment === "delivery") {
      // clear pickup-only fields
      setPickupDate("");
      setPickupTime("");
    }
  }, [fulfillment]);

  // helper to switch modes (effect above handles clearing)
  const switchFulfillment = (mode) => setFulfillment(mode);

  useEffect(() => {
    if (fulfillment !== "delivery" || !postalValid) {
      setQuoteStatus("idle");
      setDeliveryFeeCents(0);
      setDistanceKm(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setQuoteStatus("loading");
        const resp = await fetch(`${API_BASE}/api/delivery/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postalCode }),
        });

        const text = await resp.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.error("Quote: non-JSON response", resp.status, text);
          if (!cancelled) {
            setQuoteStatus("error");
            setDeliveryFeeCents(0);
            setDistanceKm(null);
          }
          return;
        }

        if (cancelled) return;

        if (resp.ok && data?.ok) {
          setDeliveryFeeCents(data.fee_cents || 0);
          setDistanceKm(data.km ?? null);
          setQuoteStatus("ok");
        } else if (data?.reason === "OUT_OF_ZONE") {
          setDeliveryFeeCents(0);
          setDistanceKm(data.km ?? null);
          setQuoteStatus("out");
        } else {
          console.error("Quote: server said no", resp.status, data);
          setDeliveryFeeCents(0);
          setDistanceKm(null);
          setQuoteStatus("error");
        }
      } catch (e) {
        console.error("Quote fetch failed", e);
        if (!cancelled) {
          setQuoteStatus("error");
          setDeliveryFeeCents(0);
          setDistanceKm(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [fulfillment, postalCode, postalValid]);

  // totals
  const hstRate = 0.13;
  const totalBeforeTaxCents = subtotalCents + (fulfillment === "delivery" ? deliveryFeeCents : 0);
  const taxCents = Math.round(totalBeforeTaxCents * hstRate);
  const grandTotalCents = totalBeforeTaxCents + taxCents;

  if (isLoading) {
    return (
      <div
        className="loading-container"
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

  const handleCheckout = async () => {
    console.log("[checkout] click", {
      fulfillment,
      postalCode,
      specialNoteLen: specialNote?.length || 0,
    });

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.error("Supabase session error:", error.message);

    const userId = session?.user?.id || null;
    const email = session?.user?.email || null;

    const stripe = await stripePromise;

    // Send nulls for inactive fields
    const payload = {
      cartItems: cart,
      email,
      userId,
      pickup_date: fulfillment === "pickup" ? pickupDate : null,
      pickup_time_slot: fulfillment === "pickup" ? pickupTime : null,
      delivery: fulfillment === "delivery",
      delivery_postal_code: fulfillment === "delivery" ? (postalCode || null) : null,
      // server recomputes the fee, so this is ignored but harmless to send
      delivery_fee_cents: fulfillment === "delivery" ? deliveryFeeCents : 0,
      delivery_date: fulfillment === "delivery" ? deliveryDate : null,
      special_note: specialNote,
    };


    const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[checkout] server error", response.status, err);
      alert(err.error || "Checkout failed. Please try again.");
      return;
    }

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error("[checkout] missing session url", data);
      alert("Checkout failed. Please try again.");
    }
  };

  const getCartItemCount = (cart) => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <div className='checkout-page'>

      <div className='checkout-page-header-image'>
        <img
          src={checkoutImage}
          className='checkout-image'
          alt="Checkout header"
        />
      </div>

      <div className='page-wrapper'>
        <div className='checkout-page-container'>

          <div className='checkout-order-summary'>

            <p className='checkout-summary-text'>Order Summary</p>

            <div className='checkout-summary-items'>
              <p className='number-of-items'>{getCartItemCount(cart)} ITEMS</p>
            </div>

            {/* Fulfillment toggle */}
            <div className="general-text" style={{ margin: "10px 0 16px" }}>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  name="fulfillment"
                  value="pickup"
                  checked={fulfillment === "pickup"}
                  onChange={() => switchFulfillment("pickup")}
                />{" "}
                Pickup
              </label>
              <label>
                <input
                  type="radio"
                  name="fulfillment"
                  value="delivery"
                  checked={fulfillment === "delivery"}
                  onChange={() => switchFulfillment("delivery")}
                />{" "}
                Delivery
              </label>
            </div>

            {/* SUBTOTAL */}
            <div className='checkout-summary-subtotal'>
              <p className='subtotal'>SUBTOTAL</p>
              <p className='subtotal'>${(subtotalCents / 100).toFixed(2)}</p>
            </div>

            {/* Delivery fee row (delivery only) */}
            {fulfillment === "delivery" && (
              <>
                <div className='checkout-summary-subtotal'>
                  <p className='subtotal'>Delivery fee (pre-tax)</p>
                  <p className='subtotal'>
                    {quoteStatus === "loading"
                      ? "Calculating..."
                      : deliveryFeeCents > 0
                        ? `$${(deliveryFeeCents / 100).toFixed(2)}`
                        : "$0.00"}
                  </p>
                </div>

                {quoteStatus === "out" && (
                  <p className="general-text" style={{ color: "#b30000" }}>
                    Delivery not available for this area. For Delivery via Uber Courier, email{" "}
                    <a className="footer-account-register" href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a>.
                  </p>
                )}
                {quoteStatus === "error" && (
                  <p className="general-text" style={{ color: "#b30000" }}>
                    Couldn't calculate delivery distance. Check the postal code and try again.
                  </p>
                )}
              </>
            )}

            {/* TAX */}
            <div className='checkout-summary-tax'>
              <p className='tax'>HST</p>
              <p className='tax'>13%</p>
            </div>

            {/* TOTAL */}
            <div className='checkout-total'>
              <p className='total'>Total</p>
              <p className='total'>${(grandTotalCents / 100).toFixed(2)}</p>
            </div>

            {/* PICKUP or DELIVERY SELECTOR */}
            {fulfillment === "pickup" ? (
              <PickupSelector
                pickupDate={pickupDate}
                pickupTime={pickupTime}
                onDateChange={setPickupDate}
                onTimeChange={setPickupTime}
              />
            ) : (
              <DeliverySelector
                postalCode={postalCode}
                onPostalCodeChange={setPostalCode}
                feeCents={deliveryFeeCents}
                onValidate={({ valid }) => setPostalValid(valid)}
                deliveryDate={deliveryDate}
                onDeliveryDateChange={setDeliveryDate}
              />
            )}
            <br />

            <div className="special-note-container">
              <label htmlFor="special-note" className='general-text'>Special Instructions </label>
              <textarea
                className='special-note-input'
                id="special-note"
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder={
                  fulfillment === "delivery"
                    ? "Delivery address, allergies, special instructions..."
                    : "Allergies, special instructions..."
                }
                rows="3"
              />
            </div>

            <div className="general-text">
              <input
                type="checkbox"
                id="privacy-agree"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              />
              <label htmlFor="privacy-agree">
                I have read and agree to the <Link className="footer-account-register" to="/privacy">Privacy Policy</Link>.
              </label>
            </div>

            <button
              disabled={
                !agreedToPrivacy ||
                (fulfillment === "pickup" && (!pickupDate || !pickupTime)) ||
                (fulfillment === "delivery" && (
                  !postalValid ||
                  quoteStatus !== "ok" ||        // must be within 30 km
                  deliveryFeeCents <= 0 ||
                  !deliveryDate ||
                  specialNote.trim().length < 8  // require full delivery address here
                ))
              }
              onClick={handleCheckout}
              className="checkout-button"
            >
              Proceed to Checkout
            </button>

          </div>

          <div className='checkout-items'>
            {cart.map(item => (
              <div
                className='checkout-items-container'
                key={item.id}
              >
                <img
                  src={item.image_url}
                  className='checkout-product-image'
                  alt={item.slug}
                />

                <div className='checkout-item-details'>
                  <p className='checkout-item-title'>{item.slug}</p>
                  <p className='checkout-item-price'>${(item.price_cents * item.quantity / 100).toFixed(2)}</p>

                  <div className="cart-popup-item-quantity-container">
                    <p className='checkout-quantity'>QTY:</p>
                    <div className='checkout-quantity-button-container'>
                      <button
                        onClick={() => removeOneFromCart(item)}
                        className='checkout-cart-popup-remove-button'
                      >-
                      </button>
                      <p className='checkout-item-quantity'>{item.quantity}</p>
                      <button
                        onClick={() => addOneFromCart(item)}
                        className='checkout-cart-popup-add-button'
                      > +
                      </button>
                    </div>
                    <button className="checkout-popup-remove-button" onClick={() => removeAll(item)}>REMOVE</button>
                  </div>
                </div>

              </div>

            ))}
          </div>

        </div>
      </div>
    </div>
  )
};

export default Cart;

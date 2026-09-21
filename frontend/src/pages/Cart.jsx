import loadingAnimation from '../assets/loading.json'
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png"
import { supabase } from '../supabaseClient';
import PickupSelector from '../components/PickupSelector';
import DeliverySelector from '../components/DeliverySelector';
import FeedbackDialog from '../components/FeedbackDialog';
import { Trash2 } from 'lucide-react';
import "../styles/Cart.css"
import "../styles/SubscribeFlow.css"
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

  // promo code UI + result from backend
  const [promoInput, setPromoInput] = useState('');
  const [promoResult, setPromoResult] = useState(null); // { valid, code, discountPercentage, amountOffCents, message }
  const [promoLoading, setPromoLoading] = useState(false);
  const [lastValidatedCode, setLastValidatedCode] = useState('');
  const [partnerWallet, setPartnerWallet] = useState(null);
  const [dialog, setDialog] = useState(null);

  const checkoutEnabled = import.meta.env.VITE_CHECKOUT_ENABLED !== 'false';

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
    let cancelled = false;

    const loadSessionAndWallet = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      if (!cancelled) setIsLoggedIn(!!session);

      if (!userId) {
        if (!cancelled) setPartnerWallet(null);
        return;
      }

      try {
        const res = await fetch(`/api/partners/by-user/${userId}`);
        if (!res.ok) {
          if (!cancelled) setPartnerWallet(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setPartnerWallet(data);
      } catch (err) {
        console.error('[cart] partner wallet fetch failed', err);
        if (!cancelled) setPartnerWallet(null);
      }
    };

    loadSessionAndWallet();
    return () => { cancelled = true; };
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
  let promoDiscountCents = 0;

  if (promoResult?.valid && promoResult.discountPercentage != null) {
    const rate = promoResult.discountPercentage / 100; // e.g. 20 → 0.2
    promoDiscountCents = Math.round(subtotalCents * rate);

    // safety: don't discount more than subtotal
    promoDiscountCents = Math.min(promoDiscountCents, subtotalCents);
  }

  const itemsSubtotalAfterPromoCents = Math.max(0, subtotalCents - promoDiscountCents);
  const totalBeforeTaxCents = itemsSubtotalAfterPromoCents + (fulfillment === "delivery" ? deliveryFeeCents : 0);
  const hstRate = 0.13;
  const taxCents = Math.round(totalBeforeTaxCents * hstRate);
  const grandTotalCents = totalBeforeTaxCents + taxCents;
  const STRIPE_MIN_CENTS = 50;
  const availableCreditCents = Math.max(0, Number(partnerWallet?.available_credit_cents) || 0);
  const maxCreditCents = Math.max(0, grandTotalCents - STRIPE_MIN_CENTS);
  const creditPreviewCents = Math.min(availableCreditCents, maxCreditCents);
  const showStoreCredit = availableCreditCents > 0 && cart.length > 0;
  const chargeCents = grandTotalCents - creditPreviewCents;

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

  const missingCheckoutItems = () => {
    const missing = [];
    if (cart.length === 0) missing.push('Add items to your cart.');
    if (fulfillment === 'pickup') {
      if (!pickupDate) missing.push('Select a pickup date.');
      if (!pickupTime) missing.push('Select a pickup time.');
    } else {
      if (!postalValid) {
        missing.push('Enter a valid postal code.');
      } else if (quoteStatus === 'out') {
        missing.push('Delivery is not available for this postal code.');
      } else if (quoteStatus !== 'ok' || deliveryFeeCents <= 0) {
        missing.push('Enter a postal code we can deliver to.');
      }
      if (!deliveryDate) missing.push('Select a delivery date.');
      if (specialNote.trim().length < 8) {
        missing.push('Add your full delivery address in Special Instructions.');
      }
    }
    if (!agreedToPrivacy) {
      missing.push('Agree to the Privacy Policy to continue.');
    }
    return missing;
  };

  const showMissingDialog = (missing) => {
    setDialog({
      icon: 'alert',
      title: missing.length === 1 ? 'One more step' : 'A few things are missing',
      asList: missing.length > 1,
      body: missing.length === 1 ? missing[0] : missing,
      primaryLabel: 'Got it',
    });
  };

  // APPLY PROMO CODE 
  const handleApplyPromo = async () => {
    const code = (promoInput || '').trim();
    if (!code) {
      setPromoResult({ valid: false, message: 'Enter a code.' });
      return;
    }
    setPromoLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      const res = await fetch(`${API_BASE}/promo/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotalCents, userId }),
      });
      const data = await res.json();
      setPromoResult(data);
      setLastValidatedCode(code);
    } catch (e) {
      console.error('[promo] validate failed', e);
      setPromoResult({ valid: false, message: 'Could not validate code. Try again.' });
    } finally {
      setPromoLoading(false);
    }
  };

  // HANDLE CHECKOUT 
  const handleCheckout = async () => {
    const missing = missingCheckoutItems();
    if (missing.length) {
      showMissingDialog(missing);
      return;
    }

    console.log("[checkout] click", {
      fulfillment,
      postalCode,
      specialNoteLen: specialNote?.length || 0,
    });

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.error("Supabase session error:", error.message);

    const userId = session?.user?.id || null;
    const email = session?.user?.email || null;

    const code = (promoInput || '').trim();
    let checkoutPromoCode = null;

    if (code) {
      try {
        const res = await fetch(`${API_BASE}/promo/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, subtotalCents, userId }),
        });
        const data = await res.json();
        setPromoResult(data);
        setLastValidatedCode(code);
        if (!data.valid) {
          setDialog({
            icon: 'alert',
            title: 'Promo code',
            body: data.message || 'That code could not be applied.',
            primaryLabel: 'OK',
          });
          return;
        }
        checkoutPromoCode = code;
      } catch (e) {
        console.error('[checkout] promo validate failed', e);
        setDialog({
          icon: 'alert',
          title: 'Promo code',
          body: 'Could not validate your code. Try again.',
          primaryLabel: 'OK',
        });
        return;
      }
    }

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
      ...(checkoutPromoCode ? { promoCode: checkoutPromoCode } : {}),
    };


    const response = await fetch(`${API_BASE}/api/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[checkout] server error", response.status, err);
      setDialog({
        icon: 'alert',
        title: 'Could not start checkout',
        body: err.error || 'Checkout failed. Please try again.',
        primaryLabel: 'OK',
      });
      return;
    }

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error("[checkout] missing session url", data);
      setDialog({
        icon: 'alert',
        title: 'Could not start checkout',
        body: 'Checkout failed. Please try again.',
        primaryLabel: 'OK',
      });
    }
  };

  const getCartItemCount = (cart) => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <div className="checkout-page subscribe-cart-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="subscribe-checkout-hero">
          <p className="checkout-summary-text">Review &amp; Confirm</p>
        </div>

        <div className="checkout-page-container">
          <div className="checkout-order-summary">
            <div className="subscribe-summary-heading-row subscribe-summary-heading-row--count">
              <p className="subscribe-summary-heading">Order summary</p>
              <p className="subscribe-item-count">
                {getCartItemCount(cart)} {getCartItemCount(cart) === 1 ? 'item' : 'items'}
              </p>
            </div>
            <div className="checkout-summary-subtotal">
              <p className="subtotal">Subtotal</p>
              <p className="subtotal">${(subtotalCents / 100).toFixed(2)}</p>
            </div>
            {fulfillment === 'delivery' ? (
              <>
                <div className="checkout-summary-subtotal">
                  <p className="subtotal">Delivery fee</p>
                  <p className="subtotal">
                    {quoteStatus === 'loading'
                      ? 'Calculating...'
                      : deliveryFeeCents > 0
                        ? `$${(deliveryFeeCents / 100).toFixed(2)}`
                        : '$0.00'}
                  </p>
                </div>
                {quoteStatus === 'out' ? (
                  <p className="general-text" style={{ color: '#b30000' }}>
                    Delivery not available for this area. For Delivery via Uber Courier, email{' '}
                    <a className="footer-account-register" href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a>.
                  </p>
                ) : null}
                {quoteStatus === 'error' ? (
                  <p className="general-text" style={{ color: '#b30000' }}>
                    Couldn&apos;t calculate delivery distance. Check the postal code and try again.
                  </p>
                ) : null}
              </>
            ) : null}
            {promoResult?.valid ? (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">
                  {promoResult.kind === 'referral' ? 'Referral' : 'Promo'} ({promoResult.code})
                </p>
                <p className="subtotal">- ${(promoDiscountCents / 100).toFixed(2)}</p>
              </div>
            ) : null}
            <div className="checkout-summary-subtotal">
              <p className="subtotal">hst</p>
              <p className="subtotal">${(taxCents / 100).toFixed(2)}</p>
            </div>

            {showStoreCredit ? (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">Store credit</p>
                <p className="subtotal">- ${(creditPreviewCents / 100).toFixed(2)}</p>
              </div>
            ) : null}

            <div className="checkout-total">
              <p className="total">Total</p>
              <p className="total">${(chargeCents / 100).toFixed(2)}</p>
            </div>

            <div className="subscribe-fulfill-block">
              <p className="subscribe-summary-heading">How you&apos;ll get it</p>
              <div className="subscribe-fulfill-row" role="radiogroup" aria-label="How you'll get it">
                <label className="subscribe-fulfill-option">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="pickup"
                    checked={fulfillment === 'pickup'}
                    onChange={() => switchFulfillment('pickup')}
                  />
                  Pickup
                </label>
                <label className="subscribe-fulfill-option">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="delivery"
                    checked={fulfillment === 'delivery'}
                    onChange={() => switchFulfillment('delivery')}
                  />
                  Delivery
                </label>
              </div>

              {fulfillment === 'pickup' ? (
                <PickupSelector
                  pickupDate={pickupDate}
                  pickupTime={pickupTime}
                  onDateChange={setPickupDate}
                  onTimeChange={setPickupTime}
                  showReviewNotes={false}
                />
              ) : (
                <DeliverySelector
                  postalCode={postalCode}
                  onPostalCodeChange={setPostalCode}
                  feeCents={deliveryFeeCents}
                  onValidate={({ valid }) => setPostalValid(valid)}
                  deliveryDate={deliveryDate}
                  onDeliveryDateChange={setDeliveryDate}
                  showReviewNotes={false}
                />
              )}
            </div>

            <div className="special-note-container">
              <label htmlFor="special-note" className="general-text">
                {fulfillment === 'delivery'
                  ? 'Special Instructions + Delivery Address'
                  : 'Special Instructions'}
              </label>
              <textarea
                className="special-note-input"
                id="special-note"
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder={
                  fulfillment === 'delivery'
                    ? 'Delivery address, allergies, special instructions...'
                    : 'Allergies, special instructions...'
                }
                rows="3"
              />
            </div>

            <div className="promo-wrap general-text">
              <p className="subscribe-summary-heading">Promo code</p>
              <div className="promo-row">
                <input
                  id="promo"
                  type="text"
                  value={promoInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPromoInput(next);
                    if (!next.trim() || next.trim().toLowerCase() !== (lastValidatedCode || '').toLowerCase()) {
                      setPromoResult(null);
                    }
                  }}
                  placeholder="Have a promo code?"
                  autoComplete="off"
                  inputMode="text"
                  className="promo-input"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={promoLoading}
                  className={`checkout-button promo-apply-btn ${promoLoading ? 'is-disabled' : ''}`}
                >
                  {promoLoading ? 'Applying…' : 'Apply'}
                </button>
              </div>
              {promoResult ? (
                <div
                  className={`promo-msg ${promoResult.valid ? 'promo-msg--ok' : 'promo-msg--err'}`}
                  aria-live="polite"
                >
                  {promoResult.message}
                </div>
              ) : null}
            </div>

            <div className="subscribe-checkout-consent">
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
              type="button"
              className="checkout-button"
              disabled={!checkoutEnabled}
              onClick={handleCheckout}
            >
              {checkoutEnabled ? 'Proceed to Checkout' : 'Checkout unavailable'}
            </button>
          </div>

          <div className="checkout-items subscribe-cart-items">
            <p className="subscribe-list-heading">Your items</p>
            {cart.length === 0 ? (
              <p className="general-text subscribe-cart-empty">
                Your cart is empty —{' '}
                <Link className="subscribe-inline-link" to="/products/category">browse the menu</Link>
                {' '}to add meals.
              </p>
            ) : (
              cart.map((item) => (
                <div className="checkout-items-container" key={item.id}>
                  <img src={item.image_url} className="checkout-product-image" alt={item.slug} />
                  <div className="checkout-item-details">
                    <p className="checkout-item-name">{item.slug}</p>
                    <div className="subscribe-cart-item-meta">
                      <p className="checkout-item-price">${((item.price_cents * item.quantity) / 100).toFixed(2)}</p>
                      <span className="subscribe-cart-row-actions">
                        <span className="subscribe-cart-qty">
                          <button
                            type="button"
                            className="checkout-cart-popup-remove-button"
                            onClick={() => removeOneFromCart(item)}
                            aria-label={`Decrease ${item.slug}`}
                          >
                            -
                          </button>
                          <span className="checkout-item-quantity">{item.quantity}</span>
                          <button
                            type="button"
                            className="checkout-cart-popup-add-button"
                            onClick={() => addOneFromCart(item)}
                            aria-label={`Increase ${item.slug}`}
                          >
                            +
                          </button>
                        </span>
                        <button
                          type="button"
                          className="subscribe-cart-trash"
                          onClick={() => removeAll(item)}
                          aria-label={`Remove ${item.slug}`}
                        >
                          <Trash2 size={18} strokeWidth={2} />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
};

export default Cart;

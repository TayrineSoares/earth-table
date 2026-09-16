import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import PickupSelector from '../components/PickupSelector'
import DeliverySelector from '../components/DeliverySelector'
import FeedbackDialog from '../components/FeedbackDialog'
import '../styles/Cart.css'
import '../styles/SubscribeFlow.css'
import {
  fetchMySubscriptions,
  fetchSubscriptionDates,
  formatPlanPrice,
} from '../helpers/subscriptionHelpers'
import { addonSubtotalCents, mealALaCarteCents, mealsExact, totalQty } from '../helpers/subscriptionCart'

const HST_RATE = 0.13

const SubscribeCart = ({ user, subCart }) => {
  const navigate = useNavigate()
  const [dates, setDates] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState(null)
  const [hasExistingSub, setHasExistingSub] = useState(false)

  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  const [specialNote, setSpecialNote] = useState('')
  const [fulfillment, setFulfillment] = useState('pickup')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [postalValid, setPostalValid] = useState(false)
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [quoteStatus, setQuoteStatus] = useState('idle')
  const [promoInput, setPromoInput] = useState('')
  const [promoResult, setPromoResult] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [lastValidatedCode, setLastValidatedCode] = useState('')

  useEffect(() => {
    if (!subCart.planId) {
      navigate('/subscribe-and-save', { replace: true })
      return
    }
    if (!mealsExact(subCart)) {
      navigate(`/subscribe/${subCart.planId}/meals`, { replace: true })
    }
  }, [subCart, navigate])

  useEffect(() => {
    let cancelled = false
    fetchSubscriptionDates()
      .then((nextDates) => {
        if (!cancelled) setDates(nextDates)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setHasExistingSub(false)
      return
    }
    let cancelled = false
    fetchMySubscriptions(user.id)
      .then((rows) => {
        if (!cancelled) setHasExistingSub((rows || []).length > 0)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setHasExistingSub(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (fulfillment === 'pickup') {
      setDeliveryDate('')
      setPostalCode('')
      setPostalValid(false)
      setDeliveryFeeCents(0)
      setQuoteStatus('idle')
    } else if (fulfillment === 'delivery') {
      setPickupDate('')
      setPickupTime('')
    }
  }, [fulfillment])

  useEffect(() => {
    if (fulfillment !== 'delivery' || !postalValid) {
      setQuoteStatus('idle')
      setDeliveryFeeCents(0)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setQuoteStatus('loading')
        const resp = await fetch('/api/delivery/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postalCode }),
        })
        const data = await resp.json().catch(() => ({}))
        if (cancelled) return
        if (resp.ok && data?.ok) {
          setDeliveryFeeCents(data.fee_cents || 0)
          setQuoteStatus('ok')
        } else if (data?.reason === 'OUT_OF_ZONE') {
          setDeliveryFeeCents(0)
          setQuoteStatus('out')
        } else {
          setDeliveryFeeCents(0)
          setQuoteStatus('error')
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setDeliveryFeeCents(0)
          setQuoteStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fulfillment, postalCode, postalValid])

  const planCents = Number(subCart.priceCents) || 0
  const addonCents = addonSubtotalCents(subCart)
  const discountableCents = planCents + addonCents
  const savedCents = Math.max(0, mealALaCarteCents(subCart) - planCents)

  let promoDiscountCents = 0
  if (promoResult?.valid && promoResult.discountPercentage != null) {
    const rate = promoResult.discountPercentage / 100
    promoDiscountCents = Math.min(
      Math.round(discountableCents * rate),
      discountableCents
    )
  }

  const itemsAfterPromo = Math.max(0, discountableCents - promoDiscountCents)
  const deliveryCents = fulfillment === 'delivery' ? deliveryFeeCents : 0
  const totalBeforeTaxCents = itemsAfterPromo + deliveryCents
  const taxCents = Math.round(totalBeforeTaxCents * HST_RATE)
  const grandTotalCents = totalBeforeTaxCents + taxCents
  const lockedDate = dates?.first_delivery_date || ''

  const handleApplyPromo = async () => {
    const code = (promoInput || '').trim()
    if (!code) {
      setPromoResult({ valid: false, message: 'Enter a code.' })
      return
    }
    setPromoLoading(true)
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          subtotalCents: discountableCents,
          userId: user?.id || null,
        }),
      })
      const data = await res.json()
      setPromoResult(data)
      setLastValidatedCode(code)
    } catch (err) {
      console.error(err)
      setPromoResult({ valid: false, message: 'Could not validate code. Try again.' })
    } finally {
      setPromoLoading(false)
    }
  }

  const fulfillmentReady =
    fulfillment === 'pickup'
      ? Boolean(pickupDate && pickupTime)
      : postalValid &&
        quoteStatus === 'ok' &&
        deliveryFeeCents > 0 &&
        Boolean(deliveryDate) &&
        specialNote.trim().length >= 8

  const handleConfirm = () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent('/subscribe/cart')}`)
      return
    }
    if (!agreedToPrivacy || !fulfillmentReady) return
    setDialog({
      icon: 'mail',
      title: 'Payment is next',
      body: 'Your box is ready. Charging the card is the next step — nothing has been billed yet.',
      primaryLabel: 'Got it',
    })
  }

  if (isLoading) {
    return (
      <div
        className="loading-container"
        style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Lottie animationData={loadingAnimation} loop />
      </div>
    )
  }

  return (
    <div className="checkout-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">
          <div className="checkout-order-summary">
            <p className="checkout-summary-text">Your box</p>
            <p className="number-of-items">
              {subCart.planName} · {subCart.mealCount} meals
            </p>

            <div className="general-text" style={{ margin: '10px 0 16px' }}>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  name="sub-fulfillment"
                  value="pickup"
                  checked={fulfillment === 'pickup'}
                  onChange={() => setFulfillment('pickup')}
                />{' '}
                Pickup
              </label>
              <label>
                <input
                  type="radio"
                  name="sub-fulfillment"
                  value="delivery"
                  checked={fulfillment === 'delivery'}
                  onChange={() => setFulfillment('delivery')}
                />{' '}
                Delivery
              </label>
            </div>

            <div className="promo-wrap general-text">
              <div className="promo-row">
                <input
                  id="sub-promo"
                  type="text"
                  value={promoInput}
                  onChange={(e) => {
                    const next = e.target.value
                    setPromoInput(next)
                    if (!next.trim() || next.trim().toLowerCase() !== (lastValidatedCode || '').toLowerCase()) {
                      setPromoResult(null)
                    }
                  }}
                  placeholder="Have a promo code?"
                  autoComplete="off"
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

            <div className="checkout-summary-subtotal">
              <p className="subtotal">Plan</p>
              <p className="subtotal">{formatPlanPrice(planCents)}</p>
            </div>
            <div className="checkout-summary-subtotal">
              <p className="subtotal">Add-ons</p>
              <p className="subtotal">${(addonCents / 100).toFixed(2)}</p>
            </div>
            {promoResult?.valid ? (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">
                  {promoResult.kind === 'referral' ? 'Referral' : 'Promo'} ({promoResult.code})
                </p>
                <p className="subtotal">- ${(promoDiscountCents / 100).toFixed(2)}</p>
              </div>
            ) : null}
            {savedCents > 0 ? (
              <p className="subscribe-helper">
                You saved ${(savedCents / 100).toFixed(2)} by ordering a subscription plan.
              </p>
            ) : null}

            {fulfillment === 'delivery' ? (
              <>
                <div className="checkout-summary-subtotal">
                  <p className="subtotal">Delivery fee (pre-tax)</p>
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

            <div className="checkout-summary-tax">
              <p className="tax">HST (13%)</p>
              <p className="tax">${(taxCents / 100).toFixed(2)}</p>
            </div>
            <div className="checkout-total">
              <p className="total">Total for this week</p>
              <p className="total">${(grandTotalCents / 100).toFixed(2)}</p>
            </div>

            {dates ? (
              <div className="subscribe-dates-block general-text">
                <p>Next cutoff: {dates.cutoff_label}</p>
                <p>First delivery: {dates.first_delivery_label}</p>
                {dates.cutoff_passed ? (
                  <p>This week&apos;s cutoff has passed. This Sunday is not available.</p>
                ) : null}
              </div>
            ) : null}

            <p className="subscribe-recurring general-text">
              Your plan renews automatically every week. You can change your meals anytime before Thursday at 5:00 PM, manage or cancel anytime from My Subscriptions.
            </p>

            {fulfillment === 'pickup' ? (
              <PickupSelector
                pickupDate={pickupDate}
                pickupTime={pickupTime}
                onDateChange={setPickupDate}
                onTimeChange={setPickupTime}
                lockedDate={lockedDate}
              />
            ) : (
              <DeliverySelector
                postalCode={postalCode}
                onPostalCodeChange={setPostalCode}
                feeCents={deliveryFeeCents}
                onValidate={({ valid }) => setPostalValid(valid)}
                deliveryDate={deliveryDate}
                onDeliveryDateChange={setDeliveryDate}
                lockedDate={lockedDate}
              />
            )}

            <div className="special-note-container">
              <label htmlFor="sub-special-note" className="general-text">Special Instructions </label>
              <textarea
                className="special-note-input"
                id="sub-special-note"
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

            <div className="general-text">
              <input
                type="checkbox"
                id="sub-privacy-agree"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              />
              <label htmlFor="sub-privacy-agree">
                I have read and agree to the <Link className="footer-account-register" to="/privacy">Privacy Policy</Link>.
              </label>
            </div>

            {user && hasExistingSub ? (
              <p className="subscribe-existing-note">
                This will be added as a new subscription. It will not change your existing plan.
              </p>
            ) : null}

            <button
              type="button"
              className="checkout-button"
              disabled={user ? (!agreedToPrivacy || !fulfillmentReady) : false}
              onClick={handleConfirm}
            >
              {user ? 'Confirm & Subscribe' : 'Sign in to subscribe'}
            </button>
          </div>

          <div className="checkout-items">
            <p className="subscribe-list-heading">Meals</p>
            <p className="subscribe-helper">
              <Link className="subscribe-inline-link" to={`/subscribe/${subCart.planId}/meals`}>
                Edit meals
              </Link>
            </p>
            {subCart.meals.map((item) => (
              <div className="checkout-items-container" key={`meal-${item.id}`}>
                <img src={item.image_url} className="checkout-product-image" alt={item.slug} />
                <div className="checkout-item-details">
                  <p className="checkout-item-title">{item.slug}</p>
                  <p className="checkout-item-price">
                    Included · qty {item.quantity}
                  </p>
                </div>
              </div>
            ))}

            <p className="subscribe-list-heading">Add-ons</p>
            <p className="subscribe-helper">
              <Link className="subscribe-inline-link" to={`/subscribe/${subCart.planId}/addons`}>
                Edit add-ons
              </Link>
            </p>
            {subCart.addons.length === 0 ? (
              <p className="general-text">No add-ons this week.</p>
            ) : (
              subCart.addons.map((item) => (
                <div className="checkout-items-container" key={`addon-${item.id}`}>
                  <img src={item.image_url} className="checkout-product-image" alt={item.slug} />
                  <div className="checkout-item-details">
                    <p className="checkout-item-title">{item.slug}</p>
                    <p className="checkout-item-price">
                      ${((item.price_cents * item.quantity) / 100).toFixed(2)} · qty {item.quantity}
                    </p>
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
}

export default SubscribeCart

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
  startSubscriptionCheckout,
} from '../helpers/subscriptionHelpers'
import { addonSubtotalCents, mealALaCarteCents, mealsExact, totalQty } from '../helpers/subscriptionCart'

const HST_RATE = 0.13

function formatLockedDateLabel(yyyyMmDd) {
  if (!yyyyMmDd) return ''
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const n = date.getDate()
  const v = n % 100
  const ordinal = v >= 11 && v <= 13
    ? `${n}th`
    : n % 10 === 1
      ? `${n}st`
      : n % 10 === 2
        ? `${n}nd`
        : n % 10 === 3
          ? `${n}rd`
          : `${n}th`
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  return `${weekday}, ${month} ${ordinal}`
}

function CartQtyStepper({ name, quantity, onMinus, onPlus, plusDisabled = false }) {
  return (
    <div className="subscribe-cart-qty">
      <button
        type="button"
        className="checkout-cart-popup-remove-button"
        onClick={onMinus}
        aria-label={`Decrease ${name}`}
      >
        -
      </button>
      <p className="checkout-item-quantity">{quantity}</p>
      <button
        type="button"
        className="checkout-cart-popup-add-button"
        onClick={onPlus}
        disabled={plusDisabled}
        aria-label={`Increase ${name}`}
      >
        +
      </button>
    </div>
  )
}

const SubscribeCart = ({ user, subCart, bumpSubMeal, bumpSubAddon }) => {
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
  const [isPaying, setIsPaying] = useState(false)

  useEffect(() => {
    if (!subCart.planId) {
      navigate('/subscribe-and-save', { replace: true })
      return
    }
    if (!mealsExact(subCart) && totalQty(subCart.meals) === 0) {
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
    if (!hasExistingSub) return
    setDialog((prev) => prev || {
      icon: 'alert',
      title: 'You already have a weekly plan',
      body: [
        'Continuing creates a second subscription — you\'ll be billed for both.',
        <>
          Want to change your current plan instead?{' '}
          <Link className="feedback-dialog-secondary" to="/my-subscriptions">
            Manage subscriptions
          </Link>
        </>,
      ],
      primaryLabel: 'Got it',
    })
  }, [hasExistingSub])

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
    if (fulfillment !== 'delivery') return
    setQuoteStatus('idle')
    setDeliveryFeeCents(0)
  }, [postalCode, fulfillment])

  const handleQuoteDelivery = async () => {
    if (fulfillment !== 'delivery' || !postalValid) return
    setQuoteStatus('loading')
    setDeliveryFeeCents(0)
    try {
      const resp = await fetch('/api/delivery/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCode }),
      })
      const data = await resp.json().catch(() => ({}))
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
      setDeliveryFeeCents(0)
      setQuoteStatus('error')
    }
  }

  const planCents = Number(subCart.priceCents) || 0
  const addonCents = addonSubtotalCents(subCart)
  const discountableCents = planCents
  const savedCents = Math.max(0, mealALaCarteCents(subCart) - planCents)

  let promoDiscountCents = 0
  if (promoResult?.valid && promoResult.discountPercentage != null) {
    const rate = promoResult.discountPercentage / 100
    promoDiscountCents = Math.min(
      Math.round(discountableCents * rate),
      discountableCents
    )
  }

  const planAfterPromo = Math.max(0, planCents - promoDiscountCents)
  const deliveryCents = fulfillment === 'delivery' ? deliveryFeeCents : 0
  const withHst = (cents) => Math.round((Number(cents) || 0) * (1 + HST_RATE))
  const planDueCents = withHst(planAfterPromo)
  const deliveryDueCents = deliveryCents > 0 ? withHst(deliveryCents) : 0
  const dueTodayCents = planDueCents + deliveryDueCents
  const addonPromoCents = promoResult?.valid && promoResult.discountPercentage != null
    ? Math.min(Math.round(addonCents * (promoResult.discountPercentage / 100)), addonCents)
    : 0
  const addonAfterPromo = Math.max(0, addonCents - addonPromoCents)
  const addonThursdayCents = addonAfterPromo > 0 ? withHst(addonAfterPromo) : 0
  const taxCents = Math.max(
    0,
    planDueCents - planAfterPromo
      + deliveryDueCents - deliveryCents
      + addonThursdayCents - addonAfterPromo
  )
  const totalCents = dueTodayCents + addonThursdayCents
  const lockedDate = dates?.first_delivery_date || ''
  const lockedDeliveryLabel = formatLockedDateLabel(lockedDate)

  const openSubscriptionDetails = () => {
    setDialog({
      icon: 'alert',
      title: 'Subscription details',
      asList: true,
      body: [
        'Every plan lets you choose any combination of bowls, salads, and main plates.',
        'Your subscription is charged every Wednesday; add-ons are charged at the Thursday 5:00 PM EST lock cutoff for that week\'s box.',
        'If you don\'t make changes on time, we\'ll send your previous week\'s selections.',
        'Pause or cancel by Wednesday, no fees.',
        dates?.first_delivery_label ? `First delivery: ${dates.first_delivery_label}.` : null,
        'Add-ons are for this week only. They do not repeat unless you add them again.',
        'You can change meals, extras, and pickup or delivery in My Subscriptions until the Thursday cutoff.',
      ].filter(Boolean),
      hint: (
        <>
          All subscription information, rules, and terms are in the{' '}
          <Link className="feedback-dialog-secondary" to="/privacy">
            Privacy Policy
          </Link>
          .
        </>
      ),
      primaryLabel: 'Got it',
    })
  }

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

  const missingCheckoutItems = () => {
    const missing = []
    if (!mealsExact(subCart)) {
      missing.push(`Choose exactly ${subCart.mealCount} meals before confirming.`)
    }
    if (fulfillment === 'pickup') {
      if (!pickupTime) missing.push('Select a pickup time.')
      if (!pickupDate) missing.push('Pickup date is missing.')
    } else {
      if (!postalValid) {
        missing.push('Enter a valid postal code.')
      } else if (quoteStatus === 'out') {
        missing.push('Delivery is not available for this postal code.')
      } else if (quoteStatus !== 'ok' || deliveryFeeCents <= 0) {
        missing.push('Calculate the delivery fee.')
      }
      if (!deliveryDate) missing.push('Delivery date is missing.')
      if (specialNote.trim().length < 8) {
        missing.push('Add your full delivery address in Special Instructions.')
      }
    }
    if (!agreedToPrivacy) {
      missing.push('Agree to the Privacy Policy to continue.')
    }
    return missing
  }

  const handleConfirm = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent('/subscribe/cart')}`)
      return
    }
    if (isPaying) return
    const missing = missingCheckoutItems()
    if (missing.length) {
      setDialog({
        icon: 'alert',
        title: missing.length === 1 ? 'One more step' : 'A few things are missing',
        asList: missing.length > 1,
        body: missing.length === 1 ? missing[0] : missing,
        primaryLabel: 'Got it',
      })
      return
    }
    setIsPaying(true)
    try {
      const data = await startSubscriptionCheckout({
        userId: user.id,
        email: user.email,
        planId: subCart.planId,
        meals: subCart.meals.map((item) => ({ id: item.id, quantity: item.quantity })),
        addons: subCart.addons.map((item) => ({ id: item.id, quantity: item.quantity })),
        delivery: fulfillment === 'delivery',
        delivery_postal_code: postalCode,
        pickup_time_slot: pickupTime,
        special_note: specialNote,
        promoCode: promoResult?.valid ? lastValidatedCode : '',
      })
      if (!data?.url) {
        throw new Error('Checkout did not return a payment link.')
      }
      window.location.href = data.url
    } catch (err) {
      console.error(err)
      setIsPaying(false)
      setDialog({
        icon: 'alert',
        title: 'Could not start payment',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    }
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
    <div className="checkout-page subscribe-cart-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">
          <div className="checkout-order-summary">
            <div className="subscribe-checkout-hero">
              <p className="checkout-summary-text">Review &amp; Confirm</p>
              {savedCents > 0 ? (
                <p className="subscribe-cart-savings-pill">
                  You&apos;re saving ${(savedCents / 100).toFixed(0)} with your subscription.
                </p>
              ) : null}
            </div>

            <div className="subscribe-summary-heading-row">
              <p className="subscribe-summary-heading">Weekly Subscription</p>
              <button
                type="button"
                className="subscribe-terms-link"
                onClick={openSubscriptionDetails}
              >
                Subscription terms
              </button>
            </div>
            <div className="checkout-summary-subtotal">
              <p className="subtotal">
                {subCart.mealCount} {Number(subCart.mealCount) === 1 ? 'meal' : 'meals'} plan
              </p>
              <p className="subtotal">
                {formatPlanPrice(planCents)}
                <span className="subscribe-hst-hint"> + hst</span>
              </p>
            </div>
            {fulfillment === 'delivery' ? (
              <>
                <div className="checkout-summary-subtotal">
                  <p className="subtotal">Delivery fee</p>
                  <p className="subtotal">
                    {quoteStatus === 'loading'
                      ? 'Calculating...'
                      : deliveryFeeCents > 0
                        ? <>{formatPlanPrice(deliveryFeeCents)}<span className="subscribe-hst-hint"> + hst</span></>
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
            {subCart.addons.length > 0 ? (
              <>
                <p className="subscribe-summary-heading">Add-ons</p>
                {subCart.addons.map((item) => (
                  <div className="checkout-summary-subtotal" key={`sum-addon-${item.id}`}>
                    <p className="subtotal">
                      {item.slug}
                      {` × ${item.quantity}`}
                    </p>
                    <p className="subtotal">
                      ${((item.price_cents * item.quantity) / 100).toFixed(2)}
                      <span className="subscribe-hst-hint"> + hst</span>
                    </p>
                  </div>
                ))}
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

            <div className="checkout-summary-tax">
              <p className="tax">HST</p>
              <p className="tax">{formatPlanPrice(taxCents)}</p>
            </div>
            <div className="checkout-total">
              <p className="total">Total</p>
              <p className="total">{formatPlanPrice(totalCents)}</p>
            </div>
            {addonThursdayCents > 0 ? (
              <>
                <div className="checkout-summary-subtotal subscribe-due-row">
                  <p className="subtotal">Due today</p>
                  <p className="subtotal">{formatPlanPrice(dueTodayCents)}</p>
                </div>
                <div className="checkout-summary-subtotal">
                  <p className="subtotal">Add-ons billed on cutoff date</p>
                  <p className="subtotal">{formatPlanPrice(addonThursdayCents)}</p>
                </div>
              </>
            ) : null}

            <div className="subscribe-fulfill-block">
              <p className="subscribe-summary-heading">How you&apos;ll get it</p>
              <div className="general-text subscribe-fulfill-row">
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

              {fulfillment === 'pickup' ? (
                <PickupSelector
                  pickupDate={pickupDate}
                  pickupTime={pickupTime}
                  onDateChange={setPickupDate}
                  onTimeChange={setPickupTime}
                  lockedDate={lockedDate}
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
                  lockedDate={lockedDate}
                  showReviewNotes={false}
                  onCalculate={handleQuoteDelivery}
                  calculateLoading={quoteStatus === 'loading'}
                  showDateField={false}
                />
              )}
            </div>

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
            {fulfillment === 'delivery' && lockedDeliveryLabel ? (
              <p className="pickup-label subscribe-locked-date">
                Delivery Date
                <span className="pickup-label-date">
                  {' '}
                  - {lockedDeliveryLabel}, between 11:00 AM and 6:00 PM
                </span>
              </p>
            ) : null}

            <div className="promo-wrap general-text">
              <p className="subscribe-summary-heading">Promo code</p>
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

            <div className="subscribe-checkout-consent">
              <input
                type="checkbox"
                id="sub-privacy-agree"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              />
              <label htmlFor="sub-privacy-agree">
                I agree to the <Link className="footer-account-register" to="/privacy">Privacy Policy</Link> and understand orders are final once payment is processed.
              </label>
            </div>

            <button
              type="button"
              className="checkout-button"
              disabled={Boolean(user) && isPaying}
              onClick={handleConfirm}
            >
              {user ? (isPaying ? 'Redirecting…' : 'Confirm & Subscribe') : 'Sign in to subscribe'}
            </button>
          </div>

          <div className="checkout-items subscribe-cart-items">
            <div className="subscribe-cart-heading-row">
              <p className="subscribe-list-heading">Your Weekly Plan</p>
              <Link className="subscribe-inline-link" to={`/subscribe/${subCart.planId}/meals`}>
                Edit meals
              </Link>
            </div>
            {subCart.meals.map((item) => (
              <div className="checkout-items-container" key={`meal-${item.id}`}>
                <img src={item.image_url} className="checkout-product-image" alt={item.slug} />
                <div className="checkout-item-details">
                  <p className="checkout-item-title">
                    {item.slug}
                    <CartQtyStepper
                      name={item.slug}
                      quantity={item.quantity}
                      onMinus={() => bumpSubMeal(item, -1)}
                      onPlus={() => bumpSubMeal(item, 1)}
                      plusDisabled={totalQty(subCart.meals) >= subCart.mealCount}
                    />
                  </p>
                </div>
              </div>
            ))}

            <div className="subscribe-cart-heading-row">
              <p className="subscribe-list-heading">This Week Add-ons</p>
              <Link className="subscribe-inline-link" to={`/subscribe/${subCart.planId}/addons`}>
                Edit add-ons
              </Link>
            </div>
            {subCart.addons.length === 0 ? (
              <p className="general-text">No add-ons this week.</p>
            ) : (
              subCart.addons.map((item) => (
                <div className="checkout-items-container" key={`addon-${item.id}`}>
                  <img src={item.image_url} className="checkout-product-image" alt={item.slug} />
                  <div className="checkout-item-details">
                    <p className="checkout-item-title">
                      {item.slug}
                      <CartQtyStepper
                        name={item.slug}
                        quantity={item.quantity}
                        onMinus={() => bumpSubAddon(item, -1)}
                        onPlus={() => bumpSubAddon(item, 1)}
                      />
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

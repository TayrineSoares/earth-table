import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import {
  fetchSubscriptionSignup,
  formatCutoffShort,
  formatPickupSlot,
  formatPlanPrice,
  mealsAWeek,
} from '../helpers/subscriptionHelpers'
import { formatYmdLong, PICKUP_ADDRESS } from '../helpers/orderHelpers'
import '../styles/Cart.css'
import '../styles/Confirmation.css'
import '../styles/SubscribeFlow.css'

const POLL_MS = 1000
const POLL_TRIES = 20

export default function SubscribeConfirmation({ clearSubCart }) {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') || ''
  const navigate = useNavigate()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (!sessionId) {
      setErrMsg('Missing session id.')
      setLoading(false)
      return
    }
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    clearSubCart?.()

    let cancelled = false
    let tries = 0

    const poll = async () => {
      try {
        const data = await fetchSubscriptionSignup(sessionId)
        if (cancelled) return
        if (data?.ready && data.subscription) {
          setPayload(data)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('[subscribe confirmation]', err)
        if (cancelled) return
      }

      tries += 1
      if (tries >= POLL_TRIES) {
        if (!cancelled) {
          setErrMsg('Payment went through, but your plan is still saving. Check My Subscriptions in a minute, or email hello@earthtableco.ca.')
          setLoading(false)
        }
        return
      }
      setTimeout(poll, POLL_MS)
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop />
      </div>
    )
  }

  if (errMsg) {
    return (
      <div className="checkout-page">
        <div className="page-wrapper">
          <div className="checkout-page-container">
            <div>
              <p className="checkout-summary-text">Almost there</p>
              <p className="number-of-items">{errMsg}</p>
              <button type="button" onClick={() => navigate('/my-subscriptions')} className="checkout-button">
                My Subscriptions
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const sub = payload?.subscription || {}
  const cycle = payload?.cycle || {}
  const plan = sub.subscription_plans || {}
  const customer = payload?.customer || {}
  const firstName = customer.first_name || ''
  const email = customer.email || ''
  const isDelivery = !!cycle.delivery
  const sunday = formatYmdLong(cycle.delivery_date || cycle.pickup_date)
  const items = Array.isArray(cycle.subscription_cycle_items) ? cycle.subscription_cycle_items : []
  const planItems = items.filter((item) => item.kind === 'plan')
  const addonItems = items.filter((item) => item.kind === 'addon')
  const cutoffShort = formatCutoffShort(cycle.cutoff_at)
  const slotLabel = isDelivery ? '11:00 AM – 6:00 PM' : formatPickupSlot(cycle.pickup_time_slot)

  return (
    <div className="checkout-page subscribe-confirm-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">
          <div className="checkout-order-summary subscribe-confirm-copy">
            <p className="checkout-summary-text">
              {firstName ? `Thank you, ${firstName}` : 'Thank you'}
            </p>
            <p className="subscribe-confirm-lead">We&apos;re so glad you&apos;re here.</p>
            <p className="subscribe-confirm-body">
              Your first box is {sunday || 'Sunday'} — here&apos;s what happens next.
            </p>
            <p className="subscribe-confirm-body">
              You can still change your meals. Swap anything, add extras like smoothies, sides, or snacks, or switch to delivery anytime until {cutoffShort}.
            </p>

            <button type="button" onClick={() => navigate('/my-subscriptions')} className="checkout-button">
              Manage my subscription
            </button>

            {email ? (
              <p className="subscribe-confirm-email">
                We&apos;ve emailed your confirmation to {email}.
              </p>
            ) : null}
            <p className="subscribe-confirm-signoff">
              Thank you for trusting us with your meals.
              <br />
              Selena &amp; the Earth Table team
            </p>
          </div>

          <div className="checkout-items subscribe-cart-items subscribe-confirm-side">
            <p className="subscribe-confirm-kicker">Your plan</p>
            <p className="subscribe-confirm-plan">{mealsAWeek(plan.meal_count)}</p>
            <p className="subscribe-confirm-meta">
              {formatPlanPrice(plan.price_cents)}/week · plan paid today
            </p>
            <p className="subscribe-confirm-meta">Renews every Thursday</p>

            <p className="subscribe-confirm-kicker">{isDelivery ? 'Delivery' : 'Pickup'}</p>
            <p className="subscribe-confirm-plan">{sunday || 'Sunday'}</p>
            <p className="subscribe-confirm-meta">{slotLabel || '—'}</p>
            {isDelivery ? (
              cycle.delivery_postal_code ? (
                <p className="subscribe-confirm-meta">{cycle.delivery_postal_code}</p>
              ) : null
            ) : (
              <p className="subscribe-confirm-meta">{PICKUP_ADDRESS}</p>
            )}

            <p className="subscribe-confirm-kicker">Change by</p>
            <p className="subscribe-confirm-meta">{cutoffShort}</p>

            {planItems.map((item) => (
              <div className="checkout-items-container" key={`plan-${item.id}`}>
                {item.products?.image_url ? (
                  <img src={item.products.image_url} className="checkout-product-image" alt="" />
                ) : (
                  <div className="checkout-product-image" style={{ background: '#f2f2f2' }} />
                )}
                <div className="checkout-item-details">
                  <p className="checkout-item-title">{item.products?.slug || 'Meal'}</p>
                  {item.quantity > 1 ? (
                    <p className="checkout-item-price">qty {item.quantity}</p>
                  ) : null}
                </div>
              </div>
            ))}
            {addonItems.map((item) => (
              <div className="checkout-items-container" key={`addon-${item.id}`}>
                {item.products?.image_url ? (
                  <img src={item.products.image_url} className="checkout-product-image" alt="" />
                ) : (
                  <div className="checkout-product-image" style={{ background: '#f2f2f2' }} />
                )}
                <div className="checkout-item-details">
                  <p className="checkout-item-title">{item.products?.slug || 'Add-on'}</p>
                  <p className="checkout-item-price">
                    {item.quantity > 1
                      ? `Add-on · qty ${item.quantity} · billed Thursday`
                      : 'Add-on · billed Thursday'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

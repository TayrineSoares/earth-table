import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import { fetchSubscriptionSignup, formatPlanPrice } from '../helpers/subscriptionHelpers'
import { formatYmdLong, PICKUP_ADDRESS } from '../helpers/orderHelpers'
import '../styles/Cart.css'
import '../styles/Confirmation.css'

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
        // Keep polling a bit — webhook may still be writing.
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
  const isDelivery = !!cycle.delivery
  const sunday = formatYmdLong(cycle.delivery_date || cycle.pickup_date)
  const items = Array.isArray(cycle.subscription_cycle_items) ? cycle.subscription_cycle_items : []
  const planItems = items.filter((item) => item.kind === 'plan')
  const addonItems = items.filter((item) => item.kind === 'addon')

  return (
    <div className="checkout-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">
          <div className="checkout-order-summary">
            <p className="checkout-summary-text">You&apos;re subscribed</p>
            <p className="number-of-items">
              {plan.name || 'Your plan'} · {formatPlanPrice(plan.price_cents)}/week
            </p>

            <div className="confirmation-fulfillment">
              {isDelivery ? (
                <>
                  <p className="confirmation-note">First delivery {sunday || 'Sunday'}</p>
                  <p className="confirmation-note">Between 11:00 AM and 6:00 PM</p>
                </>
              ) : (
                <>
                  <p className="confirmation-note">
                    First pickup {sunday || 'Sunday'}, between {cycle.pickup_time_slot || '—'}
                  </p>
                  <p className="confirmation-note">{PICKUP_ADDRESS}</p>
                </>
              )}
              <p className="confirmation-note">
                You can still change this week&apos;s meals until Thursday at 5:00 PM.
              </p>
            </div>

            <button type="button" onClick={() => navigate('/my-subscriptions')} className="checkout-button">
              My Subscriptions
            </button>
          </div>

          <div className="checkout-items">
            {planItems.map((item) => (
              <div className="checkout-items-container" key={`plan-${item.id}`}>
                {item.products?.image_url ? (
                  <img src={item.products.image_url} className="checkout-product-image" alt="" />
                ) : (
                  <div className="checkout-product-image" style={{ background: '#f2f2f2' }} />
                )}
                <div className="checkout-item-details">
                  <p className="checkout-item-title">{item.products?.slug || 'Meal'}</p>
                  <p className="checkout-item-price">Included · qty {item.quantity}</p>
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
                  <p className="checkout-item-price">Add-on · qty {item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

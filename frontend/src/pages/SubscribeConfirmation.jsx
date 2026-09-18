import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import {
  fetchSubscriptionSignup,
  formatCutoffShort,
  formatPlanPrice,
  mealsAWeek,
} from '../helpers/subscriptionHelpers'
import { formatYmdLong } from '../helpers/orderHelpers'
import '../styles/Cart.css'
import '../styles/Confirmation.css'

const POLL_MS = 1000
const POLL_TRIES = 20

/** "Sunday, September 27, 2026" -> "Sunday, September 27" */
function sundayLabel(ymd) {
  const full = formatYmdLong(ymd)
  return full.replace(/, \d{4}$/, '') || 'Sunday'
}

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
  const mealCount = Number(plan.meal_count) || 0
  const sunday = sundayLabel(cycle.delivery_date || cycle.pickup_date)
  const cutoffShort = formatCutoffShort(cycle.cutoff_at)
  const heading = firstName
    ? `Your weekly plan is set, ${firstName}`
    : 'Your weekly plan is set'

  return (
    <div className="checkout-page subscribe-confirm-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">
          <div className="checkout-order-summary subscribe-confirm-copy">
            <p className="checkout-summary-text">{heading}</p>
            <p className="subscribe-confirm-lead">
              Thank you for subscribing — we&apos;re so glad you&apos;re here. Your first box is {sunday}.
            </p>

            <div className="subscribe-confirm-plan-block">
              <p className="subscribe-confirm-kicker">Your plan</p>
              <p className="subscribe-confirm-plan">
                {mealsAWeek(mealCount)}
                {mealCount ? ` — all ${mealCount} selected` : ''}
              </p>
              <p className="subscribe-confirm-meta">
                {formatPlanPrice(plan.price_cents)} · paid today · Renews every Thursday
              </p>
              <p className="subscribe-confirm-meta">
                Change by {cutoffShort}
              </p>
            </div>

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
        </div>
      </div>
    </div>
  )
}

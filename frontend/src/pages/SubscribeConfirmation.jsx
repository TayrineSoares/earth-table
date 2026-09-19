import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import {
  fetchSubscriptionSignup,
  formatCutoffShort,
  formatPickupSlot,
  formatPlanPrice,
} from '../helpers/subscriptionHelpers'
import { DELIVERY_WINDOW, formatYmdLong, PICKUP_ADDRESS } from '../helpers/orderHelpers'
import '../styles/Cart.css'
import '../styles/Confirmation.css'

const POLL_MS = 1000
const POLL_TRIES = 20
const RENEWAL_DAY = 'Wednesday'

/** "Sunday, September 27, 2026" -> "Sunday, September 27" */
function sundayLabel(ymd) {
  const full = formatYmdLong(ymd)
  return full.replace(/, \d{4}$/, '') || 'Sunday'
}

function weekdayFromYmd(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  if (!y || !m || !d) return 'Sunday'
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}

function splitWindow(label) {
  const parts = String(label || '').split(/\s*[–-]\s*/)
  if (parts.length >= 2) {
    return { start: parts[0].trim(), end: parts.slice(1).join(' – ').trim() }
  }
  return { start: String(label || '—').trim(), end: '' }
}

/** First box is Sunday; next weekly charge is that week's Wednesday. */
function wednesdayAfterSunday(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  if (!y || !m || !d) return RENEWAL_DAY
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 3)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
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
  const ymd = cycle.delivery_date || cycle.pickup_date
  const fulfillmentDate = sundayLabel(ymd)
  const weekday = weekdayFromYmd(ymd)
  const cutoffDateTime = formatCutoffShort(cycle.cutoff_at)
  const isDelivery = !!(cycle.delivery ?? sub.delivery)
  const windowLabel = isDelivery
    ? DELIVERY_WINDOW
    : (formatPickupSlot(cycle.pickup_time_slot) || DELIVERY_WINDOW)
  const { start: windowStart, end: windowEnd } = splitWindow(windowLabel)
  const windowRange = windowEnd ? `${windowStart} – ${windowEnd}` : windowStart
  const note = String(cycle.special_note || '').trim()
  const postal = cycle.delivery_postal_code || customer.postal_code || ''
  const price = formatPlanPrice(plan.price_cents)
  const nextChargeDate = wednesdayAfterSunday(ymd)
  const heading = firstName
    ? `Your weekly plan is set, ${firstName}`
    : 'Your weekly plan is set'

  return (
    <div className="checkout-page subscribe-confirm-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper subscribe-confirm-shell">
        <div className="subscribe-confirm-layout">
          <div className="subscribe-confirm-prose">
            <h1 className="subscribe-confirm-h1">{heading}</h1>
            <p className="subscribe-confirm-intro">
              Thank you for subscribing — we&apos;re so glad you&apos;re here. Your first box is{' '}
              <strong>{fulfillmentDate}</strong>.
            </p>

            <section className="subscribe-confirm-next">
              <h2 className="subscribe-confirm-h2">What happens next</h2>
              <ol className="subscribe-confirm-steps">
                <li className="subscribe-confirm-step">
                  <span className="subscribe-confirm-step-num" aria-hidden="true">01</span>
                  <div>
                    <p className="subscribe-confirm-step-lead">Your meals are locked in Thursday.</p>
                    <p className="subscribe-confirm-step-body">
                      You&apos;ve picked all {mealCount || 'your meals'}, so there&apos;s nothing you need to do.
                      Until {cutoffDateTime} you can swap meals or add extras — smoothies, sides, snacks, anything on the menu — all from{' '}
                      <Link className="subscribe-confirm-inline-link" to="/my-subscriptions">
                        Manage my subscription
                      </Link>
                      .
                    </p>
                  </div>
                </li>
                <li className="subscribe-confirm-step">
                  <span className="subscribe-confirm-step-num" aria-hidden="true">02</span>
                  <div>
                    <p className="subscribe-confirm-step-lead">We cook fresh after the cutoff.</p>
                    <p className="subscribe-confirm-step-body">
                      Everything is made once your week is final — organic, seed oil free, gluten free, with grass-fed and pasture-raised meat and dairy.
                    </p>
                  </div>
                </li>
                <li className="subscribe-confirm-step">
                  <span className="subscribe-confirm-step-num" aria-hidden="true">03</span>
                  <div>
                    <p className="subscribe-confirm-step-lead">Your box is ready {weekday}.</p>
                    <p className="subscribe-confirm-step-body">
                      {isDelivery
                        ? `At your door between ${windowStart} and ${windowEnd}.`
                        : `Labeled and waiting at ${PICKUP_ADDRESS} between ${windowStart} and ${windowEnd}.`}
                    </p>
                  </div>
                </li>
                <li className="subscribe-confirm-step">
                  <span className="subscribe-confirm-step-num" aria-hidden="true">04</span>
                  <div>
                    <p className="subscribe-confirm-step-lead">It repeats, unless you say otherwise.</p>
                    <p className="subscribe-confirm-step-body">
                      Don&apos;t have time to pick? We&apos;ll repeat last week&apos;s selection.
                      Pause or cancel any time before Wednesday at 9:00 AM ET, no fees.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <div className="subscribe-confirm-actions">
              <button
                type="button"
                className="subscribe-confirm-primary"
                onClick={() => navigate('/my-subscriptions')}
              >
                Manage my subscription
              </button>
            </div>

            {email ? (
              <p className="subscribe-confirm-email">
                We&apos;ve emailed your confirmation to {email}.
              </p>
            ) : null}
            <p className="subscribe-confirm-signoff">
              Thank you for trusting us with your meals.
              <span className="subscribe-confirm-signoff-name">— Selena &amp; the Earth Table team</span>
            </p>
          </div>

          <aside className="subscribe-confirm-aside">
            <div className="subscribe-confirm-card">
              <div className="subscribe-confirm-card-details">
                <p className="subscribe-confirm-card-label">Subscription details</p>
                <div className="subscribe-confirm-row">
                  <span className="subscribe-confirm-row-label">Plan</span>
                  <span className="subscribe-confirm-row-value">
                    {mealCount} {mealCount === 1 ? 'meal' : 'meals'} a week
                  </span>
                </div>
                <div className="subscribe-confirm-row">
                  <span className="subscribe-confirm-row-label">Price</span>
                  <span className="subscribe-confirm-row-value">{price}/week + hst</span>
                </div>
                <div className="subscribe-confirm-row">
                  <span className="subscribe-confirm-row-label">Next charge</span>
                  <span className="subscribe-confirm-row-value">{nextChargeDate}</span>
                </div>
                <div className="subscribe-confirm-row">
                  <span className="subscribe-confirm-row-label">Renews</span>
                  <span className="subscribe-confirm-row-value">Every Wednesday at 9:00 AM ET</span>
                </div>
                <div className="subscribe-confirm-row">
                  <span className="subscribe-confirm-row-label">Meal Selection Cutoff</span>
                  <span className="subscribe-confirm-row-value">Every Thursday 5:00 PM ET</span>
                </div>
              </div>

              <div className="subscribe-confirm-card-fulfill">
                <p className="subscribe-confirm-card-heading">{isDelivery ? 'Delivery' : 'Pickup'}</p>
                <p className="subscribe-confirm-card-copy">
                  {fulfillmentDate} · {windowRange}
                </p>
                {isDelivery ? (
                  <>
                    {postal ? (
                      <p className="subscribe-confirm-card-copy">{postal}</p>
                    ) : null}
                    {note ? (
                      <>
                        <p className="subscribe-confirm-card-sublabel">Address &amp; notes</p>
                        <p className="subscribe-confirm-card-copy subscribe-confirm-card-copy--block">
                          {note}
                        </p>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="subscribe-confirm-card-copy">{PICKUP_ADDRESS}</p>
                    {note ? (
                      <>
                        <p className="subscribe-confirm-card-sublabel">Notes</p>
                        <p className="subscribe-confirm-card-copy subscribe-confirm-card-copy--block">
                          {note}
                        </p>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

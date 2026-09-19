import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  DELIVERY_WINDOW,
  fetchOrderBySessionId,
  formatMoney,
  formatTimeWindow,
  formatYmdLong,
  getOrderTotals,
  getPostalFromBuyerInfo,
  PICKUP_ADDRESS,
  shortOrderId,
  titleCaseName,
} from '../helpers/orderHelpers'
import { fetchUserByAuthId } from '../helpers/userHelpers'
import { supabase } from '../supabaseClient'
import loadingAnimation from '../assets/loading.json'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import '../styles/Cart.css'
import '../styles/Confirmation.css'

/** "Sunday, September 27, 2026" -> "Sunday, September 27" */
function dateLabel(ymd) {
  const full = formatYmdLong(ymd)
  return full.replace(/, \d{4}$/, '') || full || '—'
}

function splitWindow(label) {
  const parts = String(label || '').split(/\s*[–-]\s*/)
  if (parts.length >= 2) {
    return { start: parts[0].trim(), end: parts.slice(1).join(' – ').trim() }
  }
  return { start: String(label || '—').trim(), end: '' }
}

function DetailRow({ label, children }) {
  return (
    <div className="subscribe-confirm-row">
      <span className="subscribe-confirm-row-label">{label}</span>
      <span className="subscribe-confirm-row-value">{children}</span>
    </div>
  )
}

export default function Confirmation({ user, clearCart }) {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') || ''
  const [order, setOrder] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const navigate = useNavigate()
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (!sessionId) {
      setErrMsg('Missing session id.')
      setLoading(false)
      return
    }
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    clearCart?.()

    const ac = new AbortController()

    ;(async () => {
      try {
        const data = await fetchOrderBySessionId(sessionId)
        if (!data) {
          throw new Error("We couldn't find your order. If you were just charged, email hello@earthtableco.ca.")
        }
        setOrder(data)
      } catch (e) {
        console.error('[confirmation] failed:', e)
        setErrMsg(e?.message || 'Something went wrong loading your order.')
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()

    return () => ac.abort()
  }, [sessionId])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        let authId = user?.id
        if (!authId) {
          const { data: { session } } = await supabase.auth.getSession()
          authId = session?.user?.id
        }
        if (!authId) {
          if (!cancelled) setProfileName('')
          return
        }
        const profile = await fetchUserByAuthId(authId)
        if (!cancelled) setProfileName(String(profile?.first_name || '').trim())
      } catch (err) {
        console.error(err)
        if (!cancelled) setProfileName('')
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || !authChecked) {
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
              <button type="button" onClick={() => navigate('/')} className="checkout-button">
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isDelivery = !!order?.delivery
  const ymd = isDelivery ? order?.delivery_date : order?.pickup_date
  const fulfillmentDate = dateLabel(ymd)
  const windowLabel = isDelivery
    ? DELIVERY_WINDOW
    : (formatTimeWindow(order?.pickup_time_slot) || '—')
  const { start: windowStart, end: windowEnd } = splitWindow(windowLabel)
  const windowRange = windowEnd ? `${windowStart} – ${windowEnd}` : windowStart
  const note = String(order?.special_note || '').trim()
  const postal = getPostalFromBuyerInfo(order?.buyer_stripe_payment_info)
  const email = order?.buyer_email || ''
  const products = Array.isArray(order?.products) ? order.products : []
  const totals = getOrderTotals(order)
  const heading = profileName
    ? `Your order is confirmed, ${profileName}`
    : 'Your order is confirmed'

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
              Thank you for ordering — we&apos;re so glad you&apos;re here. Your {isDelivery ? 'delivery' : 'pickup'} is{' '}
              <strong>{fulfillmentDate}</strong>.
            </p>

            {products.length > 0 ? (
            <section className="subscribe-confirm-items" aria-label="Order details">
              <p className="subscribe-confirm-card-label">Order details</p>
              <ul className="subscribe-confirm-lines">
                {products.map((item, idx) => {
                  const qty = Number(item.quantity) || 1
                  const lineCents = (Number(item.unit_price_cents) || 0) * qty
                  return (
                    <li key={`${item.slug || 'item'}-${idx}`} className="subscribe-confirm-line">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="subscribe-confirm-line-image" />
                      ) : (
                        <div className="subscribe-confirm-line-image subscribe-confirm-line-image--placeholder" />
                      )}
                      <p className="subscribe-confirm-line-name">{titleCaseName(item.slug)}</p>
                      <span className="subscribe-confirm-line-qty">× {qty}</span>
                      <span className="subscribe-confirm-line-price">{formatMoney(lineCents)}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
            ) : null}

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
                <p className="subscribe-confirm-card-label">Summary</p>
                <DetailRow label="Order">{shortOrderId(order?.id)}</DetailRow>
                {totals.itemSubtotalCents > 0 ? (
                  <DetailRow label="Subtotal">{formatMoney(totals.itemSubtotalCents)}</DetailRow>
                ) : null}
                {totals.discount ? (
                  <DetailRow label={totals.discount.code || totals.discount.label}>
                    −{formatMoney(totals.discountCents)}
                  </DetailRow>
                ) : null}
                {totals.deliveryPreTaxCents > 0 ? (
                  <DetailRow label="Delivery">{formatMoney(totals.deliveryPreTaxCents)}</DetailRow>
                ) : null}
                <DetailRow label="HST">{formatMoney(totals.hstCents)}</DetailRow>
                {totals.creditCents > 0 ? (
                  <DetailRow label="Store credit">−{formatMoney(totals.creditCents)}</DetailRow>
                ) : null}
                <DetailRow label="Total">{formatMoney(totals.totalCents)}</DetailRow>
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

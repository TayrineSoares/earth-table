import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import PickupSelector from '../components/PickupSelector'
import DeliverySelector from '../components/DeliverySelector'
import FeedbackDialog from '../components/FeedbackDialog'
import {
  fetchMySubscriptions,
  formatPickupSlot,
  formatPlanPrice,
  mealsAWeek,
  updateSubscriptionFulfillment,
  sundayDatePart,
  weekSaveCopy,
} from '../helpers/subscriptionHelpers'
import { formatYmdLong, PICKUP_ADDRESS } from '../helpers/orderHelpers'
import '../styles/Cart.css'
import '../styles/OrderHistory.css'
import '../styles/MySubscriptions.css'

const HST_RATE = 0.13

const MySubscriptions = ({ user }) => {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [fulfillment, setFulfillment] = useState('pickup')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [postalValid, setPostalValid] = useState(false)
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [quoteStatus, setQuoteStatus] = useState('idle')
  const [specialNote, setSpecialNote] = useState('')

  const load = async () => {
    if (!user?.id) {
      setRows([])
      setIsLoading(false)
      return
    }
    const data = await fetchMySubscriptions(user.id)
    setRows(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    if (!user?.id) {
      setRows([])
      setIsLoading(false)
      return undefined
    }
    fetchMySubscriptions(user.id)
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) {
          setRows([])
          setDialog({
            icon: 'alert',
            title: 'Could not load subscriptions',
            body: err.message || 'Try again in a moment.',
            primaryLabel: 'OK',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
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
    } else {
      setPickupDate('')
      setPickupTime('')
    }
  }, [fulfillment])

  useEffect(() => {
    if (fulfillment !== 'delivery' || !postalValid) {
      if (fulfillment !== 'delivery') {
        setQuoteStatus('idle')
        setDeliveryFeeCents(0)
      }
      return undefined
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

  const startEdit = (row) => {
    const cycle = row.edit_cycle || row.cycle || {}
    const isDelivery = !!cycle.delivery
    const locked = row.week?.delivery_date || cycle.delivery_date || ''
    setEditingId(row.id)
    setFulfillment(isDelivery ? 'delivery' : 'pickup')
    setPickupDate(locked)
    setPickupTime(cycle.pickup_time_slot || '')
    setDeliveryDate(locked)
    setPostalCode(cycle.delivery_postal_code || '')
    setSpecialNote(cycle.special_note || row.special_note || '')
  }

  const fulfillmentReady =
    fulfillment === 'pickup'
      ? Boolean(pickupTime)
      : postalValid &&
        quoteStatus === 'ok' &&
        deliveryFeeCents > 0 &&
        specialNote.trim().length >= 8

  const persistFulfillment = async (row) => {
    setSavingId(row.id)
    setDialog(null)
    try {
      await updateSubscriptionFulfillment(user.id, row.id, {
        delivery: fulfillment === 'delivery',
        delivery_postal_code: postalCode,
        pickup_time_slot: pickupTime,
        special_note: specialNote,
      })
      await load()
      setEditingId(null)
    } catch (err) {
      console.error(err)
      setDialog({
        icon: 'alert',
        title: 'Could not save pickup / delivery',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    } finally {
      setSavingId(null)
    }
  }

  const saveFulfillment = (row) => {
    if (!fulfillmentReady || savingId) return
    const wasDelivery = !!(row.edit_cycle || row.cycle || {}).delivery
    const copy = weekSaveCopy(row.week, {
      deliveryFeeCents,
      switchingToDelivery: fulfillment === 'delivery' && !wasDelivery,
    })
    setDialog({
      icon: 'mail',
      title: copy.title,
      body: copy.body,
      primaryLabel: 'Save',
      secondaryLabel: 'Cancel',
      onPrimary: () => persistFulfillment(row),
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
    <div className="order-history-page my-subscriptions-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <h1 className="order-history-title">My Subscriptions</h1>

        {!user?.id ? (
          <div className="order-history-empty">
            <p className="order-history-empty-copy">Sign in to see your weekly plans.</p>
            <Link to="/login?next=/my-subscriptions" className="order-history-button">Log in</Link>
          </div>
        ) : !rows.length ? (
          <div className="order-history-empty">
            <p className="order-history-empty-copy">You don&apos;t have a weekly plan yet.</p>
            <Link to="/subscribe-and-save" className="order-history-button">Subscribe &amp; Save</Link>
          </div>
        ) : (
          rows.map((row) => {
            const plan = row.subscription_plans || {}
            const cycle = row.cycle || {}
            const items = Array.isArray(cycle.subscription_cycle_items)
              ? cycle.subscription_cycle_items
              : []
            const meals = items.filter((item) => item.kind === 'plan')
            const addons = items.filter((item) => item.kind === 'addon')
            const isDelivery = !!cycle.delivery
            const sunday = formatYmdLong(cycle.delivery_date || cycle.pickup_date)
            const canEdit = Boolean(row.can_edit)
            const lockedDate = row.week?.delivery_date || cycle.delivery_date || cycle.pickup_date || ''
            const weekNote = row.week?.applies_to === 'next_week'
              ? `This week's cutoff has passed. Edits now apply to next Sunday, ${sundayDatePart(row.week.delivery_label)}. This Sunday's box is locked. If you need a delivery change for this Sunday, email hello@earthtableco.ca.`
              : `You can change meals, add extras, or switch pickup/delivery until ${row.week?.cutoff_label || 'Thursday at 5:00 PM ET'}.`
            const deliveryWithTax = Math.round(deliveryFeeCents * (1 + HST_RATE))

            return (
              <article key={row.id} className="order-card">
                <header className="order-card-header">
                  <div className="order-card-header-main">
                    <p className="order-card-id">{mealsAWeek(plan.meal_count)}</p>
                    <div className="order-card-chips">
                      <span className="order-chip">{row.status}</span>
                      <span className="order-chip">{isDelivery ? 'Delivery' : 'Pickup'}</span>
                    </div>
                  </div>
                  <p className="order-card-placed">{formatPlanPrice(plan.price_cents)}/week</p>
                </header>

                <p className="my-sub-week-note">{weekNote}</p>

                <div className="order-meta-grid">
                  {isDelivery ? (
                    <>
                      <div className="order-meta-field">
                        <p className="order-meta-label">This Sunday</p>
                        <p className="order-meta-value">{sunday || '—'}</p>
                      </div>
                      <div className="order-meta-field">
                        <p className="order-meta-label">Window</p>
                        <p className="order-meta-value">11:00 AM – 6:00 PM</p>
                      </div>
                      {cycle.delivery_postal_code ? (
                        <div className="order-meta-field">
                          <p className="order-meta-label">Postal code</p>
                          <p className="order-meta-value">{cycle.delivery_postal_code}</p>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="order-meta-field">
                        <p className="order-meta-label">Pickup</p>
                        <p className="order-meta-value">{sunday || '—'}</p>
                      </div>
                      <div className="order-meta-field">
                        <p className="order-meta-label">Time</p>
                        <p className="order-meta-value">{formatPickupSlot(cycle.pickup_time_slot) || '—'}</p>
                      </div>
                      <div className="order-meta-field order-meta-field--wide">
                        <p className="order-meta-label">Address</p>
                        <p className="order-meta-value">{PICKUP_ADDRESS}</p>
                      </div>
                    </>
                  )}
                  <div className="order-meta-field order-meta-field--wide">
                    <p className="order-meta-label">Change meals by</p>
                    <p className="order-meta-value">{row.week?.cutoff_label || 'Thursday at 5:00 PM ET'}</p>
                  </div>
                </div>

                {cycle.special_note ? (
                  <div className="order-notes">
                    <p className="order-meta-label">{isDelivery ? 'Address & notes' : 'Notes'}</p>
                    <p className="order-notes-body">{cycle.special_note}</p>
                  </div>
                ) : null}

                <p className="order-meta-label">This week&apos;s meals</p>
                <ul className="order-items">
                  {meals.map((item) => (
                    <li key={item.id} className="order-item">
                      <div className="order-item-link">
                        {item.products?.image_url ? (
                          <img src={item.products.image_url} alt="" className="order-item-image" />
                        ) : (
                          <div className="order-item-image order-item-image--placeholder" />
                        )}
                        <div className="order-item-details">
                          <p className="order-item-name">{item.products?.slug || 'Meal'}</p>
                          {item.quantity > 1 ? (
                            <p className="order-item-price">qty {item.quantity}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {addons.length ? (
                  <>
                    <p className="order-meta-label">This week add-ons</p>
                    <ul className="order-items">
                      {addons.map((item) => (
                        <li key={item.id} className="order-item">
                          <div className="order-item-link">
                            {item.products?.image_url ? (
                              <img src={item.products.image_url} alt="" className="order-item-image" />
                            ) : (
                              <div className="order-item-image order-item-image--placeholder" />
                            )}
                            <div className="order-item-details">
                              <p className="order-item-name">{item.products?.slug || 'Add-on'}</p>
                              <p className="order-item-price">
                                {item.quantity > 1 ? `Add-on · qty ${item.quantity}` : 'Add-on'}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {canEdit ? (
                  <div className="my-sub-actions">
                    <Link
                      to={`/my-subscriptions/${row.id}/meals`}
                      state={{ fresh: true }}
                      className="order-history-button"
                    >
                      Edit plan
                    </Link>
                    <button
                      type="button"
                      className="order-history-button"
                      onClick={() => (editingId === row.id ? setEditingId(null) : startEdit(row))}
                    >
                      {editingId === row.id ? 'Close' : 'Edit pickup / delivery'}
                    </button>
                  </div>
                ) : (
                  <p className="my-sub-locked">This plan is paused.</p>
                )}

                {editingId === row.id && canEdit ? (
                  <div className="my-sub-fulfillment">
                    <p className="my-sub-week-note">{weekNote}</p>
                    <div className="general-text" style={{ margin: '0 0 16px' }}>
                      <label style={{ marginRight: 16 }}>
                        <input
                          type="radio"
                          name={`sub-fulfillment-${row.id}`}
                          value="pickup"
                          checked={fulfillment === 'pickup'}
                          onChange={() => setFulfillment('pickup')}
                        />{' '}
                        Pickup
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`sub-fulfillment-${row.id}`}
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
                      <>
                        <DeliverySelector
                          postalCode={postalCode}
                          onPostalCodeChange={setPostalCode}
                          feeCents={deliveryFeeCents}
                          onValidate={({ valid }) => setPostalValid(valid)}
                          deliveryDate={deliveryDate}
                          onDeliveryDateChange={setDeliveryDate}
                          lockedDate={lockedDate}
                        />
                        {quoteStatus === 'ok' && deliveryFeeCents > 0 ? (
                          <p className="my-sub-fee-line">
                            Delivery {formatPlanPrice(deliveryFeeCents)} + HST {formatPlanPrice(deliveryWithTax - deliveryFeeCents)} = {formatPlanPrice(deliveryWithTax)}
                          </p>
                        ) : null}
                      </>
                    )}

                    <div className="special-note-container">
                      <label htmlFor={`sub-note-${row.id}`} className="general-text">Special Instructions </label>
                      <textarea
                        className="special-note-input"
                        id={`sub-note-${row.id}`}
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

                    {quoteStatus === 'out' ? (
                      <p className="general-text" style={{ color: '#b30000' }}>
                        Delivery not available for this area.
                      </p>
                    ) : null}

                    <button
                      type="button"
                      className="order-history-button"
                      disabled={!fulfillmentReady || savingId === row.id}
                      onClick={() => saveFulfillment(row)}
                    >
                      {savingId === row.id ? 'Saving…' : 'Save pickup / delivery'}
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </div>
      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

export default MySubscriptions

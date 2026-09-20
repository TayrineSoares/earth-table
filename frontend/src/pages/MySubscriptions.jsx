import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, Lock } from 'lucide-react'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import PickupSelector from '../components/PickupSelector'
import DeliverySelector from '../components/DeliverySelector'
import FeedbackDialog from '../components/FeedbackDialog'
import {
  fetchMySubscriptions,
  fetchSubscriptionPlans,
  formatPickupSlot,
  formatPlanPrice,
  applyPromoPercent,
  firstWeekCodeLabel,
  mealsAWeek,
  titleCaseName,
  updateSubscriptionFulfillment,
  updateSubscriptionStatus,
  changeSubscriptionPlan,
  startCardSetup,
  fetchCardSetup,
  sundayDatePart,
  weekSaveCopy,
} from '../helpers/subscriptionHelpers'
import { DELIVERY_WINDOW, PICKUP_ADDRESS } from '../helpers/orderHelpers'
import {
  cardExpiryState,
  howItWorksCharge,
  howItWorksMeals,
  howItWorksPause,
  CHARGE_DAY_TIME,
  MEAL_LOCK_BY,
  everyWeekBy,
  pausedBanner,
  paymentFailedBanner,
  resumeByCharge,
} from '../helpers/subscriptionCadence'
import { clearEditCart } from '../helpers/subscriptionCart'
import '../styles/Cart.css'
import '../styles/OrderHistory.css'
import '../styles/MySubscriptions.css'

const HST_RATE = 0.13

let mineCache = { userId: null, rows: [], plans: [] }

const cardLabel = (card) => {
  if (!card?.last4) return 'No card on file'
  const brand = String(card.brand || 'card')
  const nice = brand.charAt(0).toUpperCase() + brand.slice(1)
  return `${nice} •••• ${card.last4}`
}

function shortWeekdayDate(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  if (!y || !m || !d) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function subscribedSince(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/Toronto',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function LineItem({ item, fallbackName, priceCents }) {
  const qty = Number(item.quantity) || 1
  return (
    <li className="my-sub-line">
      {item.products?.image_url ? (
        <img src={item.products.image_url} alt="" className="my-sub-line-image" />
      ) : (
        <div className="my-sub-line-image my-sub-line-image--placeholder" />
      )}
      <p className="my-sub-line-name">{titleCaseName(item.products?.slug || fallbackName)}</p>
      <span className="my-sub-line-qty">× {qty}</span>
      {priceCents != null ? (
        <span className="my-sub-line-price">{formatPlanPrice(priceCents)}</span>
      ) : null}
    </li>
  )
}

function DetailRow({ label, emphasize, children }) {
  return (
    <div className={emphasize ? 'my-sub-row my-sub-row--next' : 'my-sub-row'}>
      <span className="my-sub-row-label">{label}</span>
      <span className="my-sub-row-value">{children}</span>
    </div>
  )
}

function cycleLineItems(cycle) {
  const items = Array.isArray(cycle?.subscription_cycle_items)
    ? cycle.subscription_cycle_items
    : []
  const meals = items.filter((item) => item.kind === 'plan')
  const addons = items.filter((item) => item.kind === 'addon')
  const mealQty = meals.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  const extrasCents = addons.reduce(
    (sum, item) => sum + (Number(item.unit_price_cents) || 0) * (Number(item.quantity) || 0),
    0
  )
  const extrasPromoPct = Number(cycle?.promo_percent) || 0
  const extrasDueCents = extrasPromoPct > 0
    ? applyPromoPercent(extrasCents, extrasPromoPct)
    : extrasCents
  return { meals, addons, mealQty, extrasCents, extrasDueCents }
}

function LockedBadge() {
  return (
    <span className="my-sub-status my-sub-status--locked">
      <Lock size={12} strokeWidth={2.5} aria-hidden="true" />
      Locked
    </span>
  )
}

function CycleItems({
  meals,
  mealQty,
  mealCount,
  addons,
  extrasCents,
  extrasDueCents,
  extrasPromoLabel,
  canEdit,
  subscriptionId,
  mealsLabel,
  extrasLabel,
  extrasSummaryLabel,
  emptyMeals,
  emptyExtras,
  lockCadence,
  showEditLinks,
  showMealCount,
  showLockedBadge,
}) {
  const extrasOffCents = Math.max(0, (Number(extrasCents) || 0) - (Number(extrasDueCents) || 0))
  const extrasChargedCents = Math.round((Number(extrasDueCents) || 0) * (1 + HST_RATE))
  const extrasHstCents = Math.max(0, extrasChargedCents - (Number(extrasDueCents) || 0))
  return (
    <>
      <div className="my-sub-section-head">
        <p className="my-sub-section-label">{mealsLabel}</p>
        {(showMealCount || showLockedBadge || (canEdit && showEditLinks)) ? (
          <div className="my-sub-section-head-actions">
            {showMealCount ? (
              <p className="my-sub-section-count">{mealQty} of {mealCount}</p>
            ) : null}
            {showLockedBadge ? (
              <LockedBadge />
            ) : canEdit && showEditLinks ? (
              <Link
                className="my-sub-section-link"
                to={`/my-subscriptions/${subscriptionId}/meals`}
                state={{ fresh: true }}
              >
                Edit meals
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      {meals.length ? (
        <ul className="my-sub-lines">
          {meals.map((item) => (
            <LineItem key={item.id} item={item} fallbackName="Meal" />
          ))}
        </ul>
      ) : (
        <p className="my-sub-empty-extras">{emptyMeals}</p>
      )}

      <div className="my-sub-section-head my-sub-section-head--extras">
        <p className="my-sub-section-label">{extrasLabel}</p>
        {showLockedBadge ? (
          <LockedBadge />
        ) : canEdit && showEditLinks ? (
          <Link className="my-sub-section-link" to={`/my-subscriptions/${subscriptionId}/addons`}>
            Edit add-ons
          </Link>
        ) : null}
      </div>
      {addons.length ? (
        <>
          <ul className="my-sub-lines">
            {addons.map((item) => (
              <LineItem
                key={item.id}
                item={item}
                fallbackName="Extra"
                priceCents={(Number(item.unit_price_cents) || 0) * (Number(item.quantity) || 1)}
              />
            ))}
          </ul>
          {extrasOffCents > 0 ? (
            <div className="my-sub-extras-summary">
              <span>
                {extrasPromoLabel || 'First-week discount'} · first week only
              </span>
              <span>-{formatPlanPrice(extrasOffCents)}</span>
            </div>
          ) : null}
          <div className="my-sub-extras-summary">
            <span>+ HST</span>
            <span>{formatPlanPrice(extrasHstCents)}</span>
          </div>
          <div className="my-sub-extras-summary my-sub-extras-summary--total">
            <span>{extrasSummaryLabel}</span>
            <span>{formatPlanPrice(extrasChargedCents)} · charged {lockCadence}</span>
          </div>
        </>
      ) : (
        <p className="my-sub-empty-extras">{emptyExtras}</p>
      )}
    </>
  )
}

const MySubscriptions = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const userId = user?.id || null
  const cached = mineCache.userId === userId ? mineCache : null
  const [rows, setRows] = useState(() => cached?.rows || [])
  const [plans, setPlans] = useState(() => cached?.plans || [])
  const [isLoading, setIsLoading] = useState(() => !cached?.rows?.length)
  const [dialog, setDialog] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [notesEditingId, setNotesEditingId] = useState(null)
  const [changingId, setChangingId] = useState(null)
  const [nextWeekOpen, setNextWeekOpen] = useState({})
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

  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const load = async () => {
    if (!userId) return
    const data = await fetchMySubscriptions(userId)
    if (!Array.isArray(data)) return
    mineCache = { ...mineCache, userId, rows: data }
    setRows(data)
  }

  useEffect(() => {
    if (!userId) {
      const timer = window.setTimeout(() => {
        mineCache = { userId: null, rows: [], plans: [] }
        setRows([])
        setPlans([])
        setIsLoading(false)
      }, 400)
      return () => window.clearTimeout(timer)
    }
    let cancelled = false
    const hasRows = mineCache.userId === userId && mineCache.rows.length > 0
    if (!hasRows) setIsLoading(true)
    Promise.all([
      fetchMySubscriptions(userId),
      fetchSubscriptionPlans({ activeOnly: true }).catch(() => mineCache.plans || []),
    ])
      .then(([data, nextPlans]) => {
        if (cancelled) return
        if (Array.isArray(data)) {
          const plansList = Array.isArray(nextPlans) ? nextPlans : []
          mineCache = { userId, rows: data, plans: plansList }
          setRows(data)
          setPlans(plansList)
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled && !rowsRef.current.length) {
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
  }, [userId])

  const cardSession = searchParams.get('card_session')
  useEffect(() => {
    const sessionId = cardSession
    if (!sessionId || !userId) return undefined
    let cancelled = false
    fetchCardSetup(sessionId)
      .then((result) => {
        if (cancelled || !result?.ready) return
        setSearchParams({}, { replace: true })
        return load().then(() => {
          const retry = result.retry
          let title = 'Card updated'
          let body = 'This weekly plan will use the new card for the next charge.'
          if (retry?.charged) {
            title = 'You\'re back on'
            body = 'We charged this box to your new card. The plan is active again.'
          } else if (retry && retry.ok === false) {
            title = 'Card saved, payment still failed'
            body = retry.reason
              ? `Your card is on file, but we still could not charge this week (${retry.reason}). Try another card or email hello@earthtableco.ca.`
              : 'Your card is on file, but we still could not charge this week. Try another card or email hello@earthtableco.ca.'
          } else if (retry?.ok) {
            title = 'You\'re back on'
            body = 'Your card is saved and the plan is active again. We\'ll charge the next box on the usual Wednesday if this week\'s cutoff has already passed.'
          }
          setDialog({
            icon: retry && retry.ok === false ? 'alert' : 'mail',
            title,
            body,
            primaryLabel: 'OK',
          })
        })
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) {
          setDialog({
            icon: 'alert',
            title: 'Could not save that card',
            body: err.message || 'Try Edit beside the card number again.',
            primaryLabel: 'OK',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [cardSession, userId])

  useEffect(() => {
    const unlock = () => setSavingId(null)
    window.addEventListener('pageshow', unlock)
    window.addEventListener('focus', unlock)
    return () => {
      window.removeEventListener('pageshow', unlock)
      window.removeEventListener('focus', unlock)
    }
  }, [])

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
    setNotesEditingId(null)
    setFulfillment(isDelivery ? 'delivery' : 'pickup')
    setPickupDate(locked)
    setPickupTime(cycle.pickup_time_slot || '')
    setDeliveryDate(locked)
    setPostalCode(cycle.delivery_postal_code || '')
    setSpecialNote(cycle.special_note || row.special_note || '')
  }

  const startNotesEdit = (row) => {
    const cycle = row.edit_cycle || row.cycle || {}
    setNotesEditingId(row.id)
    setEditingId(null)
    setSpecialNote(cycle.special_note || row.special_note || '')
  }

  const fulfillmentReady =
    fulfillment === 'pickup'
      ? Boolean(pickupTime)
      : postalValid &&
        quoteStatus === 'ok' &&
        deliveryFeeCents > 0 &&
        specialNote.trim().length >= 8

  const persistNotes = async (row) => {
    const isDelivery = !!(row.edit_cycle || row.cycle || {}).delivery
    if (isDelivery && specialNote.trim().length < 8) {
      setDialog({
        icon: 'alert',
        title: 'One more step',
        body: 'Add your full delivery address in Notes.',
        primaryLabel: 'Got it',
      })
      return
    }
    setSavingId(row.id)
    try {
      await updateSubscriptionFulfillment(user.id, row.id, {
        notes_only: true,
        special_note: specialNote,
      })
      await load()
      setNotesEditingId(null)
    } catch (err) {
      console.error(err)
      setDialog({
        icon: 'alert',
        title: 'Could not save notes',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    } finally {
      setSavingId(null)
    }
  }

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
      setNotesEditingId(null)
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

  const persistStatus = async (row, action) => {
    const apiAction = action === 'cancel' ? 'pause' : action
    setSavingId(row.id)
    setDialog(null)
    try {
      const result = await updateSubscriptionStatus(user.id, row.id, apiAction)
      await load()
      setChangingId(null)
      if (result?.pending && result?.message) {
        setDialog({
          icon: 'mail',
          title: action === 'cancel' ? 'Cancel starts next week' : 'Pause starts next week',
          body: result.message,
          primaryLabel: 'OK',
        })
      } else if (action === 'resume' && row.pause_reason === 'payment_failed') {
        setDialog({
          icon: 'mail',
          title: 'You\'re back on',
          body: result?.charged
            ? 'We charged this box to the card on file. The plan is active again.'
            : 'The plan is active again.',
          primaryLabel: 'OK',
        })
      }
    } catch (err) {
      console.error(err)
      setDialog({
        icon: 'alert',
        title: 'Could not update this plan',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    } finally {
      setSavingId(null)
    }
  }

  const confirmStatus = (row, action) => {
    const beforeWed = row.charge?.before_wednesday !== false
    const sunday = sundayDatePart(row.week?.delivery_label)
    const resumeBy = resumeByCharge(row.charge?.charge_label)
    const copy = {
      pause: beforeWed
        ? {
          title: 'Pause this plan?',
          body: [
            `This Sunday, ${sunday}, will be skipped, and your meals and card stay on file.`,
            resumeBy,
          ],
        }
        : {
          title: 'Pause after this Sunday?',
          body: `The payment cutoff for this week has passed. You're still receiving this Sunday, ${sunday}. The plan will be paused starting the following week.`,
        },
      cancel: beforeWed
        ? {
          title: 'Cancel this plan?',
          body: [
            `This Sunday, ${sunday}, will be skipped, and your meals and card stay on file.`,
            resumeBy,
          ],
        }
        : {
          title: 'Cancel after this Sunday?',
          body: `The payment cutoff for this week has passed. You're still receiving this Sunday, ${sunday}. The plan will stay on file starting the following week — resume any time.`,
        },
      resume: {
        title: row.pause_reason === 'payment_failed' ? 'Charge this box now?' : 'Resume this plan?',
        body: row.pause_reason === 'payment_failed'
          ? 'We\'ll charge the unpaid box to the card on file. If that succeeds, the plan is active again.'
          : row.pending_status
            ? `This Sunday still goes out, and the pending ${row.pending_status} will be cleared.`
            : 'Your weekly plan will be active again and weekly charges resume.',
      },
    }[action]
    setDialog({
      icon: 'mail',
      title: copy.title,
      body: copy.body,
      primaryLabel: action === 'cancel' ? 'Cancel plan' : action === 'pause' ? 'Pause' : 'Resume',
      secondaryLabel: 'Never mind',
      onPrimary: () => persistStatus(row, action),
    })
  }

  const persistPlan = async (row, plan) => {
    setSavingId(row.id)
    setDialog(null)
    try {
      const result = await changeSubscriptionPlan(user.id, row.id, plan.id)
      clearEditCart(user.id, row.id)
      await load()
      setChangingId(null)
      if (result?.needs_meals) {
        const lockBy = row.week?.cutoff_label || MEAL_LOCK_BY
        setDialog({
          icon: 'mail',
          title: 'Pick this week\'s meals',
          body: `You're now on ${mealsAWeek(plan.meal_count)}. Choose exactly that many meals before ${lockBy}.`,
          primaryLabel: 'Choose meals',
          primaryTo: `/my-subscriptions/${row.id}/meals`,
        })
      }
    } catch (err) {
      console.error(err)
      setDialog({
        icon: 'alert',
        title: 'Could not change plan',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    } finally {
      setSavingId(null)
    }
  }

  const confirmPlan = (row, plan) => {
    const beforeWed = row.charge?.before_wednesday !== false
    const sunday = sundayDatePart(row.week?.delivery_label)
    const lockBy = row.week?.cutoff_label || MEAL_LOCK_BY
    setDialog({
      icon: 'mail',
      title: `Switch to ${mealsAWeek(plan.meal_count)}?`,
      body: beforeWed
        ? `This Sunday, ${sunday}, will use the new plan. You'll need to pick ${plan.meal_count} meals before ${lockBy}.`
        : `This Sunday, ${sunday}, stays on your current plan. ${mealsAWeek(plan.meal_count)} starts the following week.`,
      primaryLabel: 'Change plan',
      secondaryLabel: 'Never mind',
      onPrimary: () => persistPlan(row, plan),
    })
  }

  const changeCard = async (row) => {
    if (savingId) return
    setSavingId(row.id)
    try {
      const result = await startCardSetup(user.id, row.id)
      if (result?.url) {
        window.location.assign(result.url)
        return
      }
      throw new Error('Could not open card update.')
    } catch (err) {
      console.error(err)
      setDialog({
        icon: 'alert',
        title: 'Could not update card',
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
      lockedPriorCycle: Boolean(
        row.this_week_cycle
        && (row.this_week_cycle.status === 'locked' || row.this_week_cycle.status === 'skipped')
      ),
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

  const openPlanDetails = (row) => {
    const chargeLabel = row?.charge?.charge_label
    const cutoffLabel = row?.week?.cutoff_label
    setDialog({
      icon: 'alert',
      title: 'Subscription details',
      asList: true,
      body: [
        'Every plan lets you choose any combination of bowls, salads, and main plates.',
        howItWorksCharge(chargeLabel, cutoffLabel),
        'If you don\'t make changes on time, we\'ll send your previous week\'s selections.',
        howItWorksPause(chargeLabel),
        'Add-ons are for this week only. They do not repeat unless you add them again.',
        howItWorksMeals(cutoffLabel),
      ],
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

  if (isLoading && !rows.length) {
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

      <div className="page-wrapper my-sub-shell">
        {!user?.id ? (
          <>
            <div className="my-sub-page-header">
              <h1 className="my-sub-h1">My plans</h1>
            </div>
            <div className="order-history-empty">
              <p className="order-history-empty-copy">Sign in to see your weekly plans.</p>
              <Link to="/login?next=/my-subscriptions" className="order-history-button">Log in</Link>
            </div>
          </>
        ) : !rows.length ? (
          <>
            <div className="my-sub-page-header">
              <h1 className="my-sub-h1">My plans</h1>
            </div>
            <div className="order-history-empty">
              <p className="order-history-empty-copy">
                You don&apos;t have a weekly plan yet — choose your meals and we&apos;ll pack a box every Sunday.
              </p>
              <Link to="/subscribe-and-save" className="order-history-cta">Subscribe &amp; Save</Link>
            </div>
          </>
        ) : (
          <>
            <div className="my-sub-page-header">
              <h1 className="my-sub-h1">My plans</h1>
            </div>

            {rows.map((row) => {
            const plan = row.subscription_plans || {}
            // Open week (editable after cutoff). Locked next-box uses this_week_cycle.
            const cycle = row.cycle || {}
            const editLines = cycleLineItems({
              ...cycle,
              promo_percent: Number(row.addon_promo_percent) || Number(cycle.promo_percent) || 0,
            })
            const meals = editLines.meals
            const addons = editLines.addons
            const mealQty = editLines.mealQty
            const extrasCents = editLines.extrasCents
            const extrasDueCents = editLines.extrasDueCents
            const mealCount = Number(plan.meal_count) || 0
            const isDelivery = !!cycle.delivery
            const lockedCycle = row.this_week_cycle
            const nextBoxIsLocked = Boolean(
              lockedCycle
              && (lockedCycle.status === 'locked' || lockedCycle.status === 'skipped')
            )
            const lockedLines = nextBoxIsLocked ? cycleLineItems(lockedCycle) : null
            const showingFollowingWeek = nextBoxIsLocked
            const ymd = showingFollowingWeek
              ? (lockedCycle.delivery_date || row.this_week_date)
              : (row.week?.delivery_date || cycle.delivery_date || cycle.pickup_date)
            const canEdit = Boolean(row.can_edit)
            const isPaused = row.status === 'paused'
            const paymentFailedPause = isPaused && row.pause_reason === 'payment_failed'
            const pending = row.pending_status
            const pendingPlan = row.pending_plan
            const lockedDate = row.week?.delivery_date || cycle.delivery_date || cycle.pickup_date || ''
            const lockCadence = row.week?.cadence_label || MEAL_LOCK_BY
            const chargeCadence = row.charge?.cadence_label || CHARGE_DAY_TIME
            const lockBy = row.week?.cutoff_label || MEAL_LOCK_BY
            const followingWeekLabel = row.week?.delivery_label
              ? `Following week, ${sundayDatePart(row.week.delivery_label)}`
              : 'Following week'
            const statusNote = paymentFailedPause
              ? ''
              : isPaused || pending === 'paused'
                ? pausedBanner(row.charge?.charge_label)
                : pending === 'cancelled'
                  ? 'You\'re still receiving this Sunday\'s box. The plan will be cancelled starting the following week.'
                  : nextBoxIsLocked
                    ? `This week's cutoff has passed. Edits now apply to next Sunday, ${sundayDatePart(row.week.delivery_label)}.`
                    : row.meals_need_update
                      ? `Pick exactly ${mealCount} meals for this Sunday before ${lockBy}.`
                      : pendingPlan
                        ? `Starting next week: ${mealsAWeek(pendingPlan.meal_count)} (${formatPlanPrice(pendingPlan.price_cents)}/week).`
                        : ''
            const deliveryWithTax = Math.round(deliveryFeeCents * (1 + HST_RATE))
            const otherPlans = plans.filter((planRow) => planRow.id !== row.plan_id)
            const statusLabel = pending === 'paused'
              ? 'Pausing'
              : pending === 'cancelled'
                ? 'Cancelling'
                : paymentFailedPause
                  ? 'Payment failed'
                  : isPaused
                    ? 'Paused'
                    : 'Active'
            const statusChipClass = paymentFailedPause
              ? 'my-sub-status my-sub-status--alert'
              : isPaused || pending
                ? 'my-sub-status my-sub-status--paused'
                : 'my-sub-status my-sub-status--active'
            const note = String(cycle.special_note || row.special_note || '').trim()
            const location = isDelivery
              ? (cycle.delivery_postal_code || '—')
              : PICKUP_ADDRESS
            const windowLabel = isDelivery
              ? DELIVERY_WINDOW
              : (formatPickupSlot(cycle.pickup_time_slot) || '—')
            const mealsBy = everyWeekBy(lockCadence)
            const pauseBy = everyWeekBy(chargeCadence)
            const expiry = cardExpiryState(row.card)
            const isNextOpen = Boolean(nextWeekOpen[row.id])
            const nextWeekPanelId = `next-week-${row.id}`
            const extrasPromoLabel = firstWeekCodeLabel(row.first_promo_code, row.first_promo_kind)
            const nextBoxItems = (
              <CycleItems
                meals={showingFollowingWeek ? lockedLines.meals : meals}
                mealQty={showingFollowingWeek ? lockedLines.mealQty : mealQty}
                mealCount={mealCount}
                addons={showingFollowingWeek ? lockedLines.addons : addons}
                extrasCents={showingFollowingWeek ? lockedLines.extrasCents : extrasCents}
                extrasDueCents={showingFollowingWeek ? lockedLines.extrasDueCents : extrasDueCents}
                extrasPromoLabel={extrasPromoLabel}
                canEdit={canEdit}
                subscriptionId={row.id}
                mealsLabel="Next box meals"
                extrasLabel="Next box extras"
                extrasSummaryLabel="Total"
                emptyMeals="No meals selected for next box."
                emptyExtras="No extras for next box."
                lockCadence={lockCadence}
                showEditLinks={!showingFollowingWeek && canEdit}
                showMealCount
                showLockedBadge={showingFollowingWeek}
              />
            )
            const followingWeekItems = (
              <CycleItems
                meals={meals}
                mealQty={mealQty}
                mealCount={mealCount}
                addons={addons}
                extrasCents={extrasCents}
                extrasDueCents={extrasDueCents}
                extrasPromoLabel={extrasPromoLabel}
                canEdit={canEdit}
                subscriptionId={row.id}
                mealsLabel="Meals"
                extrasLabel="Extras"
                extrasSummaryLabel="Total"
                emptyMeals="No meals selected for the following week."
                emptyExtras="No extras for the following week."
                lockCadence={lockCadence}
                showEditLinks={canEdit}
                showMealCount
              />
            )

            return (
              <section key={row.id} className="my-sub-plan">
                <div className="my-sub-meals">
                  {nextBoxItems}
                  {showingFollowingWeek ? (
                    <>
                      <div className="my-sub-next-head">
                        <button
                          type="button"
                          className="my-sub-next-toggle"
                          aria-expanded={isNextOpen}
                          aria-controls={nextWeekPanelId}
                          onClick={() => setNextWeekOpen((prev) => ({
                            ...prev,
                            [row.id]: !prev[row.id],
                          }))}
                        >
                          <ChevronDown
                            size={18}
                            strokeWidth={2}
                            className={`my-sub-next-chevron${isNextOpen ? ' is-open' : ''}`}
                            aria-hidden="true"
                          />
                          {followingWeekLabel}
                        </button>
                        <div className="my-sub-section-head-actions">
                          <p className="my-sub-section-count">{mealQty} of {mealCount}</p>
                        </div>
                      </div>
                      <div
                        id={nextWeekPanelId}
                        className="my-sub-next-panel"
                        hidden={!isNextOpen}
                      >
                        {followingWeekItems}
                      </div>
                    </>
                  ) : null}
                </div>

                <aside className="my-sub-aside">
                  <div className="my-sub-card">
                    <div className="my-sub-card-top">
                      <div className="my-sub-card-title-row">
                        <h2 className="my-sub-card-title">{mealsAWeek(plan.meal_count)}</h2>
                        <span className={statusChipClass}>{statusLabel}</span>
                      </div>
                      <p className="my-sub-card-price">
                        {formatPlanPrice(plan.price_cents)}/week · {isDelivery ? 'delivery' : 'pickup'}
                      </p>
                      {row.created_at ? (
                        <p className="my-sub-card-since">
                          Subscribed since {subscribedSince(row.created_at)}
                        </p>
                      ) : null}
                      {paymentFailedPause ? (
                        <div className="my-sub-status-note my-sub-status-note--alert" role="status">
                          <p>{paymentFailedBanner()}</p>
                          <button
                            type="button"
                            className="my-sub-edit-link"
                            disabled={savingId === row.id}
                            onClick={() => changeCard(row)}
                          >
                            Update your card
                          </button>
                        </div>
                      ) : statusNote ? (
                        <p className="my-sub-status-note">{statusNote}</p>
                      ) : null}
                    </div>

                    <div className="my-sub-card-details">
                      <DetailRow label="Next box" emphasize>
                        {row.status === 'active' ? shortWeekdayDate(ymd) : '—'}
                      </DetailRow>
                      <DetailRow label={isDelivery ? 'Delivery' : 'Pickup'}>{windowLabel}</DetailRow>
                      <DetailRow label="Location">{location}</DetailRow>
                      <DetailRow label="Notes">
                        {note || 'None'}
                        {canEdit ? (
                          <button
                            type="button"
                            className="my-sub-edit-link"
                            disabled={savingId === row.id}
                            onClick={() => (
                              notesEditingId === row.id
                                ? setNotesEditingId(null)
                                : startNotesEdit(row)
                            )}
                          >
                            {notesEditingId === row.id ? 'Close' : 'Edit'}
                          </button>
                        ) : null}
                      </DetailRow>
                      <DetailRow label="Change meals by">{mealsBy}</DetailRow>
                      <DetailRow label="Pause or cancel by">{pauseBy}</DetailRow>
                      <DetailRow label="Card on file">
                        {cardLabel(row.card)}
                        <button
                          type="button"
                          className={`my-sub-edit-link${paymentFailedPause ? ' my-sub-edit-link--alert' : ''}`}
                          disabled={savingId === row.id}
                          onClick={() => changeCard(row)}
                        >
                          Edit
                        </button>
                      </DetailRow>
                      {expiry ? (
                        <DetailRow label="Expires">{expiry.label}</DetailRow>
                      ) : null}
                      {expiry?.note ? (
                        <p
                          className={`my-sub-card-expiry${expiry.kind === 'expired' ? ' my-sub-card-expiry--alert' : ''}`}
                        >
                          {expiry.note}
                        </p>
                      ) : null}
                    </div>

                    <div className="my-sub-card-actions">
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            className="my-sub-text-link"
                            onClick={() => (editingId === row.id ? setEditingId(null) : startEdit(row))}
                          >
                            {editingId === row.id ? 'Close pickup or delivery' : 'Change pickup or delivery'}
                          </button>
                          <button
                            type="button"
                            className="my-sub-text-link"
                            onClick={() => setChangingId(changingId === row.id ? null : row.id)}
                          >
                            {changingId === row.id ? 'Close plans' : 'Change plan'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="my-sub-primary"
                          disabled={savingId === row.id}
                          onClick={() => confirmStatus(row, 'resume')}
                        >
                          Resume
                        </button>
                      )}
                    </div>

                    <div className="my-sub-card-danger">
                      {canEdit && pending ? (
                        <button
                          type="button"
                          className="my-sub-danger-link"
                          disabled={savingId === row.id}
                          onClick={() => confirmStatus(row, 'resume')}
                        >
                          Keep this Sunday
                        </button>
                      ) : canEdit ? (
                        <button
                          type="button"
                          className="my-sub-danger-link"
                          disabled={savingId === row.id}
                          onClick={() => confirmStatus(row, 'pause')}
                        >
                          Pause plan
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="my-sub-danger-link my-sub-danger-link--cancel"
                        disabled={savingId === row.id}
                        onClick={() => confirmStatus(row, 'cancel')}
                      >
                        Cancel plan
                      </button>
                    </div>

                    <div className="my-sub-card-terms">
                      <button type="button" className="my-sub-text-link" onClick={() => openPlanDetails(row)}>
                        View plan details &amp; rules
                      </button>
                    </div>
                  </div>

                  {notesEditingId === row.id && canEdit ? (
                    <div className="my-sub-notes-edit">
                      <div className="special-note-container">
                        <label htmlFor={`sub-notes-${row.id}`} className="general-text">Notes</label>
                        <textarea
                          className="special-note-input"
                          id={`sub-notes-${row.id}`}
                          value={specialNote}
                          onChange={(e) => setSpecialNote(e.target.value)}
                          placeholder={
                            isDelivery
                              ? 'Delivery address, allergies, special instructions...'
                              : 'Allergies, special instructions...'
                          }
                          rows="4"
                        />
                      </div>
                      <button
                        type="button"
                        className="order-history-button"
                        disabled={savingId === row.id || (isDelivery && specialNote.trim().length < 8)}
                        onClick={() => persistNotes(row)}
                      >
                        {savingId === row.id ? 'Saving…' : 'Save notes'}
                      </button>
                    </div>
                  ) : null}

                  {changingId === row.id && canEdit && otherPlans.length ? (
                    <div className="my-sub-plan-list">
                      {otherPlans.map((planRow) => (
                        <button
                          key={planRow.id}
                          type="button"
                          className="order-history-button"
                          disabled={savingId === row.id}
                          onClick={() => confirmPlan(row, planRow)}
                        >
                          {mealsAWeek(planRow.meal_count)} — {formatPlanPrice(planRow.price_cents)}/week
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {editingId === row.id && canEdit ? (
                    <div className="my-sub-fulfillment">
                      <div className="my-sub-fulfill-radios">
                        <label>
                          <input
                            type="radio"
                            name={`sub-fulfillment-${row.id}`}
                            value="pickup"
                            checked={fulfillment === 'pickup'}
                            onChange={() => setFulfillment('pickup')}
                          />
                          Pickup
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`sub-fulfillment-${row.id}`}
                            value="delivery"
                            checked={fulfillment === 'delivery'}
                            onChange={() => setFulfillment('delivery')}
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
                </aside>
              </section>
            )
          })}
          </>
        )}
      </div>
      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

export default MySubscriptions

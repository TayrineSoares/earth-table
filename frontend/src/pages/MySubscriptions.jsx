import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, Lock } from 'lucide-react'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import PickupSelector from '../components/PickupSelector'
import DeliverySelector from '../components/DeliverySelector'
import SpecialNoteFields from '../components/SpecialNoteFields'
import FeedbackDialog from '../components/FeedbackDialog'
import {
  composeSpecialNote,
  deliveryAddressReady,
  formatSpecialNoteDisplay,
  parseSpecialNote,
} from '../helpers/specialNote'
import {
  fetchMySubscriptions,
  fetchSubscriptionPlans,
  formatPickupSlot,
  formatPlanPrice,
  applyPromoPercent,
  firstWeekCodeLabel,
  mealsAWeek,
  planChangeMoneyPreview,
  titleCaseName,
  updateSubscriptionFulfillment,
  updateSubscriptionStatus,
  startCardSetup,
  fetchCardSetup,
  sundayDatePart,
  weekSaveCopy,
} from '../helpers/subscriptionHelpers'
import { DELIVERY_WINDOW, PICKUP_ADDRESS } from '../helpers/orderHelpers'
import {
  cardExpiryState,
  subscriptionDetailsItems,
  CHARGE_DAY_TIME,
  PAUSE_CANCEL_BY,
  MEAL_LOCK_BY,
  UNCHANGED_MEALS,
  everyWeekBy,
  pausedBanner,
  pausingAfterCutoffBanner,
  pendingCancelBanner,
  paymentFailedBanner,
  resumeByLock,
} from '../helpers/subscriptionCadence'
import { clearEditCart, seedEditCartForPlanChange, writeEditCart } from '../helpers/subscriptionCart'
import '../styles/Cart.css'
import '../styles/OrderHistory.css'
import '../styles/MySubscriptions.css'

const HST_RATE = 0.13
const MINE_STORAGE_KEY = 'et-mine-cache'
const SAVED_DIALOG = {
  icon: 'mail',
  title: 'Changes saved',
  body: 'This week\'s box is updated.',
  primaryLabel: 'OK',
}

let mineCache = { userId: null, rows: [], plans: [] }

function readStoredMine(userId) {
  if (!userId) return null
  try {
    const parsed = JSON.parse(sessionStorage.getItem(`${MINE_STORAGE_KEY}:${userId}`) || 'null')
    if (parsed?.userId === userId && Array.isArray(parsed.rows) && parsed.rows.length) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

function writeMineCache(next) {
  mineCache = {
    userId: next.userId || null,
    rows: Array.isArray(next.rows) ? next.rows : [],
    plans: Array.isArray(next.plans) ? next.plans : [],
  }
  if (!mineCache.userId) return
  try {
    const key = `${MINE_STORAGE_KEY}:${mineCache.userId}`
    if (mineCache.rows.length) {
      sessionStorage.setItem(key, JSON.stringify(mineCache))
    } else {
      sessionStorage.removeItem(key)
    }
  } catch {
    /* private mode */
  }
}

function cacheFor(userId) {
  if (!userId) return { userId: null, rows: [], plans: [] }
  if (mineCache.userId === userId) return mineCache
  const stored = readStoredMine(userId)
  if (stored) {
    mineCache = stored
    return stored
  }
  return { userId, rows: [], plans: [] }
}

const cardLabel = (card) => {
  if (card?.needsUpdate || !card?.last4) return 'Card needs updating'
  const brand = String(card.brand || 'card')
  const nice = brand.charAt(0).toUpperCase() + brand.slice(1)
  return `${nice} •••• ${card.last4}`
}

const cardNeedsUpdate = (card) => Boolean(card?.needsUpdate || !card?.last4)

function shortWeekdayDate(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  if (!y || !m || !d) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "Nov 22" — for "This Sunday, …" copy (never "Sun, Nov 22"). */
function shortMonthDay(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** "This Sunday" or "This Sunday, Nov 22" — strips leftover weekday prefixes. */
function thisSundayCopy(dateLabel) {
  const raw = String(dateLabel || '').trim()
  const part = raw
    .replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday)\.?,?\s+/i, '')
    .trim()
  if (!part || /^sunday$/i.test(part) || part === 'this Sunday') return 'This Sunday'
  return `This Sunday, ${part}`
}

/**
 * Unpaid open cycle for the cook week that resume/card-update can still charge.
 * After Wednesday skip/lock, this is usually empty even if next week is already open.
 */
function unpaidOpenCookCycle(row) {
  const cookYmd = row?.week?.cutoff_passed
    ? (row.this_week_date || null)
    : (row.week?.delivery_date || null)
  if (!cookYmd) return null
  const candidates = [
    row.next_box_cycle,
    row.this_week_cycle,
    row.edit_cycle,
    row.cycle,
  ]
  return candidates.find((cycle) => (
    cycle
    && cycle.status === 'open'
    && Number(cycle.plan_paid_cents) <= 0
    && String(cycle.delivery_date) === String(cookYmd)
  )) || null
}

/** Refunded pause-skip for this cook Sunday — resume can reopen and charge before lock. */
function unpaidSkippedCookCycle(row) {
  const cookYmd = row?.week?.cutoff_passed
    ? (row.this_week_date || null)
    : (row.week?.delivery_date || null)
  if (!cookYmd) return null
  const candidates = [
    row.next_box_cycle,
    row.this_week_cycle,
    row.edit_cycle,
    row.cycle,
  ]
  return candidates.find((cycle) => (
    cycle
    && cycle.status === 'skipped'
    && Number(cycle.plan_paid_cents) <= 0
    && String(cycle.delivery_date) === String(cookYmd)
  )) || null
}

/** "November 23" for the Sunday meal/fulfillment edits currently target. */
function editTargetSundayDate(row) {
  const ymd = row?.edit_cycle?.delivery_date || row?.week?.delivery_date
  const [y, m, d] = String(ymd || '').split('-').map(Number)
  if (y && m && d) {
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    })
  }
  return sundayDatePart(row?.week?.delivery_label)
}

function statusBusyLabel(action) {
  if (action === 'cancel') return 'Cancelling…'
  if (action === 'pause') return 'Pausing…'
  return 'Resuming…'
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

function DetailRow({ label, sublabel, emphasize, action, children }) {
  return (
    <div className={emphasize ? 'my-sub-row my-sub-row--next' : 'my-sub-row'}>
      <div className="my-sub-row-lead">
        <span className="my-sub-row-label">{label}</span>
        {sublabel ? <span className="my-sub-row-sublabel">{sublabel}</span> : null}
        {action ? <div className="my-sub-row-action">{action}</div> : null}
      </div>
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
  onEditMeals,
  onEditAddons,
}) {
  const extrasOffCents = Math.max(0, (Number(extrasCents) || 0) - (Number(extrasDueCents) || 0))
  const extrasChargedCents = Math.round((Number(extrasDueCents) || 0) * (1 + HST_RATE))
  const extrasHstCents = Math.max(0, extrasChargedCents - (Number(extrasDueCents) || 0))
  const mealsEdit = typeof onEditMeals === 'function' ? (
    <button type="button" className="my-sub-section-link" onClick={onEditMeals}>
      Edit meals
    </button>
  ) : (
    <Link
      className="my-sub-section-link"
      to={`/my-subscriptions/${subscriptionId}/meals`}
      state={{ fresh: true }}
    >
      Edit meals
    </Link>
  )
  const addonsEdit = typeof onEditAddons === 'function' ? (
    <button type="button" className="my-sub-section-link" onClick={onEditAddons}>
      Edit add-ons
    </button>
  ) : (
    <Link
      className="my-sub-section-link"
      to={`/my-subscriptions/${subscriptionId}/addons`}
      state={{ fresh: true }}
    >
      Edit add-ons
    </Link>
  )
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
            ) : canEdit && showEditLinks ? mealsEdit : null}
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
        ) : canEdit && showEditLinks ? addonsEdit : null}
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
  const location = useLocation()
  const navigate = useNavigate()
  const userId = user?.id || null
  const cached = cacheFor(userId)
  const [rows, setRows] = useState(() => cached.rows || [])
  const [plans, setPlans] = useState(() => cached.plans || [])
  const [isLoading, setIsLoading] = useState(() => Boolean(userId) && !cached.rows?.length)
  const [fetchedUserId, setFetchedUserId] = useState(() => (
    cached.rows?.length && cached.userId === userId ? userId : null
  ))
  const [authWait, setAuthWait] = useState(() => !userId)
  const [dialog, setDialog] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [notesEditingId, setNotesEditingId] = useState(null)
  const [changingId, setChangingId] = useState(null)
  const [nextWeekOpen, setNextWeekOpen] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [statusBusy, setStatusBusy] = useState(null)
  const statusLockRef = useRef(false)
  const [fulfillment, setFulfillment] = useState('pickup')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [postalValid, setPostalValid] = useState(false)
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [quoteStatus, setQuoteStatus] = useState('idle')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [orderNotes, setOrderNotes] = useState('')

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const fetchedRef = useRef(fetchedUserId)
  fetchedRef.current = fetchedUserId
  const resumeFlowRef = useRef(null)

  const applyMine = (data, plansList) => {
    if (!Array.isArray(data)) return
    writeMineCache({
      userId,
      rows: data,
      plans: Array.isArray(plansList) ? plansList : mineCache.plans,
    })
    setRows(data)
    if (Array.isArray(plansList)) setPlans(plansList)
    setFetchedUserId(userId)
  }

  const load = async () => {
    if (!userId) return
    const data = await fetchMySubscriptions()
    applyMine(data)
  }

  useEffect(() => {
    if (!userId) {
      const timer = window.setTimeout(() => setAuthWait(true), 400)
      return () => window.clearTimeout(timer)
    }
    setAuthWait(false)
    let cancelled = false
    const hasRows = cacheFor(userId).rows.length > 0
    if (!hasRows) setIsLoading(true)
    Promise.all([
      fetchMySubscriptions(),
      fetchSubscriptionPlans({ activeOnly: true }).catch(() => mineCache.plans || []),
    ])
      .then(([data, nextPlans]) => {
        if (cancelled) return
        applyMine(data, nextPlans)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled && !rowsRef.current.length && fetchedRef.current !== userId) {
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

  useEffect(() => {
    if (!location.state?.saved) return undefined
    const resumeId = location.state.resumeAfter ? (location.state.resumeSubscriptionId || null) : null
    if (location.state.planChanged) {
      const planLabel = location.state.planLabel || 'your new plan'
      const refundedCents = Number(location.state.refundedCents) || 0
      const chargedDeltaCents = Number(location.state.chargedDeltaCents) || 0
      const moneyLine = refundedCents > 0
        ? ` A refund of ${formatPlanPrice(refundedCents)} (including tax) has been issued to your card.`
        : chargedDeltaCents > 0
          ? ` An additional charge of ${formatPlanPrice(chargedDeltaCents)} (including tax) was made to your card.`
          : ''
      setDialog({
        icon: 'mail',
        title: location.state.pendingPlan ? 'Plan change saved' : 'Plan updated',
        body: location.state.pendingPlan
          ? `This Sunday stays as-is. ${planLabel} and these meals start the following week. Questions? Email hello@earthtableco.ca.`
          : `You're now on ${planLabel}. Your meals for this Sunday are saved.${moneyLine} Questions? Email hello@earthtableco.ca.`,
        primaryLabel: 'OK',
      })
      navigate('/my-subscriptions', { replace: true, state: {} })
      return undefined
    }
    if (resumeId) {
      // Clearing location.state remounts this effect — don't abort the in-flight resume.
      if (resumeFlowRef.current === resumeId) return undefined
      resumeFlowRef.current = resumeId
      navigate('/my-subscriptions', { replace: true, state: {} })
      ;(async () => {
        try {
          await load()
          const row = rowsRef.current.find((item) => item.id === resumeId)
          if (!row) {
            setDialog({
              icon: 'mail',
              title: 'Meals saved',
              body: 'Your box is ready. Tap Resume when you want the plan active again.',
              primaryLabel: 'OK',
            })
            return
          }
          setSavingId(row.id)
          setStatusBusy({ id: row.id, action: 'resume' })
          setDialog({
            icon: 'mail',
            title: 'Resuming…',
            body: 'Saving your meals and turning the plan back on.',
            primaryLabel: 'Resuming…',
            busy: true,
          })
          const result = await updateSubscriptionStatus(resumeId, 'resume')
          await load()
          setDialog({
            icon: 'mail',
            title: 'Plan resumed',
            body: result?.charged
              ? 'Your meals are saved. We charged this box to the card on file — the plan is active again.'
              : `Your meals are saved and the plan is active again. Next charge is ${CHARGE_DAY_TIME}.`,
            primaryLabel: 'OK',
          })
        } catch (err) {
          console.error(err)
          setDialog({
            icon: 'alert',
            title: 'Meals saved, but resume failed',
            body: err.message || 'Your box is updated. Tap Resume to try activating again.',
            primaryLabel: 'OK',
          })
        } finally {
          resumeFlowRef.current = null
          setSavingId(null)
          setStatusBusy(null)
        }
      })()
      return undefined
    }
    setDialog(SAVED_DIALOG)
    navigate('/my-subscriptions', { replace: true, state: {} })
    return undefined
  }, [location.state, navigate, userId])

  const cardSession = searchParams.get('card_session')
  const cardUpdate = searchParams.get('card_update')
  useEffect(() => {
    if (cardUpdate !== 'cancelled') return
    setSearchParams({}, { replace: true })
    setDialog({
      icon: 'alert',
      title: 'Card not saved',
      body: 'That card update was cancelled before it finished, so your previous card is still on file. Tap Edit beside the card number and complete the Stripe form to save a new card.',
      primaryLabel: 'OK',
    })
  }, [cardUpdate, setSearchParams])

  useEffect(() => {
    const sessionId = cardSession
    if (!sessionId || !userId) return undefined
    let cancelled = false
    let timer = null
    const wait = () => new Promise((resolve) => {
      timer = setTimeout(resolve, 2000)
    })
    setDialog({
      icon: 'mail',
      title: 'Confirming your card…',
      body: 'Please wait while Stripe confirms your new card. Do not close this page yet.',
      primaryLabel: 'Confirming…',
      busy: true,
    })
    const confirmCard = async () => {
      // Stripe can take a few seconds to mark a setup complete (bank auth, redirect).
      // Poll briefly instead of silently giving up on the first not-ready response.
      for (let attempt = 0; attempt < 15 && !cancelled; attempt += 1) {
        const result = await fetchCardSetup(sessionId)
        if (cancelled) return
        if (result?.ready) {
          const retry = result.retry
          let title = 'Card updated'
          let body = 'This weekly plan will use the new card for the next charge.'
          if (retry?.charged) {
            title = 'You\'re back on'
            body = 'We charged this box to your new card. The plan is active again.'
          } else if (retry && retry.ok === false && retry.reason === 'meals_need_update') {
            title = 'Card saved — finish your meals'
            body = retry.message
              || 'Your new card is on file. Choose the right number of meals for this box, then tap Resume to charge and reactivate.'
          } else if (retry && retry.ok === false) {
            title = 'Card saved, payment still failed'
            body = retry.reason
              ? `Your card is on file, but we still could not charge this week (${retry.reason}). Try another card or email hello@earthtableco.ca.`
              : 'Your card is on file, but we still could not charge this week. Try another card or email hello@earthtableco.ca.'
          } else if (retry?.ok) {
            title = 'You\'re back on'
            // Only promise a same-week charge when Stripe actually took one.
            // After a skipped cook week, resume just reactivates (next charge is Tuesday).
            body = retry.charged
              ? 'We charged this box to your new card. The plan is active again.'
              : `Your card is saved and the plan is active again. Next charge is ${CHARGE_DAY_TIME}.`
          }
          // Show success before clearing ?card_session — clearing that param
          // remounts this effect and would cancel before setDialog runs.
          setDialog({
            icon: retry && retry.ok === false ? 'alert' : 'mail',
            title,
            body,
            primaryLabel: 'OK',
          })
          setSearchParams({}, { replace: true })
          await load()
          return
        }
        if (result?.status === 'expired') break
        if (attempt < 14) await wait()
      }
      if (!cancelled) {
        setDialog({
          icon: 'alert',
          title: 'Card not confirmed yet',
          body: 'Stripe has not confirmed a new card, so your previous card is still on file and no new card was saved. If you finished a bank approval, wait a moment and refresh this page. Otherwise tap Edit beside the card number and complete the Stripe form.',
          primaryLabel: 'OK',
        })
      }
    }
    confirmCard().catch((err) => {
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
      if (timer) clearTimeout(timer)
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
      setQuoteStatus('idle')
      setDeliveryFeeCents(0)
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

  const startEdit = (row, { switchTo } = {}) => {
    const cycle = row.edit_cycle || row.cycle || {}
    const isDelivery = !!cycle.delivery
    const locked = row.week?.delivery_date || cycle.delivery_date || ''
    const nextMethod = switchTo === 'delivery' || switchTo === 'pickup'
      ? switchTo
      : (isDelivery ? 'delivery' : 'pickup')
    setEditingId(row.id)
    setNotesEditingId(null)
    setChangingId(null)
    setFulfillment(nextMethod)
    setPickupDate(locked)
    setPickupTime(cycle.pickup_time_slot || '')
    setDeliveryDate(locked)
    setPostalCode(cycle.delivery_postal_code || '')
    {
      // Pickup stores plain notes; don't dump them into Address on switch.
      const switchingFromPickup = nextMethod === 'delivery' && !isDelivery
      const parsed = parseSpecialNote(cycle.special_note, {
        delivery: nextMethod === 'delivery',
        unlabeledAs: switchingFromPickup ? 'notes' : 'address',
      })
      setDeliveryAddress(parsed.address)
      setOrderNotes(parsed.notes)
    }
  }

  const startNotesEdit = (row) => {
    const cycle = row.edit_cycle || row.cycle || {}
    const isDelivery = !!cycle.delivery
    setNotesEditingId(row.id)
    setEditingId(null)
    setChangingId(null)
    {
      const parsed = parseSpecialNote(cycle.special_note, { delivery: isDelivery })
      setDeliveryAddress(parsed.address)
      setOrderNotes(parsed.notes)
    }
  }

  const togglePlanPicker = (row) => {
    if (changingId === row.id) {
      setChangingId(null)
      return
    }
    setChangingId(row.id)
    setEditingId(null)
    setNotesEditingId(null)
  }

  const fulfillmentReady =
    fulfillment === 'pickup'
      ? Boolean(pickupTime)
      : postalValid &&
        quoteStatus === 'ok' &&
        deliveryFeeCents > 0 &&
        deliveryAddressReady(deliveryAddress)

  const persistNotes = async (row) => {
    const isDelivery = !!(row.edit_cycle || row.cycle || {}).delivery
    if (isDelivery && !deliveryAddressReady(deliveryAddress)) {
      setDialog({
        icon: 'alert',
        title: 'One more step',
        body: 'Add your full delivery address.',
        primaryLabel: 'Got it',
      })
      return
    }
    setSavingId(row.id)
    try {
      await updateSubscriptionFulfillment(row.id, {
        notes_only: true,
        special_note: composeSpecialNote({
          delivery: isDelivery,
          address: deliveryAddress,
          notes: orderNotes,
        }),
      })
      await load()
      setNotesEditingId(null)
      {
        const editCycle = row.edit_cycle || row.cycle || {}
        const nextBox = row.next_box_cycle || row.this_week_cycle || null
        const following = Boolean(
          editCycle?.id && nextBox?.id && String(editCycle.id) !== String(nextBox.id)
        )
        const nextLabel = editTargetSundayDate(row)
        setDialog(following
          ? {
            icon: 'mail',
            title: 'Notes saved for next Sunday',
            body: `This Sunday's locked box keeps its notes. Your update applies to next Sunday, ${nextLabel}. Questions? Email hello@earthtableco.ca.`,
            primaryLabel: 'Got it',
          }
          : SAVED_DIALOG)
      }
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
    if (savingId) return
    setSavingId(row.id)
    setDialog((prev) => ({
      ...(prev || {
        icon: 'mail',
        title: fulfillment === 'delivery' ? 'Save delivery?' : 'Save pickup?',
        body: 'Saving your box…',
      }),
      busy: true,
      primaryLabel: 'Saving…',
      onPrimary: undefined,
    }))
    try {
      const result = await updateSubscriptionFulfillment(row.id, {
        delivery: fulfillment === 'delivery',
        delivery_postal_code: postalCode,
        pickup_time_slot: pickupTime,
        special_note: composeSpecialNote({
          delivery: fulfillment === 'delivery',
          address: deliveryAddress,
          notes: orderNotes,
        }),
      })
      await load()
      setEditingId(null)
      setNotesEditingId(null)
      const refundedCents = Number(result?.refunded_cents) || 0
      const chargedCents = Number(result?.charged_delta_cents) || 0
      const moneyLine = refundedCents > 0
        ? ` A refund of ${formatPlanPrice(refundedCents)} (including tax) has been issued to your card.`
        : chargedCents > 0
          ? ` A delivery fee of ${formatPlanPrice(chargedCents)} (including tax) was charged to your card.`
          : ''
      setDialog({
        icon: 'mail',
        title: fulfillment === 'delivery' ? 'Switched to delivery' : 'Switched to pickup',
        body: `This week's box is updated.${moneyLine} Questions? Email hello@earthtableco.ca.`,
        primaryLabel: 'OK',
      })
    } catch (err) {
      console.error(err)
      const refundFail = /couldn'?t refund|could not refund/i.test(String(err.message || ''))
      setDialog({
        icon: 'alert',
        title: refundFail ? 'Refund didn’t go through' : 'Could not save pickup / delivery',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    } finally {
      setSavingId(null)
    }
  }

  const persistStatus = async (row, action) => {
    if (statusLockRef.current) return
    statusLockRef.current = true
    const apiAction = action === 'cancel' ? 'pause' : action
    const busyLabel = statusBusyLabel(action)
    setSavingId(row.id)
    setStatusBusy({ id: row.id, action })
    setDialog((prev) => ({
      ...(prev || { icon: 'mail', title: busyLabel }),
      busy: true,
      primaryLabel: busyLabel,
    }))
    try {
      const result = await updateSubscriptionStatus(row.id, apiAction)
      await load()
      setChangingId(null)
      if (action === 'resume') {
        setDialog({
          icon: 'mail',
          title: 'You\'re back on',
          body: result?.charged
            ? 'We charged this box to the card on file. The plan is active again.'
            : `The plan is active again. Next charge is ${CHARGE_DAY_TIME}.`,
          primaryLabel: 'OK',
        })
      } else if (result?.message) {
        const kept = Boolean(result.pending || result.first_box_kept)
        const refunded = Boolean(result.refunded || Number(result.refunded_cents) > 0)
        setDialog({
          icon: 'mail',
          // Cancel uses the same pause path — say paused so outcome matches Stripe/emails.
          title: kept ? 'Pause starts next week' : 'Plan paused',
          body: refunded && !result.message.includes('refund')
            ? `${result.message} Your charge for that box was refunded.`
            : result.message,
          primaryLabel: 'OK',
        })
      } else {
        setDialog(null)
      }
    } catch (err) {
      console.error(err)
      const refundFail = /couldn'?t refund|could not refund/i.test(String(err.message || ''))
      setDialog({
        icon: 'alert',
        title: refundFail ? 'Refund didn’t go through' : 'Could not update this plan',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    } finally {
      statusLockRef.current = false
      setSavingId(null)
      setStatusBusy(null)
    }
  }

  const confirmStatus = (row, action) => {
    if (savingId || statusLockRef.current) return
    if (action === 'resume' && cardNeedsUpdate(row.card)) {
      setDialog({
        icon: 'alert',
        title: 'Update your card first',
        body: 'This plan needs a card on file before you can resume. Questions? Email hello@earthtableco.ca.',
        primaryLabel: 'Update card',
        secondaryLabel: 'Not now',
        onPrimary: () => changeCard(row),
      })
      return
    }
    // Normal resume (and payment-failed): always review meals first, then reactivate.
    if (action === 'resume' && !row.pending_status) {
      const mealCount = Number(row.subscription_plans?.meal_count) || 0
      const lockBy = row.week?.cutoff_label || MEAL_LOCK_BY
      const keptCycle = row.next_box_cycle || row.this_week_cycle || null
      // Keep-Sunday pause only after lock — paid+open pauses refund and skip.
      const keptLocked = Boolean(keptCycle && keptCycle.status === 'locked')
      const keptLabel = keptLocked
        ? (
          shortMonthDay(keptCycle.delivery_date)
          || shortMonthDay(row.next_box_date)
          || sundayDatePart(row.week?.delivery_label)
          || ''
        )
        : null
      const followingLabel = shortMonthDay(row.edit_cycle?.delivery_date)
        || shortMonthDay(row.week?.delivery_date)
        || sundayDatePart(row.week?.delivery_label)
        || 'the following week'
      const sunday = shortMonthDay(row.week?.delivery_date)
        || sundayDatePart(row.week?.delivery_label)
        || shortMonthDay(row.next_box_date)
        || 'this Sunday'
      const when = keptLocked
        ? `${thisSundayCopy(keptLabel)} is already locked, so that box still goes out. Resume turns the plan back on for later weeks.`
        : row.week?.cutoff_passed
          ? `Because this week's cutoff has passed, resume only applies to the following week${sunday && sunday !== 'this Sunday' ? ` (${sunday})` : ''}.`
          : `Resume applies to this week${sunday && sunday !== 'this Sunday' ? ` (${sunday})` : ''}.`
      const beforeTuesdayCharge = row.charge?.before_wednesday !== false
      // Match retryFailedCharge: charge unpaid open / reopenable skip cook weeks.
      // After a refunded pause-skip, mine may hide the skipped cycle — still charge
      // after Tuesday when there is no locked/paid next box and lock has not passed.
      const chargeNow = !keptLocked
        && (row.pause_reason === 'payment_failed' || !beforeTuesdayCharge)
        && (
          Boolean(unpaidOpenCookCycle(row) || unpaidSkippedCookCycle(row))
          || (
            !beforeTuesdayCharge
            && !row.next_box_date
            && !row.week?.cutoff_passed
          )
        )
      const mealsLine = keptLocked
        ? (
          mealCount
            ? `That Sunday's meals are locked. Confirm exactly ${mealCount} meal${mealCount === 1 ? '' : 's'} for ${followingLabel} before ${lockBy}. The plan resumes after you save.`
            : `That Sunday's meals are locked. Confirm meals for ${followingLabel} before ${lockBy}. The plan resumes after you save.`
        )
        : (
          mealCount
            ? `Confirm exactly ${mealCount} meal${mealCount === 1 ? '' : 's'} for that box before ${lockBy}. The plan resumes after you save.`
            : `Confirm your meals for that box before ${lockBy}. The plan resumes after you save.`
        )
      setDialog({
        icon: 'mail',
        title: 'Review your meals first',
        body: [
          when,
          mealsLine,
          chargeNow
            ? 'After meals are saved we charge the unpaid box to the card on file.'
            : `After meals are saved the plan turns back on. Next charge is ${CHARGE_DAY_TIME} for a following Sunday — you can pause again before then if you change your mind.`,
        ].filter(Boolean),
        primaryLabel: 'Review meals',
        secondaryLabel: 'Not now',
        onPrimary: () => navigate(`/my-subscriptions/${row.id}/meals`, {
          state: { fresh: true, resumeAfter: true },
        }),
      })
      return
    }

    const boxCycle = row.next_box_cycle || row.this_week_cycle || null
    // Same rule as the API: keep this Sunday only when locked; paid+open refunds and skips.
    const thisSundayLocked = Boolean(boxCycle && boxCycle.status === 'locked')
    const thisSundayPaidOpen = Boolean(
      boxCycle
      && boxCycle.status === 'open'
      && Number(boxCycle.plan_paid_cents) > 0
    )
    const firstProtected = Boolean(row.first_box_protected)
    const firstSunday = row.first_delivery_label
      || sundayDatePart(row.week?.delivery_label)
      || 'this Sunday'
    // After lock, row.week is the following Sunday — name the locked shipping box instead.
    const lockedSunday = thisSundayLocked
      ? (
        shortMonthDay(boxCycle.delivery_date)
        || shortMonthDay(row.this_week_date)
        || ''
      )
      : null
    const sunday = lockedSunday
      || shortMonthDay(row.week?.delivery_date)
      || sundayDatePart(row.week?.delivery_label)
      || shortMonthDay(row.next_box_date)
      || 'this Sunday'
    const resumeBy = resumeByLock(row.week?.cutoff_label)
    const keepSundayBody = `${thisSundayCopy(sunday)} is already locked, so it still goes out. The plan is paused starting the following week — your meals and card stay ready so you can resume anytime.`
    const refundSkipBody = [
      `${thisSundayCopy(sunday)} will be skipped and your charge for that box will be refunded. Your meals and card stay ready so you can resume anytime.`,
      resumeBy,
    ]
    const skipSundayBody = [
      `${thisSundayCopy(sunday)} will be skipped. Your meals and card stay ready so you can resume anytime.`,
      resumeBy,
    ]
    const copy = {
      pause: firstProtected
        ? {
          title: 'Pause after your first box?',
          body: [
            `Your first box on ${firstSunday} can't be cancelled — it still goes out. You can still change add-ons on that box until ${MEAL_LOCK_BY}. Later weeks stay paused until you resume.`,
            resumeBy,
          ],
        }
        : thisSundayLocked
        ? {
          title: 'Pause after this Sunday?',
          body: keepSundayBody,
        }
        : {
          title: 'Pause this plan?',
          body: thisSundayPaidOpen ? refundSkipBody : skipSundayBody,
        },
      cancel: firstProtected
        ? {
          title: 'Pause after your first box?',
          body: [
            `Your first box on ${firstSunday} can't be skipped — it still goes out. You can still change add-ons on that box until ${MEAL_LOCK_BY}. Later weeks pause; your meals and card stay ready to resume.`,
            resumeBy,
          ],
        }
        : thisSundayLocked
        ? {
          title: 'Pause after this Sunday?',
          body: keepSundayBody,
        }
        : {
          title: 'Pause this plan?',
          body: thisSundayPaidOpen
            ? [
              `${thisSundayCopy(sunday)} will be skipped and your charge for that box will be refunded. Your meals and card stay ready so you can resume anytime.`,
              resumeBy,
            ]
            : [
              `${thisSundayCopy(sunday)} will be skipped. Your meals and card stay ready so you can resume anytime.`,
              resumeBy,
            ],
        },
      resume: {
        // Only pending-pause / pending-cancel clear reaches here (meal review is above).
        title: 'Resume this plan?',
        body: lockedSunday
          ? `${thisSundayCopy(lockedSunday)} still goes out, and the pending change will be cleared.`
          : 'This Sunday still goes out, and the pending change will be cleared.',
      },
    }[action]
    setDialog({
      icon: 'mail',
      title: copy.title,
      body: copy.body,
      primaryLabel: action === 'cancel' || action === 'pause' ? 'Pause plan' : 'Resume',
      secondaryLabel: 'Never mind',
      onPrimary: () => persistStatus(row, action),
    })
  }

  /** Defer plan size only after meal lock — paid+open applies this Sunday with a Stripe delta. */
  const planChangePendingFor = (row) => {
    const box = row.this_week_cycle || row.cycle || row.edit_cycle || {}
    return box.status === 'locked' || Boolean(row.week?.cutoff_passed)
  }

  const editsApplyNextWeek = (row) => Boolean(
    row?.week?.cutoff_passed
    || row?.week?.applies_to === 'next_week'
  )

  /** After Wednesday lock, warn once before meal/add-on edit so next-week targeting is clear. */
  const goEditBox = (row, kind = 'meals') => {
    const path = kind === 'addons'
      ? `/my-subscriptions/${row.id}/addons`
      : `/my-subscriptions/${row.id}/meals`
    const go = () => navigate(path, { state: { fresh: true } })
    if (!editsApplyNextWeek(row)) {
      go()
      return
    }
    const sunday = editTargetSundayDate(row)
    setDialog({
      icon: 'mail',
      title: 'These changes are for next week',
      body: `This week's cutoff has passed, so these changes apply to next Sunday, ${sunday} only. This Sunday's box is already locked.`,
      primaryLabel: 'Continue',
      secondaryLabel: 'Never mind',
      onPrimary: go,
    })
  }

  const startPlanChange = (row, plan) => {
    if (!user?.id) return
    const pending = planChangePendingFor(row)
    const source = row.edit_cycle || row.cycle
    const draft = seedEditCartForPlanChange(row, source, plan, { pending })
    writeEditCart(user.id, row.id, draft)
    setChangingId(null)
    setDialog(null)
    navigate(`/my-subscriptions/${row.id}/meals`, { state: { planChange: true } })
  }

  const confirmPlan = (row, plan) => {
    const pending = planChangePendingFor(row)
    const sunday = sundayDatePart(row.week?.delivery_label)
    const currentCount = Number(row.subscription_plans?.meal_count) || 0
    const nextCount = Number(plan.meal_count) || 0
    const downgrade = nextCount > 0 && currentCount > nextCount
    const paidBox = row.this_week_cycle || row.cycle || {}
    const moneyLine = planChangeMoneyPreview({
      planPaidCents: paidBox.plan_paid_cents,
      nextPriceCents: plan.price_cents,
      pending,
    })
    setDialog({
      icon: 'mail',
      title: `Switch to ${mealsAWeek(plan.meal_count)}?`,
      body: [
        pending
          ? `${thisSundayCopy(sunday)} stays on your current plan (already locked). ${mealsAWeek(plan.meal_count)} starts the following week.`
          : Number(paidBox.plan_paid_cents) > 0
            ? `${thisSundayCopy(sunday)} will use the new plan.${moneyLine || ' If the price is lower we refund the difference; if higher we charge the difference (including tax).'}`
            : `${thisSundayCopy(sunday)} will use the new plan.`,
        downgrade
          ? `Next you'll review meals and remove extras until exactly ${nextCount} remain — you can't continue until the count matches.`
          : `Next you'll review meals and leave exactly ${nextCount} for that box — the change only finishes when you confirm.`,
        'Need help? Email hello@earthtableco.ca.',
      ],
      primaryLabel: 'Review meals',
      secondaryLabel: 'Never mind',
      onPrimary: () => startPlanChange(row, plan),
    })
  }

  const changeCard = async (row) => {
    if (savingId) return
    setSavingId(row.id)
    try {
      const result = await startCardSetup(row.id)
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
    const editBox = row.edit_cycle || row.cycle || {}
    const wasDelivery = !!editBox.delivery
    const copy = weekSaveCopy(row.week, {
      deliveryFeeCents,
      switchingToDelivery: fulfillment === 'delivery' && !wasDelivery,
      switchingToPickup: fulfillment === 'pickup' && wasDelivery,
      lockedPriorCycle: Boolean(
        row.week?.cutoff_passed
        || row.week?.applies_to === 'next_week'
      ),
      planAlreadyPaid: Number(editBox.plan_paid_cents) > 0 || Boolean(row.first_box_protected),
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
    setDialog({
      icon: 'alert',
      title: 'Subscription details',
      asList: true,
      body: subscriptionDetailsItems(),
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

  const waitingForAuth = !userId && !authWait
  const waitingForMine = Boolean(userId) && !rows.length && fetchedUserId !== userId
  if ((isLoading && !rows.length) || waitingForAuth || waitingForMine) {
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
        {!userId ? (
          <>
            <div className="my-sub-page-header">
              <h1 className="my-sub-h1">My plans</h1>
            </div>
            <div className="order-history-empty">
              <p className="order-history-empty-copy">Sign in to see your weekly plans.</p>
              <Link to="/login?next=/my-subscriptions" className="order-history-button">Log in</Link>
            </div>
          </>
        ) : fetchedUserId === userId && !rows.length ? (
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
            const nextBoxCycle = row.next_box_cycle || row.this_week_cycle || null
            const nextBoxLines = nextBoxCycle
              ? cycleLineItems({
                ...nextBoxCycle,
                promo_percent: Number(row.addon_promo_percent) || Number(nextBoxCycle.promo_percent) || 0,
              })
              : null
            const editCycle = row.edit_cycle || null
            const editLines = cycleLineItems({
              ...(editCycle || cycle),
              promo_percent: Number(row.addon_promo_percent)
                || Number((editCycle || cycle).promo_percent)
                || 0,
            })
            const displayLines = cycleLineItems({
              ...cycle,
              promo_percent: Number(row.addon_promo_percent) || Number(cycle.promo_percent) || 0,
            })
            const meals = displayLines.meals
            const addons = displayLines.addons
            const mealQty = displayLines.mealQty
            const extrasCents = displayLines.extrasCents
            const extrasDueCents = displayLines.extrasDueCents
            const currentPlanCount = Number(plan.meal_count) || 0
            const editMealCount = Number(row.edit_meal_count) || currentPlanCount
            const nextBoxMealCount = Number(nextBoxCycle?.meal_count) || currentPlanCount
            const followingMealCount = Number(editCycle?.meal_count) || editMealCount
            const editNeedQty = editLines.mealQty
            const isDelivery = !!(nextBoxCycle || cycle).delivery
            const lockedCycle = row.this_week_cycle
            const statusLocked = Boolean(
              (nextBoxCycle || lockedCycle)
              && (nextBoxCycle || lockedCycle).status === 'locked'
            )
            const boxDate = (nextBoxCycle || cycle).delivery_date
            const clockLocked = Boolean(
              row.week?.cutoff_passed
              && boxDate
              && String(row.week.delivery_date) === String(boxDate)
            )
            const nextBoxIsLocked = statusLocked || clockLocked
            const lockedLines = nextBoxLines
            const showingFollowingWeek = statusLocked
            const ymd = showingFollowingWeek
              ? (lockedCycle.delivery_date || row.this_week_date)
              : (row.week?.delivery_date || cycle.delivery_date || cycle.pickup_date)
            const canEdit = Boolean(row.can_edit)
            const isPaused = row.status === 'paused'
            const paymentFailedPause = isPaused && row.pause_reason === 'payment_failed'
            const needsCardUpdate = cardNeedsUpdate(row.card)
            const pending = row.pending_status
            const pendingPlan = row.pending_plan
            const lockedDate = row.week?.delivery_date || cycle.delivery_date || cycle.pickup_date || ''
            const lockCadence = row.week?.cadence_label || MEAL_LOCK_BY
            const lockBy = row.week?.cutoff_label || MEAL_LOCK_BY
            const followingWeekLabel = (row.edit_cycle?.delivery_date || row.week?.delivery_date || row.week?.delivery_label)
              ? `Following week, ${editTargetSundayDate(row)}`
              : 'Following week'
            const nextBoxShort = row.next_box_date
              ? shortWeekdayDate(row.next_box_date)
              : (row.first_box_protected ? row.first_delivery_label : '')
            // pending paused is rare now (keep-Sunday pause sets status=paused immediately).
            const statusNote = paymentFailedPause || needsCardUpdate
              ? ''
              : pending === 'paused'
                ? pausingAfterCutoffBanner(nextBoxShort || sundayDatePart(row.week?.delivery_label))
                : isPaused
                  ? pausedBanner(row.week?.cutoff_label, {
                    firstBoxLabel: row.first_box_protected ? row.first_delivery_label : '',
                    nextBoxLabel: row.next_box_date ? nextBoxShort : '',
                  })
                : pending === 'cancelled'
                  ? pendingCancelBanner(nextBoxShort || sundayDatePart(row.week?.delivery_label))
                  : statusLocked
                    ? `This week's cutoff has passed. Edits now apply to next Sunday, ${editTargetSundayDate(row)}.`
                    : row.meals_need_update
                      ? (
                        editNeedQty < editMealCount
                          ? `You're on ${mealsAWeek(editMealCount)} but this box only has ${editNeedQty}. Choose exactly ${editMealCount} before ${lockBy} or you may be short after you're charged.`
                          : `You're on ${mealsAWeek(editMealCount)} but this box has ${editNeedQty}. Bring it to exactly ${editMealCount} before ${lockBy}.`
                      )
                      : pendingPlan
                        ? `Starting next week: ${mealsAWeek(pendingPlan.meal_count)} (${formatPlanPrice(pendingPlan.price_cents)}/week).`
                        : ''
            // Paused plans review meals on Resume — don't red-alert "Fix meals" here.
            const mealsNeedUpdate = Boolean(
              row.meals_need_update
              && !paymentFailedPause
              && !statusLocked
              && !isPaused
            )
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
            const boxForDetails = nextBoxCycle || cycle
            const savedDeliveryFeeCents = Number(boxForDetails?.delivery_fee_cents) || 0
            const savedDeliveryWithTax = Math.round(savedDeliveryFeeCents * (1 + HST_RATE))
            const notesEditCycle = editCycle || cycle
            // Notes are per cycle — never fall back to subscription.special_note.
            const note = formatSpecialNoteDisplay(boxForDetails.special_note, {
              delivery: isDelivery,
            })
            const notesEditFollowing = Boolean(
              canEdit
              && notesEditCycle?.id
              && boxForDetails?.id
              && String(notesEditCycle.id) !== String(boxForDetails.id)
            )
            const notesEditSunday = notesEditFollowing
              ? editTargetSundayDate(row)
              : editTargetSundayDate({
                edit_cycle: null,
                week: {
                  delivery_date: boxForDetails.delivery_date || ymd,
                  delivery_label: row.week?.delivery_label,
                },
              })
            const location = isDelivery
              ? (boxForDetails.delivery_postal_code || '—')
              : PICKUP_ADDRESS
            const windowLabel = isDelivery
              ? DELIVERY_WINDOW
              : (formatPickupSlot(boxForDetails.pickup_time_slot) || '—')
            const mealsBy = everyWeekBy(lockCadence)
            const pauseBy = everyWeekBy(lockCadence || PAUSE_CANCEL_BY)
            const expiry = cardExpiryState(row.card)
            const isNextOpen = Boolean(nextWeekOpen[row.id])
            const nextWeekPanelId = `next-week-${row.id}`
            const extrasPromoLabel = firstWeekCodeLabel(row.first_promo_code, row.first_promo_kind)
            const hasUpcomingBox = Boolean(
              row.next_box_date
              || row.first_box_protected
              || (row.status === 'active' && (nextBoxCycle || cycle?.delivery_date))
            )
            const nextBoxItems = hasUpcomingBox ? (
              <CycleItems
                meals={nextBoxLines ? nextBoxLines.meals : meals}
                mealQty={nextBoxLines ? nextBoxLines.mealQty : mealQty}
                mealCount={nextBoxMealCount}
                addons={nextBoxLines ? nextBoxLines.addons : addons}
                extrasCents={nextBoxLines ? nextBoxLines.extrasCents : extrasCents}
                extrasDueCents={nextBoxLines ? nextBoxLines.extrasDueCents : extrasDueCents}
                extrasPromoLabel={extrasPromoLabel}
                canEdit={canEdit}
                subscriptionId={row.id}
                mealsLabel="Next box meals"
                extrasLabel="Next box extras"
                extrasSummaryLabel="Total"
                emptyMeals="No meals selected for next box."
                emptyExtras="No extras for next box."
                lockCadence={lockCadence}
                showEditLinks={!nextBoxIsLocked && canEdit}
                showMealCount
                showLockedBadge={nextBoxIsLocked}
                onEditMeals={() => goEditBox(row, 'meals')}
                onEditAddons={() => goEditBox(row, 'addons')}
              />
            ) : (
              <div>
                <div className="my-sub-section-head">
                  <p className="my-sub-section-label">Next box</p>
                </div>
                <p className="my-sub-empty-extras">—</p>
              </div>
            )
            const followingUsesRepeat = Boolean(
              showingFollowingWeek
              && lockedLines
              && !editLines.meals.length
              && lockedLines.meals.length
            )
            const followingMeals = followingUsesRepeat ? lockedLines.meals : editLines.meals
            const followingMealQty = followingUsesRepeat ? lockedLines.mealQty : editLines.mealQty
            const followingWeekItems = (
              <CycleItems
                meals={followingMeals}
                mealQty={followingMealQty}
                mealCount={followingMealCount}
                addons={editLines.addons}
                extrasCents={editLines.extrasCents}
                extrasDueCents={editLines.extrasDueCents}
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
                onEditMeals={() => goEditBox(row, 'meals')}
                onEditAddons={() => goEditBox(row, 'addons')}
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
                          <p className="my-sub-section-count">{followingMealQty} of {followingMealCount}</p>
                          {canEdit ? (
                            <>
                              <button
                                type="button"
                                className="my-sub-section-link"
                                onClick={() => goEditBox(row, 'meals')}
                              >
                                Edit meals
                              </button>
                              <button
                                type="button"
                                className="my-sub-section-link"
                                onClick={() => goEditBox(row, 'addons')}
                              >
                                Edit add-ons
                              </button>
                            </>
                          ) : null}
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
                      <div className="my-sub-plan-block">
                        <div className="my-sub-card-title-row">
                          <h2 className="my-sub-card-title">{mealsAWeek(plan.meal_count)}</h2>
                          <span className={statusChipClass}>{statusLabel}</span>
                          {canEdit && !isPaused && otherPlans.length ? (
                            <button
                              type="button"
                              className="my-sub-edit-link"
                              disabled={savingId === row.id}
                              onClick={() => togglePlanPicker(row)}
                            >
                              {changingId === row.id ? 'Close' : 'Change plan'}
                            </button>
                          ) : null}
                        </div>
                        <p className="my-sub-price-badge" aria-label="Plan price and fulfillment">
                          {formatPlanPrice(plan.price_cents)}/week · {isDelivery ? 'delivery' : 'pickup'}
                        </p>
                        {changingId === row.id && canEdit && !isPaused && otherPlans.length ? (
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
                      </div>
                      {row.created_at ? (
                        <p className="my-sub-card-since">
                          Subscribed since {subscribedSince(row.created_at)}
                        </p>
                      ) : null}
                      {paymentFailedPause ? (
                        <div className="my-sub-status-note my-sub-status-note--alert" role="status">
                          <p>{paymentFailedBanner({
                            // After Wednesday skip, next_box_date is empty — don't still say "keep this Sunday".
                            canKeepThisSunday: Boolean(row.next_box_date || row.first_box_protected),
                          })}</p>
                          <button
                            type="button"
                            className="my-sub-edit-link"
                            disabled={savingId === row.id}
                            onClick={() => changeCard(row)}
                          >
                            Update your card
                          </button>
                        </div>
                      ) : needsCardUpdate ? (
                        <div className="my-sub-status-note my-sub-status-note--alert" role="status">
                          <p>
                            This plan needs a card on file before the next charge or resume. Questions? Email hello@earthtableco.ca.
                          </p>
                          <button
                            type="button"
                            className="my-sub-edit-link"
                            disabled={savingId === row.id}
                            onClick={() => changeCard(row)}
                          >
                            Update your card
                          </button>
                        </div>
                      ) : mealsNeedUpdate && statusNote ? (
                        <div className="my-sub-status-note my-sub-status-note--alert" role="status">
                          <p>{statusNote}</p>
                          {canEdit ? (
                            <button
                              type="button"
                              className="my-sub-edit-link"
                              onClick={() => goEditBox(row, 'meals')}
                            >
                              Fix meals
                            </button>
                          ) : null}
                        </div>
                      ) : pendingPlan && statusNote ? (
                        <div className="my-sub-status-note" role="status">
                          <p>{statusNote}</p>
                          {canEdit && !row.week?.cutoff_passed ? (
                            <button
                              type="button"
                              className="my-sub-edit-link"
                              onClick={() => setDialog({
                                icon: 'mail',
                                title: 'Edit next week after cutoff',
                                body: [
                                  `Your ${mealsAWeek(pendingPlan.meal_count)} meals for next week are already confirmed.`,
                                  `You can edit that box after this week's cutoff (${lockBy}). Until then, Edit meals only changes this Sunday.`,
                                ],
                                primaryLabel: 'OK',
                              })}
                            >
                              Edit next week&apos;s meals
                            </button>
                          ) : null}
                        </div>
                      ) : statusNote ? (
                        <p className="my-sub-status-note">{statusNote}</p>
                      ) : null}
                    </div>

                    <div className="my-sub-card-details">
                      <DetailRow label="Next box" emphasize>
                        {row.next_box_date
                          ? shortWeekdayDate(row.next_box_date)
                          : (row.first_box_protected && row.first_delivery_date
                            ? shortWeekdayDate(row.first_delivery_date)
                            : (row.status === 'active' && hasUpcomingBox
                              ? shortWeekdayDate(ymd)
                              : '—'))}
                      </DetailRow>
                      <div className="my-sub-fulfillment-block">
                        <DetailRow
                          label={isDelivery ? 'Delivery' : 'Pickup'}
                          sublabel={
                            isDelivery && savedDeliveryFeeCents > 0
                              ? `${formatPlanPrice(savedDeliveryFeeCents)} + HST = ${formatPlanPrice(savedDeliveryWithTax)}`
                              : null
                          }
                          action={canEdit ? (
                            <button
                              type="button"
                              className="my-sub-edit-link"
                              disabled={savingId === row.id}
                              onClick={() => (
                                editingId === row.id
                                  ? setEditingId(null)
                                  : startEdit(row, {
                                    switchTo: isDelivery ? 'pickup' : 'delivery',
                                  })
                              )}
                            >
                              {editingId === row.id
                                ? 'Close'
                                : (isDelivery ? 'Change to pickup' : 'Change to delivery')}
                            </button>
                          ) : null}
                        >
                          {windowLabel}
                        </DetailRow>
                        <DetailRow label="Location">{location}</DetailRow>
                        {editingId === row.id && canEdit ? (
                          <div className="my-sub-fulfillment my-sub-fulfillment--inline">
                            <div className="my-sub-fulfill-chooser">
                              <p className="my-sub-fulfill-heading">How you&apos;ll get it</p>
                              <div
                                className="my-sub-fulfill-row"
                                role="radiogroup"
                                aria-label="How you'll get it"
                              >
                                <label className="my-sub-fulfill-option">
                                  <input
                                    type="radio"
                                    name={`sub-fulfillment-${row.id}`}
                                    value="pickup"
                                    checked={fulfillment === 'pickup'}
                                    onChange={() => setFulfillment('pickup')}
                                  />
                                  Pickup
                                </label>
                                <label className="my-sub-fulfill-option">
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
                                feeLine={
                                  quoteStatus === 'loading' ? (
                                    <p className="my-sub-fee-line my-sub-fee-line--muted" role="status">
                                      Calculating delivery fee…
                                    </p>
                                  ) : quoteStatus === 'ok' && deliveryFeeCents > 0 ? (
                                    <p className="my-sub-fee-line">
                                      Delivery {formatPlanPrice(deliveryFeeCents)} + HST {formatPlanPrice(deliveryWithTax - deliveryFeeCents)} = {formatPlanPrice(deliveryWithTax)}
                                    </p>
                                  ) : quoteStatus === 'out' ? (
                                    <p className="my-sub-fee-line my-sub-fee-line--alert" role="alert">
                                      Delivery not available for this area. Questions? Email hello@earthtableco.ca.
                                    </p>
                                  ) : quoteStatus === 'error' ? (
                                    <p className="my-sub-fee-line my-sub-fee-line--alert" role="alert">
                                      Couldn&apos;t calculate delivery. Check the postal code and try again. Questions? Email hello@earthtableco.ca.
                                    </p>
                                  ) : null
                                }
                              />
                            )}

                            <div className="my-sub-fulfill-notes">
                              {notesEditFollowing ? (
                                <p className="my-sub-repeat-note">
                                  This Sunday&apos;s locked box keeps its current notes. Saving here updates only next Sunday
                                  {notesEditSunday ? `, ${notesEditSunday}` : ''}. Questions? Email hello@earthtableco.ca.
                                </p>
                              ) : (
                                <p className="my-sub-repeat-note">
                                  Address and notes are for this Sunday&apos;s box. If you don&apos;t change them, they carry over next week. Questions? Email hello@earthtableco.ca.
                                </p>
                              )}
                              <SpecialNoteFields
                                fulfillment={fulfillment}
                                address={deliveryAddress}
                                notes={orderNotes}
                                onAddressChange={setDeliveryAddress}
                                onNotesChange={setOrderNotes}
                                idPrefix={`sub-fulfill-${row.id}`}
                                className="my-sub-special-note-stack"
                              />
                            </div>

                            <button
                              type="button"
                              className="order-history-button"
                              disabled={!fulfillmentReady || savingId === row.id}
                              onClick={() => saveFulfillment(row)}
                            >
                              {savingId === row.id
                                ? 'Saving…'
                                : (fulfillment === 'delivery' ? 'Save delivery' : 'Save pickup')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="my-sub-notes-block">
                        <DetailRow
                          label={isDelivery ? 'Address & notes' : 'Notes'}
                          action={canEdit ? (
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
                              {notesEditingId === row.id
                                ? 'Close'
                                : (notesEditFollowing ? 'Edit for next Sunday' : 'Edit')}
                            </button>
                          ) : null}
                        >
                          {note || 'None'}
                        </DetailRow>
                        {notesEditFollowing && notesEditingId !== row.id ? (
                          <p className="my-sub-repeat-note">
                            This Sunday&apos;s box is locked — its notes stay as shown. Edits apply only to next Sunday
                            {notesEditSunday ? `, ${notesEditSunday}` : ''}. Questions? Email hello@earthtableco.ca.
                          </p>
                        ) : null}
                        {notesEditingId === row.id && canEdit ? (
                          <div className="my-sub-notes-inline">
                            {notesEditFollowing ? (
                              <p className="my-sub-repeat-note">
                                This Sunday&apos;s locked box keeps the notes shown above. Saving here updates only next Sunday
                                {notesEditSunday ? `, ${notesEditSunday}` : ''}. Questions? Email hello@earthtableco.ca.
                              </p>
                            ) : (
                              <p className="my-sub-repeat-note">
                                {isDelivery
                                  ? 'Address and notes are for this Sunday\'s box. If you don\'t change them, they carry over next week. Questions? Email hello@earthtableco.ca.'
                                  : 'Notes are for this Sunday\'s box. If you don\'t change them, they carry over next week. Questions? Email hello@earthtableco.ca.'}
                              </p>
                            )}
                            <SpecialNoteFields
                              fulfillment={isDelivery ? 'delivery' : 'pickup'}
                              address={deliveryAddress}
                              notes={orderNotes}
                              onAddressChange={setDeliveryAddress}
                              onNotesChange={setOrderNotes}
                              idPrefix={`sub-notes-${row.id}`}
                              className="my-sub-special-note-stack"
                            />
                            <button
                              type="button"
                              className="order-history-button"
                              disabled={savingId === row.id || (isDelivery && !deliveryAddressReady(deliveryAddress))}
                              onClick={() => persistNotes(row)}
                            >
                              {savingId === row.id ? 'Saving…' : (isDelivery ? 'Save address & notes' : 'Save notes')}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <DetailRow label="Change meals by">{mealsBy}</DetailRow>
                      <p className="my-sub-repeat-note">{UNCHANGED_MEALS}</p>
                      <DetailRow label="Pause or cancel by">
                        {row.first_box_protected
                          ? `after your first box, ${pauseBy}`
                          : pauseBy}
                      </DetailRow>
                      <DetailRow label="Card on file">
                        {cardLabel(row.card)}
                        <button
                          type="button"
                          className={`my-sub-edit-link${paymentFailedPause || needsCardUpdate ? ' my-sub-edit-link--alert' : ''}`}
                          disabled={savingId === row.id}
                          onClick={() => changeCard(row)}
                        >
                          {needsCardUpdate ? 'Update card' : 'Edit'}
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

                    {isPaused ? (
                      <div className="my-sub-card-actions">
                        <button
                          type="button"
                          className="my-sub-primary"
                          disabled={savingId === row.id}
                          onClick={() => confirmStatus(row, 'resume')}
                        >
                          {statusBusy?.id === row.id && statusBusy.action === 'resume'
                            ? 'Resuming…'
                            : 'Resume'}
                        </button>
                      </div>
                    ) : null}

                    <div className="my-sub-card-danger">
                      {canEdit && pending && row.cancelled_reason !== 'plan_discontinued' ? (
                        <button
                          type="button"
                          className="my-sub-danger-link"
                          disabled={savingId === row.id}
                          onClick={() => confirmStatus(row, 'resume')}
                        >
                          {statusBusy?.id === row.id && statusBusy.action === 'resume'
                            ? 'Resuming…'
                            : 'Keep this Sunday'}
                        </button>
                      ) : canEdit && !isPaused ? (
                        <button
                          type="button"
                          className="my-sub-danger-link"
                          disabled={savingId === row.id}
                          onClick={() => confirmStatus(row, 'pause')}
                        >
                          {statusBusy?.id === row.id && statusBusy.action === 'pause'
                            ? 'Pausing…'
                            : 'Pause plan'}
                        </button>
                      ) : null}
                      {/* Already paused (manual or payment_failed): Cancel/Pause are no-ops. */}
                      {!isPaused ? (
                        <button
                          type="button"
                          className="my-sub-danger-link my-sub-danger-link--cancel"
                          disabled={savingId === row.id}
                          onClick={() => confirmStatus(row, 'cancel')}
                        >
                          {statusBusy?.id === row.id && statusBusy.action === 'cancel'
                            ? 'Pausing…'
                            : 'Cancel plan'}
                        </button>
                      ) : null}
                    </div>

                    <div className="my-sub-card-terms">
                      <button type="button" className="my-sub-text-link" onClick={() => openPlanDetails(row)}>
                        View plan details &amp; rules
                      </button>
                    </div>
                  </div>
                </aside>
              </section>
            )
          })}
          </>
        )}
      </div>
      <FeedbackDialog
        dialog={dialog}
        onClose={() => {
          if (!dialog?.busy) setDialog(null)
        }}
      />
    </div>
  )
}

export default MySubscriptions

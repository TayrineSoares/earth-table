/**
 * Customer-facing subscription cadence phrases.
 * Keep in sync with backend/src/emails/subscriptionEmailSpec.js
 *
 * Live fallbacks (when dates have not loaded yet):
 * Charge: Tuesday 9:00 AM ET (plan + delivery).
 * Lock: Wednesday 5:00 PM ET (add-ons + meal lock).
 * Pause / cancel / plan-change for this Sunday: before Tuesday 9:00 AM ET.
 *
 * Customer copy uses these standing weekday times. Calendar dates stay on
 * the box itself (confirmation, meal picker) via cutoff_label / charge_label.
 */

export const PAUSE_CANCEL_BY = 'Tuesday at 9:00 AM ET'
export const MEAL_LOCK_BY = 'Wednesday at 5:00 PM ET'
export const UNCHANGED_MEALS = "If you don't change anything, we repeat last week's meals. Add-ons don't repeat unless you add them again."
export const CHARGE_DAY_TIME = 'Tuesday at 9:00 AM ET'
export const LOCK_DAY_TIME = 'Wednesday at 5:00 PM ET'

export function howItWorksCharge() {
  return 'Plan and delivery are charged every Tuesday at 9:00 AM ET. Add-ons are charged Wednesday at 5:00 PM ET.'
}

export function howItWorksPause() {
  return `Your first box can't be paused or cancelled. After that, pause or cancel anytime before ${PAUSE_CANCEL_BY}. No fees.`
}

export function howItWorksMeals() {
  return `Change meals and extras for that week in My Subscriptions until Wednesday at 5:00 PM ET. ${UNCHANGED_MEALS}`
}

export function howItWorksFirstDelivery(firstDeliveryLabel) {
  const label = String(firstDeliveryLabel || '').trim()
  return label ? `Sign up now and your first delivery is ${label}.` : null
}

/** Shared copy for the Subscription details panel (checkout + My Subscriptions). */
export function subscriptionDetailsItems({
  firstDeliveryLabel,
  signingUp = false,
} = {}) {
  return [
    howItWorksCharge(),
    howItWorksPause(),
    signingUp ? howItWorksFirstDelivery(firstDeliveryLabel) : null,
    howItWorksMeals(),
  ].filter(Boolean)
}

/** Marketing page: standing weekly cadence, not this week's calendar dates. */
export function howItWorksFlexible() {
  return 'Update your meals and add-ons every week by Wednesday at 5:00 PM ET.'
}

/** Marketing page badge: standing weekly cadence, not this week's calendar date. */
export function orderByCutoff() {
  return 'Order by Wednesday at 5:00 PM ET. Delivered the following Sunday.'
}

export function addonsBilledAt(cutoffLabel, { firstWeekRate = false } = {}) {
  const when = cutoffLabel || LOCK_DAY_TIME
  return firstWeekRate
    ? `Add-ons billed ${when} (first-week rate)`
    : `Add-ons billed ${when}`
}

export function resumeByCharge(chargeLabel) {
  return `Resume by ${chargeLabel || PAUSE_CANCEL_BY} for that week's box.`
}

/** Standing weekly deadline: "every week by Wednesday at 5:00 PM ET". */
export function everyWeekBy(cadenceLabel, fallback) {
  const label = String(cadenceLabel || fallback || '').trim()
  if (!label) return ''
  if (/^every week by /i.test(label)) return label
  return `every week by ${label}`
}

export function pausedBanner(chargeLabel, { firstBoxLabel } = {}) {
  if (firstBoxLabel) {
    return `This plan is paused. Your first box still goes out on ${firstBoxLabel}. You can still change add-ons on that box until Wednesday at 5:00 PM ET. Resume by ${chargeLabel || PAUSE_CANCEL_BY} to also get the following Sunday.`
  }
  return `This plan is paused. Your last meals and card stay on file. Resume by ${chargeLabel || PAUSE_CANCEL_BY} to get that Sunday's box.`
}

/** Auto-pause after a declined Tuesday charge. Sunday/cutoff details stay on the email. */
export function paymentFailedBanner() {
  return 'Your subscription is paused because your last payment didn\'t go through. Update your card below to resume your subscription.'
}

/** Shown only after a promo/referral code validates. Delivery sentence is pickup-safe. */
export function firstWeekPromoAppliedMessage({ label, code, percent, isDelivery }) {
  const deliveryBit = isDelivery ? ' Delivery is full price.' : ''
  return `${label} ${code}: ${percent}% off this first week's plan and add-ons.${deliveryBit} Later weeks are regular price.`
}

export const CARD_EXPIRY_DAYS = 30

export function cardExpiryLabel(card) {
  if (!card?.expMonth || !card?.expYear) return ''
  return `${String(card.expMonth).padStart(2, '0')}/${card.expYear}`
}

/** Match the weekly card-expiry email window (30 days, once per card). */
export function cardExpiryState(card, now = new Date()) {
  const label = cardExpiryLabel(card)
  if (!label) return null
  const expires = new Date(card.expYear, card.expMonth, 0, 23, 59, 59)
  if (expires.getTime() < now.getTime()) {
    return {
      kind: 'expired',
      label,
      note: `This card expired ${label}. Update it so Sunday boxes keep coming.`,
    }
  }
  const horizon = now.getTime() + CARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  if (expires.getTime() <= horizon) {
    return {
      kind: 'soon',
      label,
      note: `This card expires ${label}. Update it before then and nothing on your plan changes.`,
    }
  }
  return { kind: 'ok', label, note: null }
}

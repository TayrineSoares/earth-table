/**
 * Customer-facing subscription cadence phrases.
 * Keep in sync with backend/src/emails/subscriptionEmailSpec.js
 *
 * Live fallbacks (when dates have not loaded yet):
 * Charge: Wednesday 9:00 AM ET (plan + delivery).
 * Lock: Thursday 5:00 PM ET (add-ons + meal lock).
 * Pause / cancel / plan-change for this Sunday: before Wednesday 9:00 AM ET.
 *
 * Pass charge_label / cutoff_label from /api/subscriptions/dates (or the
 * row on My Plans) so test_charge_at / test_lock_at show the real times.
 */

export const PAUSE_CANCEL_BY = 'Wednesday at 9:00 AM ET'
export const MEAL_LOCK_BY = 'Thursday at 5:00 PM ET'
export const CHARGE_DAY_TIME = 'Wednesday at 9:00 AM ET'
export const LOCK_DAY_TIME = 'Thursday at 5:00 PM ET'

export function howItWorksCharge(chargeLabel, cutoffLabel) {
  return `Your subscription (plan and delivery) is charged ${chargeLabel || CHARGE_DAY_TIME}; add-ons are charged at the ${cutoffLabel || LOCK_DAY_TIME} lock cutoff for that week's box.`
}

export function howItWorksPause(chargeLabel) {
  return `Pause or cancel any time before ${chargeLabel || PAUSE_CANCEL_BY}, no fees.`
}

export function howItWorksMeals(cutoffLabel) {
  return `You can change meals, extras, and pickup or delivery in My Subscriptions until the ${cutoffLabel || MEAL_LOCK_BY} cutoff.`
}

export function howItWorksFlexible(chargeLabel, cutoffLabel) {
  return `Update your meals and add-ons up to ${cutoffLabel || MEAL_LOCK_BY}. Need to pause or skip a week? Let us know by ${chargeLabel || PAUSE_CANCEL_BY}. No long-term commitment.`
}

export function orderByCutoff(cutoffLabel) {
  return `Order by ${cutoffLabel || MEAL_LOCK_BY}. Delivered the following Sunday.`
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

export function pausedBanner(chargeLabel) {
  return `This plan is paused. Your last meals and card stay on file. Resume by ${chargeLabel || PAUSE_CANCEL_BY} to get that Sunday's box.`
}

/** Auto-pause after a declined Wednesday charge. Sunday/cutoff details stay on the email. */
export function paymentFailedBanner() {
  return 'Your subscription is paused because your last payment didn\'t go through. Update your card below to resume your subscription.'
}

export const HOW_IT_WORKS_CHARGE = howItWorksCharge()
export const HOW_IT_WORKS_PAUSE = howItWorksPause()
export const HOW_IT_WORKS_MEALS = howItWorksMeals()
export const RESUME_BY_CHARGE = resumeByCharge()
export const PAUSED_BANNER = pausedBanner()
export const PAYMENT_FAILED_BANNER = paymentFailedBanner()

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

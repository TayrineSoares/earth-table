/**
 * Customer-facing subscription cadence phrases.
 * Keep in sync with backend/src/emails/subscriptionEmailSpec.js
 *
 * Charge: Wednesday 9:00 AM ET (plan + delivery).
 * Lock: Thursday 5:00 PM ET (add-ons + meal lock).
 * Pause / cancel / plan-change for this Sunday: before Wednesday 9:00 AM ET.
 */

export const PAUSE_CANCEL_BY = 'Wednesday at 9:00 AM ET'
export const MEAL_LOCK_BY = 'Thursday at 5:00 PM ET'
export const CHARGE_DAY_TIME = 'Wednesday at 9:00 AM ET'
export const LOCK_DAY_TIME = 'Thursday at 5:00 PM ET'

export const HOW_IT_WORKS_CHARGE =
  'Your subscription (plan and delivery) is charged every Wednesday at 9:00 AM ET; add-ons are charged at the Thursday 5:00 PM ET lock cutoff for that week\'s box.'

export const HOW_IT_WORKS_PAUSE =
  'Pause or cancel by Wednesday at 9:00 AM ET, no fees.'

export const HOW_IT_WORKS_MEALS =
  'You can change meals, extras, and pickup or delivery in My Subscriptions until the Thursday 5:00 PM ET cutoff.'

/** Shown only after a promo/referral code validates. Delivery sentence is pickup-safe. */
export function firstWeekPromoAppliedMessage({ label, code, percent, isDelivery }) {
  const deliveryBit = isDelivery ? ' Delivery is full price.' : ''
  return `${label} ${code}: ${percent}% off this first week's plan and add-ons.${deliveryBit} Later weeks are regular price.`
}

export const RESUME_BY_CHARGE =
  'Resume by Wednesday at 9:00 AM ET for that week\'s box.'

export const PAUSED_BANNER =
  'This plan is paused. Your last meals and card stay on file. Resume by Wednesday at 9:00 AM ET to get that Sunday\'s box.'

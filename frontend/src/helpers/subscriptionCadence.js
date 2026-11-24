/**
 * Customer-facing subscription cadence phrases.
 * Keep in sync with backend/src/emails/subscriptionEmailSpec.js
 *
 * Live fallbacks (when dates have not loaded yet):
 * Charge: Tuesday 9:00 AM ET (plan + delivery together).
 * Lock / pause-cancel / plan / fulfillment deadline: Wednesday 5:00 PM ET.
 * Pause / cancel to skip: before Wednesday meal lock (refund if already charged
 * and the box is still open). After lock, that Sunday still ships.
 * Resume for that Sunday's box: by Wednesday 5:00 PM ET (meal lock). Manual resume
 * before Tuesday while unpaid → activate only (Tue job bills). After Tuesday while
 * unpaid (or payment_failed / refunded skip) → charge now.
 * Plan size change: this Sunday until meal lock (paid weeks = Stripe delta refund
 * or charge). After lock → following week.
 * Fulfillment: unpaid — delivery fee waits for Tuesday; paid week pickup→delivery
 * charges delivery now; paid delivery→pickup auto-refunds the delivery fee before lock.
 *
 * Customer copy uses these standing weekday times. Calendar dates stay on
 * the box itself (confirmation, meal picker) via cutoff_label / charge_label.
 */

/** Pause / cancel / plan / fulfillment deadline (same as meal lock). */
export const PAUSE_CANCEL_BY = 'Wednesday at 5:00 PM ET'
export const MEAL_LOCK_BY = 'Wednesday at 5:00 PM ET'
/** Resume deadline for a paused Sunday's box (same standing time as meal lock). */
export const RESUME_BY = MEAL_LOCK_BY
export const UNCHANGED_MEALS = "If you don't change anything, we repeat last week's meals. Add-ons don't repeat unless you add them again."
export const CHARGE_DAY_TIME = 'Tuesday at 9:00 AM ET'
export const LOCK_DAY_TIME = 'Wednesday at 5:00 PM ET'
export const SUPPORT_EMAIL = 'hello@earthtableco.ca'

export function howItWorksCharge() {
  return `Plan and delivery are charged together every ${CHARGE_DAY_TIME}. While that Sunday is still unpaid, you can switch pickup or delivery and the delivery fee (if any) is billed with that Tuesday charge. Add-ons are charged ${LOCK_DAY_TIME}. Questions? Email ${SUPPORT_EMAIL}.`
}

export function howItWorksPause() {
  return `Your first box can't be cancelled — if you pause that week it still goes out. After that, pause or cancel before ${PAUSE_CANCEL_BY} to skip that Sunday. If we already charged that week and the box is still open, we refund the charge and skip the box. After meal lock, that Sunday still ships and pause starts the following week. Resume by ${RESUME_BY} for that Sunday's box. If you resume before Tuesday's charge while that Sunday is still unpaid, we turn the plan back on and bill on the next Tuesday charge (you can pause again before then). If you resume after Tuesday while that Sunday is still unpaid (including after a refunded skip), we charge then so you can still get that box. After a declined payment, update your card or resume before meal lock and we charge then — we do not keep retrying on later Tuesdays on our own. No fees. Pause and cancel both keep your meals and card so you can resume anytime.`
}

export function howItWorksPlanChange() {
  return `Change plan size in My Subscriptions. Until ${PAUSE_CANCEL_BY}, the new size applies to this Sunday — if that week is already paid, we refund a downgrade difference or charge an upgrade difference (including tax). After meal lock, that Sunday stays as-is and the new size starts the following week.`
}

export function howItWorksMeals() {
  return `Change meals and extras for that week in My Subscriptions until Wednesday at 5:00 PM ET. ${UNCHANGED_MEALS}`
}

export function howItWorksNotes() {
  return `Notes (address, allergies, instructions) are saved per Sunday. If you don't change them, they carry over to the next week. After Wednesday at 5:00 PM ET, any edit applies only to the following week — this Sunday's locked box keeps the notes it already had. Questions? Email ${SUPPORT_EMAIL}.`
}

export function howItWorksSupport() {
  return `Need help with your plan, box, or billing? Email ${SUPPORT_EMAIL}.`
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
    howItWorksPlanChange(),
    signingUp ? howItWorksFirstDelivery(firstDeliveryLabel) : null,
    howItWorksMeals(),
    howItWorksNotes(),
    howItWorksSupport(),
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

export function resumeByLock(lockLabel) {
  return `Resume by ${lockLabel || RESUME_BY} for that week's box.`
}

/** @deprecated Use resumeByLock — resume deadline is Wednesday meal lock, not Tuesday charge. */
export function resumeByCharge(lockLabel) {
  return resumeByLock(lockLabel)
}

/** Standing weekly deadline: "every week by Wednesday at 5:00 PM ET". */
export function everyWeekBy(cadenceLabel, fallback) {
  const label = String(cadenceLabel || fallback || '').trim()
  if (!label) return ''
  if (/^every week by /i.test(label)) return label
  return `every week by ${label}`
}

export function pausedBanner(lockLabel, { firstBoxLabel, nextBoxLabel } = {}) {
  const by = lockLabel || RESUME_BY
  if (firstBoxLabel) {
    return `This plan is paused. Your first box on ${firstBoxLabel} can't be cancelled — it still goes out. You can still change add-ons on that box until ${MEAL_LOCK_BY}. Resume by ${MEAL_LOCK_BY} for any later Sunday you want.`
  }
  // nextBoxLabel only when that Sunday is already locked — unpaid/refunded weeks are skipped.
  // Standing weekly lock (not this shipping week's cutoff) is the deadline for a later Sunday.
  // Say "your box on {date}" — not "this Sunday" — so a later cook date still reads cleanly.
  if (nextBoxLabel) {
    return `This plan is paused. You're still receiving your box on ${nextBoxLabel}. After that, resume by ${MEAL_LOCK_BY} for the Sunday you want.`
  }
  return `This plan is paused. Resume by ${by} to get that Sunday's box.`
}

/** Pause after this Sunday was already locked — box still runs. */
export function pausingAfterCutoffBanner(sundayLabel) {
  if (sundayLabel) {
    return `This Sunday's box is already locked, so you're still receiving the box on ${sundayLabel}. The plan is paused starting the following week.`
  }
  return `This Sunday's box is already locked, so that box still goes out. The plan is paused starting the following week.`
}

/** Plan-discontinue pending cancel while this Sunday's locked box still ships. */
export function pendingCancelBanner(sundayLabel) {
  if (sundayLabel) {
    return `You're still receiving your box on ${sundayLabel}. The plan will be cancelled starting the following week.`
  }
  return `You're still receiving this Sunday's box. The plan will be cancelled starting the following week.`
}

/** Auto-pause after a declined Tuesday charge. No automatic Tuesday retries. */
export function paymentFailedBanner({ canKeepThisSunday = true } = {}) {
  if (!canKeepThisSunday) {
    return `Your subscription is paused because Tuesday's charge didn't go through. This Sunday was skipped. Update your card or tap Resume before ${MEAL_LOCK_BY} for a later Sunday — we charge then.`
  }
  return `Your subscription is paused because Tuesday's charge didn't go through. Update your card or tap Resume before ${MEAL_LOCK_BY} to keep this Sunday's box — we charge then. If it's still unpaid by then, this Sunday is skipped. Later weeks only run after you update your card or resume.`
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

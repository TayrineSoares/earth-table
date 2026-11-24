/**
 * Subscription cadence constants.
 * Keep in sync with frontend/src/helpers/subscriptionCadence.js
 *
 * Charge: Tuesday 9:00 AM ET (plan + delivery together).
 * Lock / pause-cancel / plan / fulfillment deadline: Wednesday 5:00 PM ET.
 * Pause / cancel to skip this Sunday: before Wednesday meal lock (refund if
 * already charged and still open). After lock, that Sunday still ships.
 * Resume for that Sunday's box: by Wednesday 5:00 PM ET (meal lock). Manual
 * resume before Tuesday while unpaid → activate only (Tue job bills). After
 * Tuesday while unpaid (or payment_failed / refunded skip) → charge now.
 * Plan size for this Sunday: until meal lock (paid weeks = Stripe delta).
 * After lock → following week.
 * Fulfillment: unpaid week — delivery fee sits on the cycle until Tuesday
 * charge; paid week — pickup→delivery charges delivery now; delivery→pickup
 * auto-refunds the delivery fee before lock.
 */

const CADENCE = {
  TIMEZONE: 'America/Toronto',
  CHARGE_WEEKDAY: 2,
  CHARGE_HOUR: 9,
  CHARGE_MINUTE: 0,
  LOCK_WEEKDAY: 3,
  LOCK_HOUR: 17,
  LOCK_MINUTE: 0,
  PAUSE_NUDGE_WEEKDAY: 1,
  PAUSE_NUDGE_HOUR: 9,
  PAUSE_NUDGE_WEEKS: [1, 4],
  UPDATE_DEBOUNCE_MS: 60 * 60 * 1000,
  // Monday 9:00 AM ET with the pause reminder. Email once per card in this window.
  CARD_EXPIRY_DAYS: 30,
};

/** Pause / cancel / plan / fulfillment deadline (meal lock). */
const PAUSE_CANCEL_BY = 'Wednesday at 5:00 PM ET';
const MEAL_LOCK_BY = 'Wednesday at 5:00 PM ET';
/** Resume deadline for a paused Sunday's box (same standing time as meal lock). */
const RESUME_BY = MEAL_LOCK_BY;
/** Tuesday charge — never reuse PAUSE_CANCEL_BY for billing copy. */
const CHARGE_DAY_TIME = 'Tuesday at 9:00 AM ET';
const UNCHANGED_MEALS = "If you don't change anything, we repeat last week's meals. Add-ons don't repeat unless you add them again.";
const PICKUP_ADDRESS = '77 Woodstream Blvd, Vaughan, ON L4L 7Y7';
const DELIVERY_WINDOW = '11:00 AM – 6:00 PM';

module.exports = {
  CADENCE,
  PAUSE_CANCEL_BY,
  MEAL_LOCK_BY,
  RESUME_BY,
  CHARGE_DAY_TIME,
  UNCHANGED_MEALS,
  PICKUP_ADDRESS,
  DELIVERY_WINDOW,
};

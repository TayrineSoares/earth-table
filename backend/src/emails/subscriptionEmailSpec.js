/**
 * Subscription cadence constants.
 * Keep in sync with frontend/src/helpers/subscriptionCadence.js
 *
 * Charge: Tuesday 9:00 AM ET (plan + delivery together).
 * Lock: Wednesday 5:00 PM ET (add-ons + meal lock).
 * Pause / cancel for this Sunday: skip if that week is still unpaid; once
 * charged or locked the box still goes out (usually after Tuesday 9:00 AM ET).
 * Plan size for this Sunday: only while that week is still unpaid; once paid
 * (including first box), the new size starts the following week (no mid-week
 * upgrade charge / downgrade refund).
 * Fulfillment: unpaid week — delivery fee sits on the cycle until Tuesday
 * charge; paid week — pickup→delivery charges delivery now (idempotent).
 * Delivery→pickup always clears delivery_fee_cents; if already charged,
 * customer copy points them to hello@earthtableco.ca about a delivery-fee refund only.
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

const PAUSE_CANCEL_BY = 'Tuesday at 9:00 AM ET';
const MEAL_LOCK_BY = 'Wednesday at 5:00 PM ET';
const UNCHANGED_MEALS = "If you don't change anything, we repeat last week's meals. Add-ons don't repeat unless you add them again.";
const PICKUP_ADDRESS = '77 Woodstream Blvd, Vaughan, ON L4L 7Y7';
const DELIVERY_WINDOW = '11:00 AM – 6:00 PM';

module.exports = {
  CADENCE,
  PAUSE_CANCEL_BY,
  MEAL_LOCK_BY,
  UNCHANGED_MEALS,
  PICKUP_ADDRESS,
  DELIVERY_WINDOW,
};

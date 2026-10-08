/**
 * Subscription cadence constants.
 * Keep in sync with frontend/src/helpers/subscriptionCadence.js
 *
 * Charge: Tuesday 9:00 AM ET (plan + delivery).
 * Lock: Wednesday 5:00 PM ET (add-ons + meal lock).
 * Pause / cancel / plan-change for this Sunday: before Tuesday 9:00 AM ET.
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

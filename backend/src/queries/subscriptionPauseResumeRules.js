/**
 * Pure pause / resume decision helpers (unit-tested).
 * Keep in sync with MySubscriptions resume/pause dialogs and manage routes.
 *
 * Policy: Tuesday 9:00 AM ET charge; Wednesday 5:00 PM ET meal lock.
 * Pause keeps this Sunday only when the cycle is locked (or first-box path).
 * Paid+open pause refunds and skips — see subscriptionManage.pauseSubscription.
 */

function cycleIsCommitted(cycle) {
  return Boolean(
    cycle
    && (cycle.status === 'locked' || Number(cycle.plan_paid_cents) > 0)
  );
}

/**
 * Charge on resume only when the cook week is still unpaid.
 * payment_failed always tries (unless already paid/locked). Manual pause before
 * Tuesday waits for the job; after Tuesday charges unpaid weeks only
 * (including re-open of a refunded skip before lock).
 */
function resumeShouldChargeNow({
  pauseReason,
  beforeTuesdayCharge,
  cookWeekCommitted,
} = {}) {
  if (cookWeekCommitted) return false;
  if (pauseReason === 'payment_failed') return true;
  return beforeTuesdayCharge === false;
}

/** Pause keeps this Sunday only when the box is already locked for the kitchen. */
function pauseKeepsThisSunday(cycle) {
  return Boolean(cycle && cycle.status === 'locked');
}

module.exports = {
  cycleIsCommitted,
  resumeShouldChargeNow,
  pauseKeepsThisSunday,
};

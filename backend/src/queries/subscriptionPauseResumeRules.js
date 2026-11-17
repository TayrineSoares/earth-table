/**
 * Pure pause / resume decision helpers (unit-tested).
 * Keep in sync with MySubscriptions resume/pause dialogs and manage routes.
 */

function cycleIsCommitted(cycle) {
  return Boolean(
    cycle
    && (cycle.status === 'locked' || Number(cycle.plan_paid_cents) > 0)
  );
}

/**
 * Charge on resume only when the cook week is still unpaid.
 * payment_failed always tries (unless already paid). Manual pause before
 * Tuesday waits for the job; after Tuesday charges unpaid weeks only.
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

/** Pause keeps this Sunday when the box is already paid or locked. */
function pauseKeepsThisSunday(cycle) {
  return cycleIsCommitted(cycle);
}

module.exports = {
  cycleIsCommitted,
  resumeShouldChargeNow,
  pauseKeepsThisSunday,
};

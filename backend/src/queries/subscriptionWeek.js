/**
 * America/Toronto cutoffs for new signups.
 *
 * Live: meal lock is Thursday 5:00 PM. First delivery is the Sunday
 * on or after that lock (this Sunday if they subscribe before lock).
 * If they subscribe after lock, first delivery is the Sunday after
 * next Thursday's lock.
 *
 * If admin set test_lock_at / test_charge_at, those instants replace
 * Thursday 5pm / Wednesday 9am. A stored instant that is still in the
 * future is used as-is (do not pull next Saturday onto this Saturday).
 * After it has passed, the same Toronto weekday and clock repeats every
 * 7 days until the overrides are cleared. Signup, My Plans, emails, admin
 * buttons, and cron jobs all read getSignupDates / getTargetSundayYmd.
 * Plan charge is Wednesday 9:00 AM America/Toronto (not Thursday).
 *
 * No date library — Intl + a small nudge loop to map Toronto wall-clock
 * times onto UTC instants (handles EST/EDT).
 */

const TZ = 'America/Toronto';

// Same repeating holidays as frontend/src/helpers/blockedDates.js
const BLOCKED_MMDD = new Set(['12-25', '12-26', '12-31', '01-01']);

const WEEKDAY_NUM = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const CHARGE_WEEKDAY = 3; // Wednesday
const CHARGE_HOUR = 9;
const CHARGE_MINUTE = 0;
const LOCK_WEEKDAY = 4; // Thursday
const LOCK_HOUR = 17;
const LOCK_MINUTE = 0;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function torontoParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const weekdayKey = String(map.weekday || '').replace('.', '').slice(0, 3);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: WEEKDAY_NUM[weekdayKey],
  };
}

/**
 * Instant whose Toronto wall-clock is year-month-day hour:minute.
 * Start from "that clock in UTC", then shift by the difference Intl reports.
 */
function torontoDate(year, month, day, hour, minute) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 4; i += 1) {
    const shown = torontoParts(new Date(utc));
    const got = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, 0);
    const want = Date.UTC(year, month - 1, day, hour, minute, 0);
    utc += want - got;
  }
  return new Date(utc);
}

function addCalendarDays(year, month, day, days) {
  const utc = Date.UTC(year, month - 1, day + days);
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function ymd(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isBlockedHoliday(year, month, day) {
  return BLOCKED_MMDD.has(`${pad2(month)}-${pad2(day)}`);
}

/** Thursday 5pm of the Toronto week that contains `now` (may already be past). */
function thisWeekLockAt(now) {
  const p = torontoParts(now);
  const shifted = addCalendarDays(p.year, p.month, p.day, LOCK_WEEKDAY - p.weekday);
  return torontoDate(shifted.year, shifted.month, shifted.day, LOCK_HOUR, LOCK_MINUTE);
}

function plusWeeksToronto(date, weeks) {
  const p = torontoParts(date);
  const next = addCalendarDays(p.year, p.month, p.day, 7 * weeks);
  return torontoDate(next.year, next.month, next.day, p.hour, p.minute);
}

/** Same weekday and clock as `origin`, in the Toronto week that contains `now`. */
function thisPeriodOccurrence(origin, now) {
  const o = torontoParts(origin);
  const n = torontoParts(now);
  const shifted = addCalendarDays(n.year, n.month, n.day, o.weekday - n.weekday);
  return torontoDate(shifted.year, shifted.month, shifted.day, o.hour, o.minute);
}

/**
 * Admin test_lock_at / test_charge_at.
 * If the stored instant is still ahead, keep it — mapping a future Saturday
 * onto this week's Saturday made Run Thursday lock target this Sunday while
 * the only open cycle was next Sunday. Once it has passed, same weekday/clock
 * in the Toronto week that contains `now`.
 */
function overrideOccurrence(origin, now) {
  if (now.getTime() < origin.getTime()) return origin;
  return thisPeriodOccurrence(origin, now);
}

/** Wednesday 9:00 AM before a Sunday delivery (same calendar week). */
function chargeAtForSunday(ymdStr) {
  const sunday = parseYmdToronto(ymdStr);
  if (!sunday) {
    const p = torontoParts(new Date());
    const shifted = addCalendarDays(p.year, p.month, p.day, CHARGE_WEEKDAY - p.weekday);
    return torontoDate(shifted.year, shifted.month, shifted.day, CHARGE_HOUR, CHARGE_MINUTE);
  }
  const p = torontoParts(sunday);
  const wed = addCalendarDays(p.year, p.month, p.day, CHARGE_WEEKDAY - p.weekday);
  return torontoDate(wed.year, wed.month, wed.day, CHARGE_HOUR, CHARGE_MINUTE);
}

/**
 * Pause / cancel / plan-change deadline for the Sunday currently being edited.
 * After Thursday lock, that Sunday is next week, so the deadline is next Wednesday 9:00 AM.
 * test_charge_at stands in for Wednesday 9:00 AM when set.
 */
function getChargeDeadline(now = new Date(), settings = {}, deliveryDateYmd = null) {
  const testRaw = settings && settings.test_charge_at;
  const testAt = testRaw ? new Date(testRaw) : null;
  const testValid = testAt && Number.isFinite(testAt.getTime());
  const chargeAt = testValid
    ? overrideOccurrence(testAt, now)
    : chargeAtForSunday(deliveryDateYmd);
  return {
    before_wednesday: now.getTime() < chargeAt.getTime(),
    charge_at: chargeAt.toISOString(),
    charge_label: formatCutoffLabel(chargeAt),
    cadence_label: formatCadenceLabel(chargeAt),
  };
}

function isBeforeWednesdayCharge(now = new Date(), settings = {}, deliveryDateYmd = null) {
  return getChargeDeadline(now, settings, deliveryDateYmd).before_wednesday;
}

function isBeforeThursdayLock(now = new Date(), settings = {}) {
  return !getSignupDates(now, settings).cutoff_passed;
}

function nextLiveLockAt(now) {
  const thisWeek = thisWeekLockAt(now);
  if (now.getTime() < thisWeek.getTime()) return thisWeek;
  const p = torontoParts(thisWeek);
  const next = addCalendarDays(p.year, p.month, p.day, 7);
  return torontoDate(next.year, next.month, next.day, LOCK_HOUR, LOCK_MINUTE);
}

/** First Sunday on or after `from`, skipping Dec 25/26/31 and Jan 1. */
function sundayOnOrAfter(from) {
  const p = torontoParts(from);
  const add = (7 - p.weekday) % 7;
  return skipHolidaySundays(addCalendarDays(p.year, p.month, p.day, add));
}

function skipHolidaySundays(day) {
  let current = day;
  for (let i = 0; i < 8; i += 1) {
    if (!isBlockedHoliday(current.year, current.month, current.day)) {
      return torontoDate(current.year, current.month, current.day, 0, 0);
    }
    current = addCalendarDays(current.year, current.month, current.day, 7);
  }
  return torontoDate(current.year, current.month, current.day, 0, 0);
}

function plusDays(date, days) {
  const p = torontoParts(date);
  return skipHolidaySundays(addCalendarDays(p.year, p.month, p.day, days));
}

function formatCutoffLabel(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const dayPeriod = map.dayPeriod || '';
  return `${map.weekday}, ${map.month} ${map.day} at ${map.hour}:${map.minute} ${dayPeriod} ET`.replace(/\s+/g, ' ').trim();
}

/** Standing weekly rule, no calendar date: "Saturday at 7:55 PM ET". */
function formatCadenceLabel(date) {
  if (!date || !Number.isFinite(date.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const dayPeriod = map.dayPeriod || '';
  return `${map.weekday} at ${map.hour}:${map.minute} ${dayPeriod} ET`.replace(/\s+/g, ' ').trim();
}

function formatDeliveryLabel(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return fmt.format(date);
}

function sundayLabelFromYmd(ymdStr) {
  const d = parseYmdToronto(ymdStr);
  return d ? formatDeliveryLabel(d) : (ymdStr || 'Sunday');
}

/**
 * @param {Date} [now]
 * @param {{ test_lock_at?: string | null }} [settings]
 */
function getSignupDates(now = new Date(), settings = {}) {
  const testLockRaw = settings && settings.test_lock_at;
  const testLockAt = testLockRaw ? new Date(testLockRaw) : null;
  const testLockValid = testLockAt && Number.isFinite(testLockAt.getTime());

  let cutoffAt;
  let cutoffPassed = false;
  let missedLockAt = null;

  if (testLockValid) {
    // Stored future lock stays on that calendar day; only recur after it passes.
    const thisPeriodLock = overrideOccurrence(testLockAt, now);
    cutoffPassed = now.getTime() >= thisPeriodLock.getTime();
    cutoffAt = cutoffPassed ? plusWeeksToronto(thisPeriodLock, 1) : thisPeriodLock;
    if (cutoffPassed) missedLockAt = thisPeriodLock;
  } else {
    const thisWeekLock = thisWeekLockAt(now);
    cutoffPassed = now.getTime() >= thisWeekLock.getTime();
    cutoffAt = nextLiveLockAt(now);
    if (cutoffPassed) missedLockAt = thisWeekLock;
  }

  let firstDeliveryAt = sundayOnOrAfter(cutoffAt);
  let lockedDeliveryDate = null;
  // If the Sunday after the next lock is the same Sunday they just missed
  // (common when a test lock fires before this week's Thursday), skip ahead.
  if (missedLockAt) {
    const missedSunday = sundayOnOrAfter(missedLockAt);
    const missedParts = torontoParts(missedSunday);
    lockedDeliveryDate = ymd(missedParts.year, missedParts.month, missedParts.day);
    const firstParts = torontoParts(firstDeliveryAt);
    if (ymd(firstParts.year, firstParts.month, firstParts.day) === lockedDeliveryDate) {
      firstDeliveryAt = plusDays(firstDeliveryAt, 7);
    }
  }

  const deliveryParts = torontoParts(firstDeliveryAt);
  const firstDeliveryYmd = ymd(deliveryParts.year, deliveryParts.month, deliveryParts.day);
  const charge = getChargeDeadline(now, settings, firstDeliveryYmd);
  const locked = lockedDeliveryDate;
  // Jobs lock/charge this Sunday until cutoff, then the Sunday that just locked.
  const jobSunday = cutoffPassed && locked ? locked : firstDeliveryYmd;

  return {
    cutoff_at: cutoffAt.toISOString(),
    cutoff_passed: cutoffPassed,
    cutoff_label: formatCutoffLabel(cutoffAt),
    cadence_label: formatCadenceLabel(cutoffAt),
    charge_at: charge.charge_at,
    charge_label: charge.charge_label,
    first_delivery_date: firstDeliveryYmd,
    first_delivery_label: formatDeliveryLabel(firstDeliveryAt),
    locked_delivery_date: locked,
    job_sunday: jobSunday,
  };
}

/** Sunday the weekly jobs should act on. Same value as getSignupDates().job_sunday. */
function getTargetSundayYmd(now = new Date(), settings = {}) {
  return getSignupDates(now, settings).job_sunday;
}

/** Next cook Sunday after `ymdStr`, skipping Dec 25/26/31 and Jan 1. */
function nextOpenSunday(ymdStr) {
  const start = parseYmdToronto(ymdStr);
  if (!start) return ymdStr;
  const next = plusDays(start, 7);
  const p = torontoParts(next);
  return ymd(p.year, p.month, p.day);
}

function isYmdBlocked(ymdStr) {
  const [year, month, day] = String(ymdStr || '').split('-').map(Number);
  if (!year || !month || !day) return false;
  return isBlockedHoliday(year, month, day);
}

function torontoYmd(date = new Date()) {
  const p = torontoParts(date);
  return ymd(p.year, p.month, p.day);
}

function parseYmdToronto(ymdStr) {
  const [year, month, day] = String(ymdStr || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return torontoDate(year, month, day, 12, 0);
}

/** Kitchen lock for the Sunday box: Thursday 5pm (or the test-lock clock) before that Sunday. */
function lockAtForSunday(ymdStr, settings = {}) {
  const sunday = parseYmdToronto(ymdStr);
  if (!sunday) return null;
  const p = torontoParts(sunday);
  const thu = addCalendarDays(p.year, p.month, p.day, -3);
  const thursday = torontoDate(thu.year, thu.month, thu.day, 12, 0);
  const testRaw = settings && settings.test_lock_at;
  const testAt = testRaw ? new Date(testRaw) : null;
  if (testAt && Number.isFinite(testAt.getTime())) {
    return thisPeriodOccurrence(testAt, thursday);
  }
  return torontoDate(thu.year, thu.month, thu.day, LOCK_HOUR, LOCK_MINUTE);
}

function lockPassedForSunday(ymdStr, now = new Date(), settings = {}) {
  const at = lockAtForSunday(ymdStr, settings);
  if (!at) return false;
  return now.getTime() >= at.getTime();
}

/** ISO cutoff for a given cook Sunday (test_lock_at weekday/clock when set). */
function cutoffAtForSunday(ymdStr, settings = {}) {
  const at = lockAtForSunday(ymdStr, settings);
  return at ? at.toISOString() : null;
}

function cutoffLabelForSunday(ymdStr, settings = {}) {
  const at = lockAtForSunday(ymdStr, settings);
  return at ? formatCutoffLabel(at) : '';
}

/** "10:00-13:00" -> "10:00 AM – 1:00 PM" */
function formatPickupSlot(slot) {
  const parts = String(slot || '').split('-');
  if (parts.length !== 2) return String(slot || '').trim();
  const fmt = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    if (!Number.isFinite(h)) return hhmm;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = ((h + 11) % 12) + 1;
    const min = Number.isFinite(m) ? String(m).padStart(2, '0') : '00';
    return `${hour12}:${min} ${period}`;
  };
  return `${fmt(parts[0].trim())} – ${fmt(parts[1].trim())}`;
}

function mealsAWeek(count) {
  const n = Number(count) || 0;
  return n === 1 ? '1 meal a week' : `${n} meals a week`;
}

function mealPlanPhrase(count) {
  const n = Number(count) || 0;
  return n === 1 ? '1-meal plan' : `${n}-meal plan`;
}

function formatFulfillmentLine({ delivery, deliveryLabel, pickupSlot }) {
  const sunday = deliveryLabel || 'Sunday';
  if (delivery) return `Delivery — ${sunday}, 11:00 AM – 6:00 PM`;
  const slot = formatPickupSlot(pickupSlot);
  return slot ? `Pickup — ${sunday}, ${slot}` : `Pickup — ${sunday}`;
}

function formatTorontoStamp(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return fmt.format(date).replace(/, (\d+:)/, ' at $1');

}

/** First Monday 9:00 AM ET on or after `from`. */
function mondayNineOnOrAfter(from) {
  const start = from instanceof Date ? from : new Date(from);
  const p = torontoParts(start);
  const daysUntilMonday = (1 - p.weekday + 7) % 7;
  const day = addCalendarDays(p.year, p.month, p.day, daysUntilMonday);
  let at = torontoDate(day.year, day.month, day.day, 9, 0);
  if (at.getTime() < start.getTime()) {
    const next = addCalendarDays(day.year, day.month, day.day, 7);
    at = torontoDate(next.year, next.month, next.day, 9, 0);
  }
  return at;
}

/**
 * 1-based week index of the Monday 9:00 AM pause nudge relative to paused_at.
 * Week 1 is the first Monday 9:00 AM on or after the pause.
 */
function pauseNudgeWeek(pausedAt, now = new Date()) {
  if (!pausedAt) return 0;
  const first = mondayNineOnOrAfter(pausedAt);
  const p = torontoParts(now);
  const daysSinceMonday = (p.weekday + 6) % 7;
  const thisMon = addCalendarDays(p.year, p.month, p.day, -daysSinceMonday);
  const thisRun = torontoDate(thisMon.year, thisMon.month, thisMon.day, 9, 0);
  const diff = thisRun.getTime() - first.getTime();
  if (diff < 0) return 0;
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function cycleIsClosed(cycle) {
  const status = cycle?.status;
  return status === 'locked' || status === 'skipped';
}

/**
 * Which Sunday a My Subscriptions edit should hit.
 * Open cycle before cutoff: this Sunday.
 * After the clock cutoff, or once this Sunday's cycle is already locked/skipped
 * (admin force lock): next week's cycle (created on save if needed).
 *
 * Labels always come from getSignupDates so test_lock_at / test_charge_at stay
 * consistent, except after a force lock we use next Sunday's cutoff so copy
 * does not say "edit until" a lock that already ran.
 */
function getEditWeek(now = new Date(), settings = {}, currentCycle = null) {
  const signup = getSignupDates(now, settings);
  const stillThisWeek = Boolean(
    currentCycle &&
    currentCycle.status === 'open' &&
    !signup.cutoff_passed &&
    currentCycle.delivery_date === signup.first_delivery_date
  );

  if (stillThisWeek) {
    const sunday = currentCycle.delivery_date;
    const sundayDate = parseYmdToronto(sunday);
    return {
      applies_to: 'this_sunday',
      cutoff_passed: false,
      cutoff_at: signup.cutoff_at,
      cutoff_label: signup.cutoff_label,
      cadence_label: signup.cadence_label,
      delivery_date: sunday,
      delivery_label: sundayDate ? formatDeliveryLabel(sundayDate) : signup.first_delivery_label,
    };
  }

  const forceLockedThisSunday = Boolean(
    cycleIsClosed(currentCycle)
    && !signup.cutoff_passed
    && currentCycle.delivery_date === signup.first_delivery_date
  );
  if (forceLockedThisSunday) {
    const nextSunday = nextOpenSunday(currentCycle.delivery_date);
    const nextLock = lockAtForSunday(nextSunday, settings);
    return {
      applies_to: 'next_week',
      cutoff_passed: true,
      cutoff_at: nextLock ? nextLock.toISOString() : signup.cutoff_at,
      cutoff_label: nextLock ? formatCutoffLabel(nextLock) : signup.cutoff_label,
      cadence_label: nextLock ? formatCadenceLabel(nextLock) : signup.cadence_label,
      delivery_date: nextSunday,
      delivery_label: sundayLabelFromYmd(nextSunday),
    };
  }

  return {
    applies_to: signup.cutoff_passed ? 'next_week' : 'this_sunday',
    cutoff_passed: signup.cutoff_passed,
    cutoff_at: signup.cutoff_at,
    cutoff_label: signup.cutoff_label,
    cadence_label: signup.cadence_label,
    delivery_date: signup.first_delivery_date,
    delivery_label: signup.first_delivery_label,
  };
}

module.exports = {
  getSignupDates,
  getEditWeek,
  getChargeDeadline,
  isBeforeWednesdayCharge,
  isBeforeThursdayLock,
  formatFulfillmentLine,
  mealsAWeek,
  mealPlanPhrase,
  formatTorontoStamp,
  formatPickupSlot,
  formatDeliveryLabel,
  sundayLabelFromYmd,
  torontoYmd,
  getTargetSundayYmd,
  nextOpenSunday,
  isYmdBlocked,
  lockAtForSunday,
  cutoffAtForSunday,
  cutoffLabelForSunday,
  lockPassedForSunday,
  pauseNudgeWeek,
};

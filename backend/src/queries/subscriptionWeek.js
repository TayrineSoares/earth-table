/**
 * America/Toronto cutoffs for new signups.
 *
 * Live: meal lock is Thursday 5:00 PM. First delivery is the Sunday
 * on or after that lock (this Sunday if they subscribe before lock).
 * If they subscribe after lock, first delivery is the Sunday after
 * next Thursday's lock.
 *
 * If admin set test_lock_at, that instant is used instead of Thursday 5pm
 * until it has passed, then we fall back to the live Thursday schedule.
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
  return `${map.weekday}, ${map.month} ${map.day} at ${map.hour}:${map.minute} ${dayPeriod}`.replace(/\s+/g, ' ').trim();
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

  if (testLockValid && now.getTime() < testLockAt.getTime()) {
    // Admin is simulating a lock later today/this week.
    cutoffAt = testLockAt;
    cutoffPassed = false;
  } else if (testLockValid) {
    // Test lock already fired — show the "passed" strip, next live Thursday.
    cutoffPassed = true;
    cutoffAt = nextLiveLockAt(now);
    missedLockAt = testLockAt;
  } else {
    const thisWeekLock = thisWeekLockAt(now);
    cutoffPassed = now.getTime() >= thisWeekLock.getTime();
    cutoffAt = nextLiveLockAt(now);
    if (cutoffPassed) missedLockAt = thisWeekLock;
  }

  let firstDeliveryAt = sundayOnOrAfter(cutoffAt);
  // If the Sunday after the next lock is the same Sunday they just missed
  // (common when a test lock fires before this week's Thursday), skip ahead.
  if (missedLockAt) {
    const missedSunday = sundayOnOrAfter(missedLockAt);
    const firstParts = torontoParts(firstDeliveryAt);
    const missedParts = torontoParts(missedSunday);
    if (ymd(firstParts.year, firstParts.month, firstParts.day) === ymd(missedParts.year, missedParts.month, missedParts.day)) {
      firstDeliveryAt = plusDays(firstDeliveryAt, 7);
    }
  }

  const deliveryParts = torontoParts(firstDeliveryAt);

  return {
    cutoff_at: cutoffAt.toISOString(),
    cutoff_passed: cutoffPassed,
    cutoff_label: formatCutoffLabel(cutoffAt),
    first_delivery_date: ymd(deliveryParts.year, deliveryParts.month, deliveryParts.day),
    first_delivery_label: formatDeliveryLabel(firstDeliveryAt),
  };
}

module.exports = {
  getSignupDates,
};

// Holidays that repeat every year (MM-DD)
export const BLOCKED_MMDD = new Set(["12-25", "12-26", "12-31", "01-01"]);

export function isBlockedHoliday(yyyyMmDd) {
  if (!yyyyMmDd) return false;

  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return false;

  const mm = parts[1];
  const dd = parts[2];
  const mmdd = `${mm}-${dd}`;

  return BLOCKED_MMDD.has(mmdd);
}

// Optional: nice message for alerts/helpers
export function blockedHolidaysLabel() {
  return "Dec 25, Dec 26, Dec 31, Jan 1";
}
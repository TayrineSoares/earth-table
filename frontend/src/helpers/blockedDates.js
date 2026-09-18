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

/** Parse YYYY-MM-DD as a local calendar date (no UTC shift). */
export function parseLocalYmd(yyyyMmDd) {
  const [y, m, d] = (yyyyMmDd || "").split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Sunday, September 27th */
export function formatLongDate(yyyyMmDd) {
  if (!yyyyMmDd) return "";
  const date = parseLocalYmd(yyyyMmDd);
  if (Number.isNaN(date.getTime())) return "";
  const n = date.getDate();
  const v = n % 100;
  const ordinal =
    v >= 11 && v <= 13
      ? `${n}th`
      : n % 10 === 1
        ? `${n}st`
        : n % 10 === 2
          ? `${n}nd`
          : n % 10 === 3
            ? `${n}rd`
            : `${n}th`;
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${ordinal}`;
}
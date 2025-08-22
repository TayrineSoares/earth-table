// Parse "YYYY-MM-DD" as a LOCAL date (no timezone shift)
export function parseDateInput(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Format a Date to "YYYY-MM-DD" in LOCAL time
export function formatYyyyMmDdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Local midnight (so comparisons are fair)
export function todayLocalMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

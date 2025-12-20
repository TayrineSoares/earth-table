import '../styles/PickupSelector.css';
import { useMemo } from 'react';

const BLOCKED_DATES = ["2025-12-25", "2025-12-26", "2025-12-31", "2026-01-01"];

const isBlockedDate = (yyyyMmDd) => BLOCKED_DATES.includes(yyyyMmDd);

const formatBlockedDatesForHumans = () =>
  BLOCKED_DATES.map((d) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`; // shows 25/12/2025 style
  }).join(", ");


const PickupSelector = ({
  pickupDate,
  pickupTime,
  onDateChange,
  onTimeChange,
}) => {
  // Date -> "YYYY-MM-DD" LOCAL
  const formatAsInputDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Parse "YYYY-MM-DD" as LOCAL (no TZ shift)
  const parseLocal = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight
  };

  // --- strict 24h cutoff ---
  const minDateTime = useMemo(() => {
    const t = new Date();
    t.setMinutes(t.getMinutes() + 24 * 60); // now + 24h
    return t;
  }, []);
  const minDateStr = formatAsInputDate(minDateTime);

  // time helpers
  const timeToMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const slotStartMinutes = (slot) => timeToMinutes(slot.split('-')[0]); // "10:00-13:00" -> 10:00
  const cutoffMinutes = minDateTime.getHours() * 60 + minDateTime.getMinutes();

  // available slots
  const SLOTS = ['10:00-13:00', '14:00-16:30'];

  // Is chosen date the min date?
  const sameAsMinDate = pickupDate && pickupDate === minDateStr;

  // Allowed slot check
  const isSlotAllowed = (slot) =>
    !sameAsMinDate || slotStartMinutes(slot) >= cutoffMinutes;

  // Allowed slots for current selection (used for the “no slots left” hint)
  const allowedSlotsForSelected = useMemo(() => {
    if (!pickupDate) return SLOTS;
    if (pickupDate !== minDateStr) return SLOTS; // all allowed on later dates
    // min date: only slots after cutoff
    return SLOTS.filter(isSlotAllowed);
  }, [pickupDate, minDateStr]); // isSlotAllowed depends on these

  const handleDateChange = (e) => {
    const selectedStr = e.target.value;
    if (!selectedStr) return;

    // Block holidays
    if (isBlockedDate(selectedStr)) {
      onDateChange("");     // clear date
      onTimeChange("");     // clear time
      alert(`Pickup is unavailable on holidays (${formatBlockedDatesForHumans()}).`);
      return;
    }

    // If date is before the min date, bump to min date
    const selected = parseLocal(selectedStr);
    const minDateOnly = parseLocal(minDateStr);
    if (selected < minDateOnly) {
      onDateChange(minDateStr);
      onTimeChange('');
      alert(`Earliest pickup date is ${minDateStr}.`);
      return;
    }

    // Valid date
    onDateChange(selectedStr);

    // If currently selected time becomes invalid on this date, clear it; otherwise reset to force intentional choice
    if (pickupTime && selectedStr === minDateStr && !isSlotAllowed(pickupTime)) {
      onTimeChange('');
    } else {
      onTimeChange('');
    }
  };

  const handleTimeChange = (e) => {
    const next = e.target.value;
    if (!next) return onTimeChange('');

    if (!isSlotAllowed(next)) {
      onTimeChange('');
      alert('That time slot is not available with 24h notice. Please pick a later slot.');
      return;
    }
    onTimeChange(next);
  };

  const showNoSlotsToday =
    pickupDate === minDateStr && allowedSlotsForSelected.length === 0;

  return (
    <section className="pickup-section">
      <div className="pickup-grid">
        {/* Date */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="pickup-date">Pickup Date</label>
          <input
            id="pickup-date"
            className="pickup-input"
            type="date"
            value={pickupDate}
            min={minDateStr}
            onChange={handleDateChange}
          />
          <p className="pickup-hint">
            Pickups require at least 24 hours&apos; notice.
          </p>
        </div>

        {/* Time */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="pickup-time">Pickup Time</label>
          <select
            id="pickup-time"
            className="pickup-select"
            value={pickupTime}
            onChange={handleTimeChange}
            disabled={!pickupDate}
          >
            <option value="">Select a time slot</option>
            {SLOTS.map((slot) => (
              <option key={slot} value={slot} disabled={!isSlotAllowed(slot)}>
                {slot} {!isSlotAllowed(slot) ? ' — unavailable (<24h)' : ''}
              </option>
            ))}
          </select>

          {showNoSlotsToday && (
            <div className="pickup-hint">
              <span>No slots left for this date.</span>
            </div>
          )}

          {sameAsMinDate && allowedSlotsForSelected.length > 0 && (
            <p className="pickup-hint">
              Only later slots are available with 24h notice today.
            </p>
          )}
        </div>
      </div>

      <div className="general-text">
        <p>Please review your order details and pickup time before continuing.</p>
        <p>Once payment is processed, orders cannot be modified or cancelled.</p>
      </div>
    </section>
  );
};

export default PickupSelector;

import '../styles/PickupSelector.css';
import { useEffect, useMemo, useState } from 'react';
import { isBlockedHoliday, blockedHolidaysLabel } from '../helpers/blockedDates';

const PickupSelector = ({
  pickupDate,
  pickupTime,
  onDateChange,
  onTimeChange,
  lockedDate,
  showReviewNotes = true,
}) => {
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const locked = Boolean(lockedDate);

  // Format Date -> YYYY-MM-DD (local)
  const formatAsInputDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Parse YYYY-MM-DD as LOCAL date (no timezone shift)
  const parseLocal = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const ordinal = (n) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
  };

  const formatLongDate = (yyyyMmDd) => {
    if (!yyyyMmDd) return '';
    const date = parseLocal(yyyyMmDd);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    return `${weekday}, ${month} ${ordinal(date.getDate())}`;
  };

  const lockedDateLabel = locked ? formatLongDate(lockedDate) : '';

  // --- 24h cutoff ---
  const minDateTime = useMemo(() => {
    const t = new Date();
    t.setMinutes(t.getMinutes() + 24 * 60);
    return t;
  }, []);
  const minDateStr = formatAsInputDate(minDateTime);

  useEffect(() => {
    if (!locked) return;
    if (pickupDate !== lockedDate) onDateChange(lockedDate);
    setDateError('');
  }, [locked, lockedDate, pickupDate, onDateChange]);

  // Time helpers
  const timeToMinutes = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const slotStartMinutes = (slot) =>
    timeToMinutes(slot.split('-')[0]);
  const cutoffMinutes =
    minDateTime.getHours() * 60 + minDateTime.getMinutes();

  const SLOTS = ['10:00-13:00', '14:00-16:30'];

  const sameAsMinDate = pickupDate === minDateStr;

  const isSlotAllowed = (slot) =>
    locked || !sameAsMinDate || slotStartMinutes(slot) >= cutoffMinutes;

  const allowedSlotsForSelected = useMemo(() => {
    if (!pickupDate) return SLOTS;
    if (pickupDate !== minDateStr) return SLOTS;
    return SLOTS.filter(isSlotAllowed);
  }, [pickupDate, minDateStr]);

  // iOS-safe: do NOT validate here
  const handleDateChange = (e) => {
    const value = e.target.value;
    if (!value) return;

    setDateError('');
    setTimeError('');

    onDateChange(value);
    onTimeChange('');
  };

  // Validate AFTER picker closes
  const handleDateBlur = () => {
    if (!pickupDate) return;
    if (locked) {
      setDateError('');
      return;
    }

    if (isBlockedHoliday(pickupDate)) {
      setDateError(
        `Pickup is unavailable on holidays (${blockedHolidaysLabel()}).`
      );
      onTimeChange('');
      return;
    }

    const selected = parseLocal(pickupDate);
    const minDateOnly = parseLocal(minDateStr);

    if (selected < minDateOnly) {
      setDateError(`Earliest pickup date is ${minDateStr}.`);
      onDateChange(minDateStr);
      onTimeChange('');
      return;
    }

    setDateError('');
  };

  const handleTimeChange = (e) => {
    const value = e.target.value;
    setTimeError('');

    if (!value) {
      onTimeChange('');
      return;
    }

    if (!isSlotAllowed(value)) {
      onTimeChange('');
      setTimeError(
        'That time slot is not available with 24h notice. Please pick a later slot.'
      );
      return;
    }

    onTimeChange(value);
  };

  const showNoSlotsToday =
    !locked && pickupDate === minDateStr && allowedSlotsForSelected.length === 0;

  return (
    <section className="pickup-section">
      <div className="pickup-grid">
        {/* Date */}
        <div className="pickup-field">
          <label htmlFor={locked ? undefined : 'pickup-date'} className="pickup-label">
            Pickup Date
            {locked && lockedDateLabel ? (
              <span className="pickup-label-date"> - {lockedDateLabel}</span>
            ) : null}
          </label>

          {locked ? null : (
            <input
              id="pickup-date"
              type="date"
              className="pickup-input"
              value={pickupDate}
              min={minDateStr}
              onChange={handleDateChange}
              onBlur={handleDateBlur}
            />
          )}

          {!locked ? (
            <p className="pickup-hint">
              Pickups require at least 24 hours&apos; notice.
            </p>
          ) : null}

          {dateError && (
            <p className="pickup-error">{dateError}</p>
          )}
        </div>

        {/* Time */}
        <div className="pickup-field pickup-field-time">
          <label htmlFor="pickup-time" className="pickup-label">
            Pickup Time
          </label>

          <select
            id="pickup-time"
            className="pickup-select"
            value={pickupTime}
            onChange={handleTimeChange}
            disabled={!pickupDate || !!dateError}
          >
            <option value="">Select a time slot</option>
            {SLOTS.map((slot) => (
              <option
                key={slot}
                value={slot}
                disabled={!isSlotAllowed(slot)}
              >
                {slot}
                {!isSlotAllowed(slot) ? ' — unavailable (<24h)' : ''}
              </option>
            ))}
          </select>

          {timeError && (
            <p className="pickup-error">{timeError}</p>
          )}

          {showNoSlotsToday && (
            <p className="pickup-hint">
              No slots left for this date.
            </p>
          )}
        </div>
      </div>

      {showReviewNotes ? (
        <div className="general-text">
          <p>Please review your order details and pickup time before continuing.</p>
          <p>Once payment is processed, orders cannot be modified or cancelled.</p>
        </div>
      ) : null}
    </section>
  );
};

export default PickupSelector;

import '../styles/PickupSelector.css';
import { useMemo } from 'react';

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

  // Build min date: today@00:00 + 3 days; if it lands on Tuesday, push to Wednesday
  const minDateObj = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3);
    if (t.getDay() === 2) t.setDate(t.getDate() + 1); // 2 = Tuesday
    return t;
  }, []);
  const minDateStr = formatAsInputDate(minDateObj);

  const handleDateChange = (e) => {
    const selectedStr = e.target.value;
    if (!selectedStr) return;

    const selected = parseLocal(selectedStr);
    const hadPreviousSelection = Boolean(pickupDate);
    const isTooEarly = selected < minDateObj;
    const isTuesday = selected.getDay() === 2;

    // If earlier than min
    if (isTooEarly) {
      if (!hadPreviousSelection) {
        // First time opening might auto-select today on iOS — snap silently
        onDateChange(minDateStr);
        onTimeChange('');
        return;
      }
      alert(`Earliest pickup is ${minDateStr}. Please choose a later date.`);
      // Be helpful: snap to earliest allowed
      onDateChange(minDateStr);
      onTimeChange('');
      return;
    }

    // If Tuesday
    if (isTuesday) {
      if (!hadPreviousSelection) {
        // Avoid alert on first open; just clear
        onDateChange('');
        onTimeChange('');
        return;
      }
      alert('Sorry, pickups are not available on Tuesdays. Please choose another day.');
      // Clear so user can re-pick
      onDateChange('');
      onTimeChange('');
      return;
    }

    // Valid date
    onDateChange(selectedStr);
    onTimeChange('');
  };

  const handleTimeChange = (e) => {
    onTimeChange(e.target.value);
  };

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
            Earliest available date is in 72 hours (no Tuesdays).
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
            <option value="9:00-12:00">9:00 - 12:00</option>
            <option value="13:00-16:00">13:00 - 16:00</option>
          </select>
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

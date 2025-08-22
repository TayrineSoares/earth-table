import '../styles/PickupSelector.css';
import { useMemo } from 'react';

const PickupSelector = ({
  pickupDate,
  pickupTime,
  onDateChange,
  onTimeChange,
}) => {
  // Date -> "YYYY-MM-DD" (LOCAL)
  const formatAsInputDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Parse "YYYY-MM-DD" as LOCAL (no timezone shift)
  const parseLocal = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight
  };

  // Build min date: today@00:00 + 3 days, then skip Tuesday if it lands there
  const minDateObj = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3);
    // 0=Sun, 1=Mon, 2=Tue...
    if (t.getDay() === 2) {
      t.setDate(t.getDate() + 1); // push to Wednesday
    }
    return t;
  }, []);
  const minDateStr = formatAsInputDate(minDateObj);

  const handleDateChange = (e) => {
    const selectedStr = e.target.value;
    if (!selectedStr) return;

    const selected = parseLocal(selectedStr);

    // If earlier than min, snap to min (avoid alert pop-ups on mobile)
    if (selected < minDateObj) {
      onDateChange(minDateStr);
      onTimeChange('');
      return;
    }

    // Disallow Tuesdays: if chosen Tuesday, clear and let user pick again
    if (selected.getDay() === 2) {
      onDateChange('');
      onTimeChange('');
      return;
    }

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
            Earliest available date is in 72 hours (no Tuesdays). If you pick an earlier date,
            we’ll move it to the earliest allowed.
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

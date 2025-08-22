import '../styles/PickupSelector.css';
import { useMemo } from 'react';

const PickupSelector = ({
  pickupDate,
  pickupTime,
  onDateChange,
  onTimeChange,
}) => {
  // Date -> "YYYY-MM-DD" in LOCAL time
  const formatAsInputDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse "YYYY-MM-DD" as a LOCAL date (no timezone shift)
  const parseLocal = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight
  };

  // Earliest allowed date: local midnight today + 3 days (72h)
  const minDateObj = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3);
    return t;
  }, []);
  const minDateStr = formatAsInputDate(minDateObj);

  const handleDateChange = (e) => {
    const selectedDate = e.target.value;
    if (!selectedDate) return;

    // Parse into local time and compare Date objects
    const localDate = parseLocal(selectedDate);

    // Enforce 72h minimum
    if (localDate < minDateObj) {
      alert(`Earliest pickup is ${minDateStr}. Please choose a later date.`);
      return;
    }

    // Disallow Tuesdays (0=Sun, 1=Mon, 2=Tue, ...)
    if (localDate.getDay() === 2) {
      alert('Sorry, pickups are not available on Tuesdays. Please choose another day.');
      return;
    }

    onDateChange(selectedDate);
    onTimeChange('');
  };

  const handleTimeChange = (e) => {
    onTimeChange(e.target.value);
  };

  // Optional: pretty display if you ever need it
  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
          <p className="pickup-hint">Earliest available date is in 72 hours. (No Tuesdays)</p>
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

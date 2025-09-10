import '../styles/PickupSelector.css';
import { useMemo, useEffect } from 'react';

const pcRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/; // Canadian postal code

export default function DeliverySelector({
  deliveryDate,
  onDeliveryDateChange,   // (yyyy-mm-dd)
  postalCode,
  onPostalCodeChange,
  feeCents,
  onValidate,             // ({ valid, normalizedPostal })
}) {
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

  // Normalize postal like "M5V3L9" → "M5V 3L9"
  const normalizePostal = (value) => {
    if (!value) return '';
    const v = value.toUpperCase().replace(/\s+/g, '');
    if (v.length >= 6) return `${v.slice(0, 3)} ${v.slice(3, 6)}`;
    return v;
  };

  // Validate postal on change (same pattern as before)
  useEffect(() => {
    const valid = pcRegex.test(postalCode || '');
    onValidate?.({ valid, normalizedPostal: valid ? normalizePostal(postalCode) : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode]);

  const handleDateChange = (e) => {
    const selectedStr = e.target.value;
    if (!selectedStr) return;

    const selected = parseLocal(selectedStr);
    const hadPreviousSelection = Boolean(deliveryDate);
    const isTooEarly = selected < minDateObj;
    const isTuesday = selected.getDay() === 2;

    // If earlier than min
    if (isTooEarly) {
      if (!hadPreviousSelection) {
        // iOS-first-open quirk: snap silently
        onDeliveryDateChange(minDateStr);
        return;
      }
      alert(`Earliest delivery is ${minDateStr}. Please choose a later date.`);
      onDeliveryDateChange(minDateStr);
      return;
    }

    // If Tuesday (no deliveries)
    if (isTuesday) {
      if (!hadPreviousSelection) {
        // Avoid alert on first open; just clear
        onDeliveryDateChange('');
        return;
      }
      alert('Sorry, deliveries are not available on Tuesdays. Please choose another day.');
      onDeliveryDateChange('');
      return;
    }

    // Valid date
    onDeliveryDateChange(selectedStr);
  };

  return (
    <section className="pickup-section">
      <div className="pickup-grid">
        {/* Delivery Date */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="delivery-date">Delivery Date</label>
          <input
            id="delivery-date"
            className="pickup-input"
            type="date"
            value={deliveryDate}
            min={minDateStr}
            onChange={handleDateChange}
          />
          <p className="pickup-hint">
            Earliest available date is in 72 hours (no Tuesdays). Delivery window is 11:00 AM – 6:00 PM.
          </p>
        </div>

        {/* Postal Code */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="delivery-postal">Postal Code</label>
          <input
            id="delivery-postal"
            className="pickup-input"
            placeholder="e.g., M5V 3L9"
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
          />
          {feeCents > 0 && (
            <p className="pickup-hint">Estimated delivery fee: ${(feeCents / 100).toFixed(2)}</p>
          )}
        </div>
      </div>

      <div className="general-text">
        <p>Please include your full delivery address in the Special Instructions box.</p>
        <p>Once payment is processed, orders cannot be modified or cancelled.</p>
      </div>
    </section>
  );
}

import '../styles/PickupSelector.css';
import { useMemo, useEffect } from 'react';
import { isBlockedHoliday, blockedHolidaysLabel } from '../helpers/blockedDates'; 


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

  // --- strict 24h cutoff (now + 24h) ---
  const minDateTime = useMemo(() => {
    const t = new Date();
    t.setMinutes(t.getMinutes() + 24 * 60);
    return t;
  }, []);
  const minDateStr = formatAsInputDate(minDateTime);

  // Delivery window (start/end minutes from midnight)
  const START_MIN = 11 * 60; // 11:00
  const END_MIN   = 18 * 60; // 18:00
  const cutoffMinutes = minDateTime.getHours() * 60 + minDateTime.getMinutes();

  // If chosen date is the earliest allowed date, we only have a valid slot
  // if the 24h cutoff is *before* the window end.
  const isMinDate = deliveryDate && deliveryDate === minDateStr;
  const hasAnyTimeLeftToday = cutoffMinutes < END_MIN;

  // Normalize postal like "M5V3L9" → "M5V 3L9"
  const normalizePostal = (value) => {
    if (!value) return '';
    const v = value.toUpperCase().replace(/\s+/g, '');
    if (v.length >= 6) return `${v.slice(0, 3)} ${v.slice(3, 6)}`;
    return v;
  };

  // Validate postal on change
  useEffect(() => {
    const valid = pcRegex.test(postalCode || '');
    onValidate?.({ valid, normalizedPostal: valid ? normalizePostal(postalCode) : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode]);


  const handleDateChange = (e) => {
    const selectedStr = e.target.value;
    if (!selectedStr) return;

    //block holidays 
    if (isBlockedHoliday(selectedStr)) {
      onDeliveryDateChange("");
      alert(`Delivery is unavailable on holidays (${blockedHolidaysLabel()}).`);
      return;
    }


    // If date is before the earliest allowed date, snap to earliest
    const selected = parseLocal(selectedStr);
    const minDateOnly = parseLocal(minDateStr);
    if (selected < minDateOnly) {
      onDeliveryDateChange(minDateStr);
      alert(`Earliest delivery date is ${minDateStr}.`);
      return;
    }

    // Otherwise accept the user's choice; helper below will inform if no time left
    onDeliveryDateChange(selectedStr);
  };

  return (
    <section className="pickup-section">
      <div className="pickup-grid">

        {/* Postal Code */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="delivery-postal">Postal Code (Delivery Quote)</label>
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

        <div className="general-text">
          <p>Please include your full delivery address in the Special Instructions box below.</p>
        </div>

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
            Deliveries require at least 24 hours' notice. Delivery window is 11:00 AM – 6:00 PM.
          </p>

          {/* Neutral helper if picking earliest date but 24h pushes past window end */}
          {isMinDate && !hasAnyTimeLeftToday && (
            <div className="pickup-helper">
              <span>No slots left for this date.</span>
            </div>
          )}

        </div>

        <div className="general-text">
          <p>Please review your order details before continuing.</p>
          <p>Once payment is processed, orders cannot be modified or cancelled.</p>
        </div>

      </div>
    </section>
  );
}

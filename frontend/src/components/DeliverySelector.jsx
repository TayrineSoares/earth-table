import "../styles/PickupSelector.css";
import { useMemo, useEffect, useState } from "react";
import {
  isBlockedHoliday,
  blockedHolidaysLabel,
} from "../helpers/blockedDates";

const pcRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/; // Canadian postal code

export default function DeliverySelector({
  deliveryDate,
  onDeliveryDateChange, // (yyyy-mm-dd)
  postalCode,
  onPostalCodeChange,
  feeCents,
  onValidate, // ({ valid, normalizedPostal })
  lockedDate,
  showReviewNotes = true,
  onCalculate,
  calculateLoading = false,
  showDateField = true,
}) {
  const [dateError, setDateError] = useState("");
  const locked = Boolean(lockedDate);

  // Date -> "YYYY-MM-DD" LOCAL
  const formatAsInputDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Parse "YYYY-MM-DD" as LOCAL (no TZ shift)
  const parseLocal = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    return new Date(y, m - 1, d); // local midnight
  };

  // --- strict 24h cutoff (now + 24h) ---
  const minDateTime = useMemo(() => {
    const t = new Date();
    t.setMinutes(t.getMinutes() + 24 * 60);
    return t;
  }, []);
  const minDateStr = formatAsInputDate(minDateTime);

  const ordinal = (n) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    if (n % 10 === 1) return `${n}st`;
    if (n % 10 === 2) return `${n}nd`;
    if (n % 10 === 3) return `${n}rd`;
    return `${n}th`;
  };

  const formatLongDate = (yyyyMmDd) => {
    if (!yyyyMmDd) return "";
    const date = parseLocal(yyyyMmDd);
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "long" });
    return `${weekday}, ${month} ${ordinal(date.getDate())}`;
  };

  const lockedDateLabel = locked ? formatLongDate(lockedDate) : "";

  useEffect(() => {
    if (!locked) return;
    if (deliveryDate !== lockedDate) onDeliveryDateChange(lockedDate);
    setDateError("");
  }, [locked, lockedDate, deliveryDate, onDeliveryDateChange]);

  // Delivery window (start/end minutes from midnight)
  const START_MIN = 11 * 60; // 11:00
  const END_MIN = 18 * 60; // 18:00
  const cutoffMinutes = minDateTime.getHours() * 60 + minDateTime.getMinutes();

  // If chosen date is the earliest allowed date, we only have a valid slot
  // if the 24h cutoff is before the window end.
  const isMinDate = deliveryDate && deliveryDate === minDateStr;
  const hasAnyTimeLeftToday = cutoffMinutes < END_MIN;

  // Normalize postal like "M5V3L9" → "M5V 3L9"
  const normalizePostal = (value) => {
    if (!value) return "";
    const v = value.toUpperCase().replace(/\s+/g, "");
    if (v.length >= 6) return `${v.slice(0, 3)} ${v.slice(3, 6)}`;
    return v;
  };

  // Validate postal on change
  useEffect(() => {
    const valid = pcRegex.test(postalCode || "");
    onValidate?.({
      valid,
      normalizedPostal: valid ? normalizePostal(postalCode) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode]);

  // iOS-safe: do NOT validate/alert inside onChange (date picker fires while scrolling)
  const handleDateChange = (e) => {
    const selectedStr = e.target.value;
    if (!selectedStr) return;

    setDateError("");
    onDeliveryDateChange(selectedStr);
  };

  // Validate AFTER picker closes
  const handleDateBlur = () => {
    if (!deliveryDate) return;
    if (locked) {
      setDateError("");
      return;
    }

    // Block holidays (keep date visible; show error + prevent proceeding elsewhere)
    if (isBlockedHoliday(deliveryDate)) {
      setDateError(
        `Delivery is unavailable on holidays (${blockedHolidaysLabel()}).`,
      );
      return;
    }

    // If date is before the earliest allowed date, snap to earliest
    const selected = parseLocal(deliveryDate);
    const minDateOnly = parseLocal(minDateStr);

    if (selected < minDateOnly) {
      setDateError(`Earliest delivery date is ${minDateStr}.`);
      onDeliveryDateChange(minDateStr);
      return;
    }

    setDateError("");
  };

  return (
    <section className="pickup-section">
      <div className="pickup-grid">
        {/* Postal Code */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="delivery-postal">
            Postal Code (Delivery Quote)
          </label>
          {onCalculate ? (
            <div className="promo-row">
              <input
                id="delivery-postal"
                className="pickup-input"
                placeholder="e.g., M5V 3L9"
                value={postalCode}
                autoComplete="postal-code"
                onChange={(e) => onPostalCodeChange(e.target.value)}
              />
              <button
                type="button"
                className={`checkout-button promo-apply-btn ${!pcRegex.test(postalCode || "") || calculateLoading ? "is-disabled" : ""}`}
                onClick={onCalculate}
                disabled={!pcRegex.test(postalCode || "") || calculateLoading}
              >
                {calculateLoading ? "Calculating…" : "Calculate"}
              </button>
            </div>
          ) : (
            <input
              id="delivery-postal"
              className="pickup-input"
              placeholder="e.g., M5V 3L9"
              value={postalCode}
              autoComplete="postal-code"
              onChange={(e) => onPostalCodeChange(e.target.value)}
            />
          )}
          {feeCents > 0 && (
            <p className="pickup-hint">
              Delivery fee: ${(feeCents / 100).toFixed(2)}
            </p>
          )}
        </div>

        <div className="general-text">
          <p>
            Please include your full delivery address in the Special
            Instructions box below.
          </p>
        </div>

        {/* Delivery Date */}
        {showDateField ? (
          <div className="pickup-field">
            <label
              className="pickup-label"
              htmlFor={locked ? undefined : "delivery-date"}
            >
              Delivery Date
              {locked && lockedDateLabel ? (
                <span className="pickup-label-date">
                  {" "}
                  - {lockedDateLabel}, between 11:00 AM and 6:00 PM
                </span>
              ) : null}
            </label>
            {locked ? null : (
              <input
                id="delivery-date"
                className="pickup-input"
                type="date"
                value={deliveryDate}
                min={minDateStr}
                onChange={handleDateChange}
                onBlur={handleDateBlur}
              />
            )}

            {!locked ? (
              <p className="pickup-hint">
                Deliveries require at least 24 hours&apos; notice. Delivery
                window is 11:00 AM – 6:00 PM.
              </p>
            ) : null}

            {dateError && (
              <p className="pickup-error" role="alert">
                {dateError}
              </p>
            )}

            {isMinDate && !hasAnyTimeLeftToday && !locked && (
              <div className="pickup-helper">
                <span>No slots left for this date.</span>
              </div>
            )}
          </div>
        ) : null}

        {showReviewNotes ? (
          <div className="general-text">
            <p>Please review your order details before continuing.</p>
            <p>
              Once payment is processed, orders cannot be modified or cancelled.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

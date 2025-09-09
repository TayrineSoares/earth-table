
import { useEffect } from "react";

const pcRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/; // Canadian postal code

export default function DeliverySelector({
  postalCode,
  onPostalCodeChange,
  feeCents,
  onValidate, // we'll call this with { valid, normalizedPostal }
}) {
  // Normalize user input like "M5V3L9" or "M5V 3L9" to "M5V 3L9"
  const normalize = (value) => {
    if (!value) return "";
    const v = value.toUpperCase().replace(/\s+/g, "");
    if (v.length >= 6) return `${v.slice(0, 3)} ${v.slice(3, 6)}`;
    return v;
  };

  useEffect(() => {
    const valid = pcRegex.test(postalCode || "");
    onValidate?.({ valid, normalizedPostal: valid ? normalize(postalCode) : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode]);

  return (
    <div className="delivery-selector">
      <label htmlFor="postal" className="general-text">Postal code for delivery</label>
      <input
        id="postal"
        className="special-note-input"
        placeholder="e.g., M5V 3L9"
        value={postalCode}
        onChange={(e) => onPostalCodeChange(e.target.value)}
      />
  

      {feeCents > 0 && (
        <p className="general-text">

          Please enter you full delivery address in the Special Instructions box below. 
        </p>
      )}

  
    </div>
  );
}

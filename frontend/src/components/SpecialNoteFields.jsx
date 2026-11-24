/**
 * Pickup: one Notes box.
 * Delivery: Address + Notes (still saved as one special_note).
 */
export default function SpecialNoteFields({
  fulfillment = 'pickup',
  address = '',
  notes = '',
  onAddressChange,
  onNotesChange,
  idPrefix = 'special',
  className = '',
}) {
  const delivery = fulfillment === 'delivery';
  const stackClass = ['special-note-stack', className].filter(Boolean).join(' ');

  if (!delivery) {
    return (
      <div className={stackClass}>
        <div className="special-note-container">
          <label htmlFor={`${idPrefix}-notes`} className="special-note-label">
            Notes
          </label>
          <p className="special-note-helper">
            Allergies, dietary needs, or anything else we should know. Questions? Email hello@earthtableco.ca.
          </p>
          <textarea
            className="special-note-input"
            id={`${idPrefix}-notes`}
            value={notes}
            onChange={(e) => onNotesChange?.(e.target.value)}
            placeholder="Allergies, special instructions…"
            rows="3"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={stackClass}>
      <div className="special-note-container">
        <label htmlFor={`${idPrefix}-address`} className="special-note-label">
          Address
        </label>
        <p className="special-note-helper">
          Full delivery address including unit and city.
        </p>
        <textarea
          className="special-note-input"
          id={`${idPrefix}-address`}
          value={address}
          onChange={(e) => onAddressChange?.(e.target.value)}
          placeholder="Street address, unit, city…"
          rows="3"
          autoComplete="street-address"
        />
      </div>
      <div className="special-note-container">
        <label htmlFor={`${idPrefix}-notes`} className="special-note-label">
          Notes
        </label>
        <p className="special-note-helper">
          Allergies, gate codes, drop-off instructions. Questions? Email hello@earthtableco.ca.
        </p>
        <textarea
          className="special-note-input"
          id={`${idPrefix}-notes`}
          value={notes}
          onChange={(e) => onNotesChange?.(e.target.value)}
          placeholder="Allergies, gate codes, special instructions…"
          rows="3"
        />
      </div>
    </div>
  );
}

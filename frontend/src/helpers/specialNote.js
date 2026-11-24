/**
 * Delivery UI uses two boxes (Address + Notes) but we still persist one
 * `special_note` string. Structured format so we can round-trip:
 *
 *   Address:
 *   123 Main St, Unit 4
 *
 *   Notes:
 *   Gate code 12
 *
 * Unlabeled blobs: legacy delivery → address; pickup→delivery switch → notes.
 */

const ADDRESS_HEAD = /^Address:\s*/i;
const NOTES_SPLIT = /\n\s*Notes:\s*/i;

export function joinDeliverySpecialNote(address, notes) {
  const a = String(address || '').trim();
  const n = String(notes || '').trim();
  if (!a && !n) return '';
  if (a && n) return `Address:\n${a}\n\nNotes:\n${n}`;
  if (a) return `Address:\n${a}`;
  return `Notes:\n${n}`;
}

export function splitDeliverySpecialNote(raw, { unlabeledAs = 'address' } = {}) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return { address: '', notes: '' };

  if (ADDRESS_HEAD.test(text) || /^Notes:\s*/i.test(text)) {
    if (ADDRESS_HEAD.test(text)) {
      const after = text.replace(ADDRESS_HEAD, '');
      const parts = after.split(NOTES_SPLIT);
      return {
        address: String(parts[0] || '').trim(),
        notes: String(parts[1] || '').trim(),
      };
    }
    return {
      address: '',
      notes: text.replace(/^Notes:\s*/i, '').trim(),
    };
  }

  // Unlabeled: pickup notes when switching to delivery, or legacy one-box delivery.
  if (unlabeledAs === 'notes') {
    return { address: '', notes: text };
  }
  return { address: text, notes: '' };
}

/** Pickup keeps a plain notes string (no Address: prefix). */
export function composeSpecialNote({ delivery, address, notes }) {
  const n = String(notes || '').trim();
  if (delivery) return joinDeliverySpecialNote(address, notes);
  return n;
}

/**
 * @param {string} raw
 * @param {{ delivery?: boolean, unlabeledAs?: 'address' | 'notes' }} [opts]
 *   unlabeledAs: 'notes' when opening delivery editor from a pickup box so
 *   plain pickup notes land in Notes, not Address.
 */
export function parseSpecialNote(raw, { delivery = false, unlabeledAs = 'address' } = {}) {
  const text = String(raw || '').trim();
  // Structured blobs always split, even when switching toward pickup.
  if (delivery || ADDRESS_HEAD.test(text) || /^Notes:\s*/i.test(text)) {
    return splitDeliverySpecialNote(text, { unlabeledAs: delivery ? unlabeledAs : 'address' });
  }
  return { address: '', notes: text };
}

export function deliveryAddressReady(address) {
  return String(address || '').trim().length >= 8;
}

/** Customer-facing display without the Address:/Notes: markers. */
export function formatSpecialNoteDisplay(raw, { delivery = false } = {}) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (!delivery) return text;
  const { address, notes } = splitDeliverySpecialNote(text);
  if (address && notes) return `${address}\n\n${notes}`;
  return address || notes;
}

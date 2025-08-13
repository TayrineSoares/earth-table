
// Helper: turn cents into "$12.34 CAD"
function formatMoney(cents) {
  if (typeof cents !== 'number') return '$0.00 CAD';
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars} CAD`;
}

/**
 * Make the subject, HTML and text for the customer's order confirmation.
 * Pass in your detailedOrder object from the DB.
 */
function renderCustomerOrderEmail(detailedOrder = {}) {
  // Basic fields with safe fallbacks
  const id = detailedOrder.id ?? 'N/A';
  const status = detailedOrder.status ?? 'processing';
  const total = formatMoney(detailedOrder.total_cents ?? 0);
  const pickupDate = detailedOrder.pickup_date_formatted ?? '—';
  const pickupTime = detailedOrder.pickup_time_slot ?? '—';

  // Items (safe defaults)
  const items = Array.isArray(detailedOrder.products) ? detailedOrder.products : [];

  // Build the items list for HTML
  const itemsHtml = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const price = formatMoney(p.unit_price_cents ?? 0);
    return `<li>${qty}x ${name} — ${price}</li>`;
  }).join('');

  // Build the items list for plain text
  const itemsText = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const price = formatMoney(p.unit_price_cents ?? 0);
    return `- ${qty}x ${name} @ ${price}`;
  }).join('\n');

  // Subject
  const subject = `Order Confirmation #${id} — Earth Table`;

  // Simple, readable HTML
  const html = `
    <h2>Thank you for your order!</h2>
    <p>We've received your order and it's being processed.</p>

    <h3>Order Summary</h3>
    <p><strong>Order ID:</strong> ${id}</p>
    <p><strong>Status:</strong> ${status}</p>

    <h3>Items</h3>
    <ul>${itemsHtml || '<li>(no items)</li>'}</ul>

    <p><strong>Total:</strong> ${total} <em>(includes 13% HST)</em></p>
    <p><strong>Pickup Date:</strong> ${pickupDate}</p>
    <p><strong>Pickup Time:</strong> ${pickupTime}</p>

    <p>Earth Table Team 🧡</p>
  `;

  // Plain-text fallback (helps deliverability)
  const text = `Thank you for your order!

Order ID: ${id}
Status: ${status}

Items:
${itemsText || '(no items)'}

Total: ${total} (includes 13% HST)
Pickup Date: ${pickupDate}
Pickup Time: ${pickupTime}

Earth Table Team`;

  // Return everything the sender needs
  return {
    subject,
    html,
    text,
  };
}
// ----------------------------------------------------------------------

/**
 * Owner/manager notification email for a new order.
 */
function renderOwnerOrderEmail(detailedOrder = {}) {
  const id = detailedOrder.id ?? 'N/A';
  const status = detailedOrder.status ?? 'processing';
  const total = formatMoney(detailedOrder.total_cents ?? 0);
  const pickupDate = detailedOrder.pickup_date_formatted ?? '—';
  const pickupTime = detailedOrder.pickup_time_slot ?? '—';
  const buyerEmail = detailedOrder.buyer_email ?? '—';
  const buyerName = detailedOrder.buyer_name ?? '—';

  const items = Array.isArray(detailedOrder.products) ? detailedOrder.products : [];
  const itemsHtml = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const price = formatMoney(p.unit_price_cents ?? 0);
    return `<li>${qty}x ${name} — ${price}</li>`;
  }).join('');

  const itemsText = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const price = formatMoney(p.unit_price_cents ?? 0);
    return `- ${qty}x ${name} @ ${price}`;
  }).join('\n');

  const subject = `🛒 New order #${id} — Earth Table`;
  const html = `
    <h2>New order received</h2>
    <p><strong>Customer:</strong> ${buyerName} &lt;${buyerEmail}&gt;</p>
    <p><strong>Status:</strong> ${status}</p>
    <p><strong>Total:</strong> ${total}</p>
    <p><strong>Pickup:</strong> ${pickupDate} ${pickupTime}</p>

    <h3>Items</h3>
    <ul>${itemsHtml || '<li>(no items)</li>'}</ul>
  `;
  const text = `New order received

Customer: ${buyerName} <${buyerEmail}>
Status: ${status}
Total: ${total}
Pickup: ${pickupDate} ${pickupTime}

Items:
${itemsText || '(no items)'}
`;

  return {
    subject,
    html,
    text,
  };
}

module.exports = { renderCustomerOrderEmail, formatMoney, renderOwnerOrderEmail };
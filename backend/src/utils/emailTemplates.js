
// Helper: turn cents into "$12.34 CAD"
function formatMoney(cents) {
  if (typeof cents !== 'number') return '$0.00 CAD';
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars} CAD`;
}

/**
 * Make the subject, HTML and text for the customer's order confirmation.
 * Pass in detailedOrder object from the DB.
 */
function renderCustomerOrderEmail(detailedOrder = {}) {
  const id = detailedOrder.id ?? 'N/A';
  const status = detailedOrder.status ?? 'processing';
  const total = formatMoney(detailedOrder.total_cents ?? 0);
  const pickupDate = detailedOrder.pickup_date_formatted ?? '—';
  const pickupTime = detailedOrder.pickup_time_slot ?? '—';
  


  // Items (safe defaults)
  const items = Array.isArray(detailedOrder.products) ? detailedOrder.products : [];


  const itemsHtml = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const each = formatMoney(p.unit_price_cents ?? 0);
    return `<li style="margin:2px 0;">${qty} x ${name} — ${each}</li>`;
  }).join('');

  const subject = `Order Confirmation #${id} — Earth Table`;

  const html = `
    <div style="font-family:Arial, sans-serif; max-width:600px; margin:0 auto; color:#111; line-height:1.5;">
      <h1 style="font-size:20px; margin:0 0 8px; color:#BE7200;">Thank you for your order!</h1>
      <p style="margin:0 0 16px;">We've received your order and it's being processed.</p>

      <div style="border:1px solid #EDA413; background:#FFFBF3; border-radius:12px; padding:12px; margin:0 0 16px;">
        <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${id}</p>
        <p style="margin:0;"><strong>Status:</strong> ${status}</p>
      </div>

      <h2 style="font-size:16px; margin:0 0 8px; color:#333;">Items</h2>
      <ul style="margin:0 0 12px; padding-left:18px;">${itemsHtml}</ul>

      <p style="margin:12px 0 6px;"><strong>Total:</strong> ${total} <span style="color:#666; font-size:12px;">(includes 13% HST)</span></p>

      <p style="margin:6px 0;"><strong>Pickup Date:</strong> ${pickupDate}</p>
      <p style="margin:0 0 16px;"><strong>Pickup Time:</strong> ${pickupTime}</p>
      <p style="margin:0 0 16px;"><strong>Pickup Address:</strong> 123 FAKE STREET </p>

      <p style="margin:16px 0;">Earth Table Team 🧡</p>

      <hr style="border:none; border-top:1px solid #eee; margin:12px 0;" />

      <p style="margin:8px 0 0; font-size:12px; color:#666;">
        Questions about your order? Email us at
        <a href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a>.
      </p>
      <p style="margin:4px 0 0; font-size:12px; color:#666;">*** Please do not reply to this email. *** </p>
    </div>
    `
  ;

  const itemsText = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const price = formatMoney(p.unit_price_cents ?? 0);
    return `- ${qty}x ${name} @ ${price}`;
  }).join('\n');

  const text = ` Earth Table — Order #${id} confirmed
  
  Thank you for your order!

  Order ID: ${id}
  Status: ${status}

  Items:
  ${itemsText || '(no items)'}

  Total: ${total} (includes 13% HST)
  Pickup Date: ${pickupDate}
  Pickup Time: ${pickupTime}

  Earth Table Team`;

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
  const buyerPhone = detailedOrder.buyer_phone_number ?? '—';
  const specialInstructions = detailedOrder.special_note ?? '—';

  const items = Array.isArray(detailedOrder.products) ? detailedOrder.products : [];
  const itemsHtml = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const price = formatMoney(p.unit_price_cents ?? 0);
    return `<li>${qty}x ${name} — ${price}</li>`;
  }).join('');

  
  const subject = `🛒 New order #${id} — Earth Table`;

  const html = `
    <div style="font-family:Arial, sans-serif; max-width:600px; margin:0 auto; color:#111; line-height:1.5;">
      <h1 style="font-size:20px; margin:0 0 8px; color:#BE7200;">New order received</h1>

      <div style="border:1px solid #EDA413; background:#FFFBF3; border-radius:12px; padding:12px; margin:0 0 16px;">
        <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${id}</p>
        <p style="margin:0 0 6px;"><strong>Status:</strong> ${status}</p>
        <p style="margin:0;"><strong>Total:</strong> ${total}</p>
      </div>

      <p style="margin:0 0 6px;"><strong>Pickup Date:</strong> ${pickupDate}</p>
      <p style="margin:0 0 12px;"><strong>Pickup Time:</strong> ${pickupTime}</p>
      <p style="margin:0 0 12px;"><strong>Special Instructions:</strong> ${specialInstructions}</p>

      <h2 style="font-size:16px; margin:16px 0 8px; color:#333;">Customer</h2>
      <p style="margin:0 0 4px;"><strong>Buyer Name:</strong> ${buyerName}</p>
      <p style="margin:0 0 4px;"><strong>Email:</strong> ${buyerEmail}</p>

      <h2 style="font-size:16px; margin:16px 0 8px; color:#333;">Items</h2>
      <ul style="margin:0 0 12px; padding-left:18px;">${itemsHtml}</ul>
    </div>
    `
  ;

  const itemsText = items.map((p) => {
    const name = p.slug ?? p.name ?? 'Item';
    const qty = p.quantity ?? 1;
    const price = formatMoney(p.unit_price_cents ?? 0);
    return `- ${qty}x ${name} @ ${price}`;
  }).join('\n');

  const text = `New order received

  Customer: ${buyerName} <${buyerEmail}>
  Phone: ${buyerPhone}
  Status: ${status}
  Total: ${total}
  Pickup: ${pickupDate} ${pickupTime}

  Items:
  ${itemsText || '(no items)'}
  `
;

  return {
    subject,
    html,
    text,
  };
}

module.exports = { renderCustomerOrderEmail, formatMoney, renderOwnerOrderEmail };
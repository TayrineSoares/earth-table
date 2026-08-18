// Helper: turn cents into "$12.34 CAD"
function formatMoney(cents) {
  if (!Number.isFinite(cents)) return "$0.00 CAD";
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars} CAD`;
}

// helper so multi-line notes render nicely in HTML
const nl2br = (s = "") => String(s).replace(/\n/g, "<br/>");

// TAX
const HST_RATE = 0.13;

// Safely read postal from buyer_stripe_payment_info JSON
const getPostalFromBuyerInfo = (buyerStripeInfo) => {
  try {
    const parsed =
      typeof buyerStripeInfo === "string"
        ? JSON.parse(buyerStripeInfo)
        : buyerStripeInfo || {};
    return parsed?.delivery_meta?.postal_code || "—";
  } catch {
    return "—";
  }
};

// STRICT: read fee_cents_server (pre-tax) from Stripe meta and compute tax-included
const getDeliveryFeeFromBuyerInfoStrict = (buyerStripeInfo) => {
  try {
    const parsed =
      typeof buyerStripeInfo === "string"
        ? JSON.parse(buyerStripeInfo)
        : buyerStripeInfo || {};
    const preTax = Number(parsed?.delivery_meta?.fee_cents_server) || 0;
    const withTax = preTax > 0 ? Math.round(preTax * (1 + HST_RATE)) : 0;
    return { preTaxCents: preTax, withTaxCents: withTax };
  } catch {
    return { preTaxCents: 0, withTaxCents: 0 };
  }
};

/**
 * Customer order confirmation email
 */
function renderCustomerOrderEmail(detailedOrder = {}) {
  const id = detailedOrder.id ?? "N/A";
  const status = detailedOrder.status ?? "processing";
  const total = formatMoney(detailedOrder.total_cents ?? 0);
  const pickupDate = detailedOrder.pickup_date_formatted ?? "—";
  const pickupTime = detailedOrder.pickup_time_slot ?? "—";

  const isDelivery = detailedOrder.delivery === true;
  const deliveryDate = detailedOrder.delivery_date_formatted ?? "—";
  const specialInstructions = detailedOrder.special_note ?? "—";

  const deliveryPostal = getPostalFromBuyerInfo(
    detailedOrder.buyer_stripe_payment_info
  );
  const { preTaxCents, withTaxCents } = getDeliveryFeeFromBuyerInfoStrict(
    detailedOrder.buyer_stripe_payment_info
  );

  const items = Array.isArray(detailedOrder.products)
    ? detailedOrder.products
    : [];
  const itemsHtml = items
    .map((p) => {
      const name = p.slug ?? p.name ?? "Item";
      const qty = p.quantity ?? 1;
      const each = formatMoney(p.unit_price_cents ?? 0);
      return `<li style="margin:2px 0;">${qty} x ${name} — ${each}</li>`;
    })
    .join("");

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

      ${
        isDelivery
          ? `
            <p style="margin:6px 0;"><strong>Order Type:</strong> Delivery</p>
            <p style="margin:6px 0;"><strong>Delivery Date:</strong> ${deliveryDate}</p>
            <p style="margin:6px 0;"><strong>Delivery Window:</strong> 11:00 AM – 6:00 PM</p>
            ${
              withTaxCents > 0
                ? `<p style="margin:6px 0;"><strong>Delivery Fee:</strong> ${formatMoney(
                    withTaxCents
                  )} <span style="color:#666; font-size:12px;">(incl 13% HST)</span></p>`
                : ""
            }
            ${
              preTaxCents > 0
                ? `<div style="font-size:12px; color:#666; margin:2px 0 10px;">
              Pre-tax: ${formatMoney(preTaxCents)} • HST (13%): ${formatMoney(
                    Math.max(withTaxCents - preTaxCents, 0)
                  )}
            </div>`
                : ""
            }
            <p style="margin:6px 0;"><strong>Delivery Postal Code used for Quote:</strong> ${deliveryPostal}</p>
            <p style="margin:6px 0;"><strong>Delivery address and Special Instructions:</strong></p>
            <blockquote style="margin:8px 0; padding-left:12px; border-left:3px solid #ddd;">
              ${nl2br(specialInstructions)}
            </blockquote>
          `
          : `
            <p style="margin:6px 0;"><strong>Order Type:</strong> Pickup</p>
            <p style="margin:6px 0;"><strong>Pickup Date:</strong> ${pickupDate}</p>
            <p style="margin:0 0 16px;"><strong>Pickup Time:</strong> ${pickupTime}</p>
            <p style="margin:0 0 16px;"><strong>Pickup Address:</strong> 77 Woodstream Blvd, Vaughan, ON  - L4L 7Y7 </p>
            <p style="margin:0 0 16px;"><strong>Special Instructions:</strong> ${nl2br(
              specialInstructions
            )}</p>
          `
      }

      <p style="margin:16px 0;">Earth Table Team 🧡</p>

      <hr style="border:none; border-top:1px solid #eee; margin:12px 0;" />

      <p style="margin:8px 0 0; font-size:12px; color:#666;">
        Questions about your order? Email us at
        <a href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a>.
      </p>
      <p style="margin:4px 0 0; font-size:12px; color:#666;">*** Please do not reply to this email. *** </p>
    </div>
  `;

  const itemsText = items
    .map((p) => {
      const name = p.slug ?? p.name ?? "Item";
      const qty = p.quantity ?? 1;
      const price = formatMoney(p.unit_price_cents ?? 0);
      return `- ${qty}x ${name} @ ${price}`;
    })
    .join("\n");

  const text = `Earth Table — Order #${id} confirmed

Thank you for your order!

Order ID: ${id}
Status: ${status}

Items:
${itemsText || "(no items)"}

Total: ${total} (includes 13% HST)
${
  isDelivery
    ? `Order Type: Delivery
Delivery Date: ${deliveryDate}
Delivery Window: 11:00 AM – 6:00 PM
${
  withTaxCents > 0
    ? `Delivery Fee (incl 13% HST): ${formatMoney(withTaxCents)}
Pre-tax: ${formatMoney(preTaxCents)} • HST (13%): ${formatMoney(
        Math.max(withTaxCents - preTaxCents, 0)
      )}`
    : ""
}
Delivery Postal (for quote): ${deliveryPostal}
Delivery address and Special Instructions:
${detailedOrder.special_note ?? "—"}`
    : `Order Type: Pickup
Pickup Date: ${pickupDate}
Pickup Time: ${pickupTime}
Special Instructions:
${detailedOrder.special_note ?? "—"}`
}

Earth Table Team`;

  return { subject, html, text };
}

/**
 * Owner/manager notification email
 */
function renderOwnerOrderEmail(detailedOrder = {}) {
  const id = detailedOrder.id ?? "N/A";
  const status = detailedOrder.status ?? "processing";
  const total = formatMoney(detailedOrder.total_cents ?? 0);
  const pickupDate = detailedOrder.pickup_date_formatted ?? "—";
  const pickupTime = detailedOrder.pickup_time_slot ?? "—";
  const buyerEmail = detailedOrder.buyer_email ?? "—";
  const buyerName = detailedOrder.buyer_name ?? "—";
  const buyerPhone = detailedOrder.buyer_phone_number ?? "—";
  const specialInstructions = detailedOrder.special_note ?? "—";
  const isDelivery = detailedOrder.delivery === true;
  const deliveryDate = detailedOrder.delivery_date_formatted ?? "—";

  const deliveryPostal = getPostalFromBuyerInfo(
    detailedOrder.buyer_stripe_payment_info
  );
  const { preTaxCents, withTaxCents } = getDeliveryFeeFromBuyerInfoStrict(
    detailedOrder.buyer_stripe_payment_info
  );

  const items = Array.isArray(detailedOrder.products)
    ? detailedOrder.products
    : [];
  const itemsHtml = items
    .map((p) => {
      const name = p.slug ?? p.name ?? "Item";
      const qty = p.quantity ?? 1;
      const price = formatMoney(p.unit_price_cents ?? 0);
      return `<li>${qty}x ${name} — ${price}</li>`;
    })
    .join("");

  const subject = `🛒 New order #${id} — Earth Table`;

  const html = `
    <div style="font-family:Arial, sans-serif; max-width:600px; margin:0 auto; color:#111; line-height:1.5;">
      <h1 style="font-size:20px; margin:0 0 8px; color:#BE7200;">New order received</h1>

      <div style="border:1px solid #EDA413; background:#FFFBF3; border-radius:12px; padding:12px; margin:0 0 16px;">
        <p style="margin:0 0 6px;"><strong>Order ID:</strong> ${id}</p>
        <p style="margin:0 0 6px;"><strong>Status:</strong> ${status}</p>
        <p style="margin:0;"><strong>Total:</strong> ${total}</p>
      </div>

      ${
        isDelivery
          ? `
            <p style="margin:0 0 6px;"><strong>Order Type:</strong> Delivery</p>
            <p style="margin:0 0 6px;"><strong>Delivery Date:</strong> ${deliveryDate}</p>
            <p style="margin:0 0 6px;"><strong>Delivery Window:</strong> 11:00 AM - 6:00 PM</p>
            ${
              withTaxCents > 0
                ? `<p style="margin:0 0 6px;"><strong>Delivery Fee:</strong> ${formatMoney(
                    withTaxCents
                  )} <span style="color:#666; font-size:12px;">(incl 13% HST)</span></p>`
                : ""
            }
            ${
              preTaxCents > 0
                ? `<div style="font-size:12px; color:#666; margin:2px 0 10px;">
              Pre-tax: ${formatMoney(preTaxCents)} • HST (13%): ${formatMoney(
                    Math.max(withTaxCents - preTaxCents, 0)
                  )}
            </div>`
                : ""
            }
            <p style="margin:0 0 12px;"><strong>Delivery Postal Code used for Quote:</strong> ${deliveryPostal}</p>
            <p style="margin:0 0 12px;"><strong>Delivery address and Special Instructions:</strong><br/>${nl2br(
              specialInstructions
            )}</p>
          `
          : `
            <p style="margin:0 0 6px;"><strong>Order Type:</strong> Pickup</p>
            <p style="margin:0 0 6px;"><strong>Pickup Date:</strong> ${pickupDate}</p>
            <p style="margin:0 0 12px;"><strong>Pickup Time:</strong> ${pickupTime}</p>
            <p style="margin:0 0 12px;"><strong>Special Instructions:</strong> ${nl2br(
              specialInstructions
            )}</p>
          `
      }

      <h2 style="font-size:16px; margin:16px 0 8px; color:#333;">Customer</h2>
      <p style="margin:0 0 4px;"><strong>Buyer Name:</strong> ${buyerName}</p>
      <p style="margin:0 0 4px;"><strong>Email:</strong> ${buyerEmail}</p>
      <p style="margin:0 0 12px;"><strong>Phone:</strong> ${buyerPhone}</p>

      <h2 style="font-size:16px; margin:16px 0 8px; color:#333;">Items</h2>
      <ul style="margin:0 0 12px; padding-left:18px;">${itemsHtml}</ul>
    </div>
  `;

  const itemsText = items
    .map((p) => {
      const name = p.slug ?? p.name ?? "Item";
      const qty = p.quantity ?? 1;
      const price = formatMoney(p.unit_price_cents ?? 0);
      return `- ${qty}x ${name} @ ${price}`;
    })
    .join("\n");

  const text = `New order received

Customer: ${buyerName} <${buyerEmail}>
Phone: ${buyerPhone}
Status: ${status}
Total: ${total}
${
  isDelivery
    ? `Order Type: Delivery
Delivery Date: ${deliveryDate}
Delivery Window: 11:00 AM – 6:00 PM
${
  withTaxCents > 0
    ? `Delivery Fee (incl 13% HST): ${formatMoney(withTaxCents)}
  - Pre-tax: ${formatMoney(preTaxCents)}
  - HST (13%): ${formatMoney(Math.max(withTaxCents - preTaxCents, 0))}`
    : ""
}
Delivery Postal (for quote): ${deliveryPostal}
Delivery address and Special Instructions:
${specialInstructions}`
    : `Order Type: Pickup
Pickup Date: ${pickupDate}
Pickup Time: ${pickupTime}
Special Instructions:
${specialInstructions}`
}

Items:
${itemsText || "(no items)"}
`;

  return { subject, html, text };
}

function partnerProgramRulesHtml(audience = 'partner') {
  const ownCode =
    audience === 'partner'
      ? '<strong>You cannot use your own referral code</strong> on your own orders.'
      : 'The partner <strong>cannot use their own referral code</strong> on their own orders.';
  const earn =
    audience === 'partner'
      ? 'You earn <strong>10% of the pre-discount item subtotal</strong> (not the discounted amount, not delivery, not tax) on orders that use your code.'
      : 'The partner earns <strong>10% of the pre-discount item subtotal</strong> (not the discounted amount, not delivery, not tax) on orders that use their code.';
  const creditApply =
    audience === 'partner'
      ? "Store credit never expires and auto-applies at your own checkout."
      : "Store credit never expires and auto-applies at the partner's own checkout.";
  const payoutSwitch =
    audience === 'partner'
      ? 'Default payout is <strong>cash</strong>, paid by Earth Table outside the site. You can switch to <strong>store credit</strong> (or back) at most once a month; the change takes effect the following month. Amounts already earned keep the payout type they were earned under.'
      : 'Default payout is <strong>cash</strong>, paid by Earth Table outside the site. The partner can switch to <strong>store credit</strong> (or back) at most once a month; the change takes effect the following month. Amounts already earned keep the payout type they were earned under.';
  const invoiceLine =
    audience === 'partner'
      ? "Cashback starts as <strong>pending</strong>. Payout is <strong>once a month</strong>: on the 1st, the previous month's invoice closes. You'll get an email with a breakdown of that month's cashback — including who used your code — and you can also see the same details on your profile page."
      : "Cashback starts as <strong>pending</strong>. Payout is <strong>once a month</strong>: on the 1st, the previous month's invoice closes. The partner (and admin) get an email with a breakdown of that month's cashback — including who used the code — and the partner can also see the same details on their profile page.";

  return `
      <h2 style="font-size:16px; margin:16px 0 8px; color:#333;">How the code works</h2>
      <ul style="margin:0 0 12px; padding-left:18px;">
        <li>Friends get <strong>15% off</strong> their item subtotal (delivery and tax excluded from the discount).</li>
        <li>They must be registered with Earth Table and logged in.</li>
        <li>It only applies to their <strong>first order ever</strong> on the site, and the item subtotal must be at least <strong>$50</strong> before discount, tax, and delivery.</li>
        <li>A referral code cannot be combined with a regular promo code.</li>
        <li>${ownCode}</li>
      </ul>

      <h2 style="font-size:16px; margin:16px 0 8px; color:#333;">Cashback</h2>
      <ul style="margin:0 0 12px; padding-left:18px;">
        <li>${earn}</li>
        <li>${invoiceLine}</li>
        <li>${payoutSwitch}</li>
        <li>${creditApply}</li>
      </ul>
  `;
}

function partnerProgramRulesText(audience = 'partner') {
  const ownCode =
    audience === 'partner'
      ? 'You cannot use your own referral code on your own orders.'
      : 'The partner cannot use their own referral code on their own orders.';
  const earn =
    audience === 'partner'
      ? 'You earn 10% of the pre-discount item subtotal (not the discounted amount, not delivery, not tax) on orders that use your code.'
      : 'The partner earns 10% of the pre-discount item subtotal (not the discounted amount, not delivery, not tax) on orders that use their code.';
  const creditApply =
    audience === 'partner'
      ? 'Store credit never expires and auto-applies at your own checkout.'
      : "Store credit never expires and auto-applies at the partner's own checkout.";
  const payoutSwitch =
    audience === 'partner'
      ? 'Default payout is cash, paid by Earth Table outside the site. You can switch to store credit (or back) at most once a month; the change takes effect the following month. Amounts already earned keep the payout type they were earned under.'
      : 'Default payout is cash, paid by Earth Table outside the site. The partner can switch to store credit (or back) at most once a month; the change takes effect the following month. Amounts already earned keep the payout type they were earned under.';
  const invoiceLine =
    audience === 'partner'
      ? "Cashback starts as pending. Payout is once a month: on the 1st, the previous month's invoice closes. You'll get an email with a breakdown of that month's cashback — including who used your code — and you can also see the same details on your profile page."
      : "Cashback starts as pending. Payout is once a month: on the 1st, the previous month's invoice closes. The partner (and admin) get an email with a breakdown of that month's cashback — including who used the code — and the partner can also see the same details on their profile page.";

  return `How the code works
- Friends get 15% off their item subtotal (delivery and tax excluded from the discount).
- They must be registered with Earth Table and logged in.
- It only applies to their first order ever on the site, and the item subtotal must be at least $50 before discount, tax, and delivery.
- A referral code cannot be combined with a regular promo code.
- ${ownCode}

Cashback
- ${earn}
- ${invoiceLine}
- ${payoutSwitch}
- ${creditApply}`;
}

/**
 * Partner program welcome — sent to the new partner when admin assigns a code.
 */
function renderPartnerWelcomeEmail(partner = {}, user = {}) {
  const code = String(partner.referral_code || '').toUpperCase() || '—';
  const firstName = user.first_name || 'there';

  const subject = `You're an Earth Table partner — code ${code}`;

  const html = `
    <div style="font-family:Arial, sans-serif; max-width:600px; margin:0 auto; color:#111; line-height:1.5;">
      <h1 style="font-size:20px; margin:0 0 8px; color:#BE7200;">Welcome to the partner program</h1>
      <p style="margin:0 0 16px;">Hi ${firstName}, you've been set up as an Earth Table partner.</p>

      <div style="border:1px solid #EDA413; background:#FFFBF3; border-radius:12px; padding:12px; margin:0 0 16px;">
        <p style="margin:0 0 6px;"><strong>Your referral code:</strong> ${code}</p>
        <p style="margin:0;"><strong>Payout type:</strong> Cash (you can switch to store credit later from your partner wallet)</p>
      </div>

      ${partnerProgramRulesHtml()}

      <p style="margin:16px 0 0; color:#666; font-size:13px;">Questions? Reply to this email or write to hello@earthtableco.ca.</p>
    </div>
  `;

  const text = `Welcome to the Earth Table partner program

Hi ${firstName}, you've been set up as an Earth Table partner.

Your referral code: ${code}
Payout type: Cash (you can switch to store credit later from your partner wallet)

${partnerProgramRulesText()}

Questions? Reply to this email or write to hello@earthtableco.ca.
`;

  return { subject, html, text };
}

/**
 * Admin copy when a partner is created.
 */
function renderAdminPartnerWelcomeEmail(partner = {}, user = {}) {
  const code = String(partner.referral_code || '').toUpperCase() || '—';
  const email = user.email || '—';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';

  const subject = `New partner assigned — ${code}`;

  const html = `
    <div style="font-family:Arial, sans-serif; max-width:600px; margin:0 auto; color:#111; line-height:1.5;">
      <h1 style="font-size:20px; margin:0 0 8px; color:#BE7200;">New partner created</h1>
      <p style="margin:0 0 16px;">A registered user was assigned a referral code.</p>

      <div style="border:1px solid #EDA413; background:#FFFBF3; border-radius:12px; padding:12px; margin:0 0 16px;">
        <p style="margin:0 0 6px;"><strong>Code:</strong> ${code}</p>
        <p style="margin:0 0 6px;"><strong>Name:</strong> ${name}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> ${email}</p>
        <p style="margin:0;"><strong>Payout type:</strong> Cash (default)</p>
      </div>

      ${partnerProgramRulesHtml('admin')}
    </div>
  `;

  const text = `New partner created

Code: ${code}
Name: ${name}
Email: ${email}
Payout type: Cash (default)

${partnerProgramRulesText('admin')}
`;

  return { subject, html, text };
}

module.exports = {
  renderCustomerOrderEmail,
  formatMoney,
  renderOwnerOrderEmail,
  renderPartnerWelcomeEmail,
  renderAdminPartnerWelcomeEmail,
};

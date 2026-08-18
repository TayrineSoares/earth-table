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

const parseBuyerStripeInfo = (buyerStripeInfo) => {
  try {
    return typeof buyerStripeInfo === "string"
      ? JSON.parse(buyerStripeInfo)
      : buyerStripeInfo || {};
  } catch {
    return {};
  }
};

// STRICT: read fee_cents_server (pre-tax) from Stripe meta and compute tax-included
const getDeliveryFeeFromBuyerInfoStrict = (buyerStripeInfo) => {
  const parsed = parseBuyerStripeInfo(buyerStripeInfo);
  const preTax = Number(parsed?.delivery_meta?.fee_cents_server) || 0;
  const withTax = preTax > 0 ? Math.round(preTax * (1 + HST_RATE)) : 0;
  return { preTaxCents: preTax, withTaxCents: withTax };
};

function wrapEmail(inner) {
  return `<div style="font-family:Arial, sans-serif; max-width:600px; margin:0 auto; color:#111; line-height:1.5;">${inner}</div>`;
}

function h1(text) {
  return `<h1 style="font-size:20px; margin:0 0 8px; color:#BE7200;">${text}</h1>`;
}

function h2(text) {
  return `<h2 style="font-size:16px; margin:16px 0 8px; color:#333;">${text}</h2>`;
}

function card(inner) {
  return `<div style="border:1px solid #EDA413; background:#FFFBF3; border-radius:12px; padding:12px; margin:0 0 16px;">${inner}</div>`;
}

function rowHtml(label, value, last = false) {
  return `<p style="margin:0 0 ${last ? "0" : "6px"};"><strong>${label}:</strong> ${value}</p>`;
}

function getOrderDiscount(order = {}) {
  const parsed = parseBuyerStripeInfo(order.buyer_stripe_payment_info);
  const meta = parsed.discount_meta || {};
  const code = String(meta.code || order.referral_code || "").trim();
  if (!code) return null;

  const kind = meta.kind || (order.referral_code ? "referral" : "promo");
  const percent = Number(meta.percent);
  const itemSubtotalCents = Number(order.item_subtotal_cents) || 0;
  let amountOffCents = Number(meta.amount_off_cents);
  if (!Number.isFinite(amountOffCents) || amountOffCents < 0) {
    const pct = Number.isFinite(percent) ? percent : kind === "referral" ? 15 : 0;
    amountOffCents = Math.round(itemSubtotalCents * pct / 100);
  }

  return {
    kind,
    label: kind === "referral" ? "Referral" : "Promo",
    code: code.toUpperCase(),
    percent: Number.isFinite(percent) ? percent : kind === "referral" ? 15 : null,
    amountOffCents,
    itemSubtotalCents,
  };
}

function listItems(order) {
  return Array.isArray(order.products) ? order.products : [];
}

function itemsHtml(order) {
  return listItems(order)
    .map((p) => {
      const name = p.slug ?? p.name ?? "Item";
      const qty = p.quantity ?? 1;
      return `<li style="margin:2px 0;">${qty} × ${name} — ${formatMoney(p.unit_price_cents ?? 0)}</li>`;
    })
    .join("");
}

function itemsText(order) {
  const rows = listItems(order).map((p) => {
    const name = p.slug ?? p.name ?? "Item";
    const qty = p.quantity ?? 1;
    return `- ${qty}x ${name} @ ${formatMoney(p.unit_price_cents ?? 0)}`;
  });
  return rows.join("\n") || "(no items)";
}

function totalsParts(order = {}) {
  const discount = getOrderDiscount(order);
  const itemSubtotalCents = Number(order.item_subtotal_cents) || 0;
  const creditCents = Number(order.credit_applied_cents) || 0;
  return { discount, itemSubtotalCents, creditCents };
}

function renderTotalsHtml(order, {
  totalLabel = "Total",
  subtotalLabel,
  includeBreakdown = true,
  includeTotal = true,
} = {}) {
  const { discount, itemSubtotalCents, creditCents } = totalsParts(order);
  const lines = [];
  const subtotalText = subtotalLabel
    || (discount ? "Items subtotal (before discount)" : "Subtotal");
  if (includeBreakdown && itemSubtotalCents > 0) {
    lines.push(rowHtml(subtotalText, formatMoney(itemSubtotalCents)));
  }
  if (includeBreakdown && discount) {
    const pct = discount.percent != null ? ` — ${discount.percent}% off` : "";
    lines.push(rowHtml(
      `${discount.label} (${discount.code})${pct}`,
      `−${formatMoney(discount.amountOffCents)}`
    ));
  }
  if (includeBreakdown && creditCents > 0) {
    lines.push(rowHtml("Store credit", `−${formatMoney(creditCents)}`));
  }
  if (includeTotal) {
    lines.push(
      `<p style="margin:${includeBreakdown ? "8px 0 0" : "0"};"><strong>${totalLabel}:</strong> ${formatMoney(order.total_cents ?? 0)}</p>`
    );
  }
  return lines.join("\n");
}

function renderTotalsText(order, {
  totalLabel = "Total",
  subtotalLabel,
  includeBreakdown = true,
  includeTotal = true,
} = {}) {
  const { discount, itemSubtotalCents, creditCents } = totalsParts(order);
  const lines = [];
  const subtotalText = subtotalLabel
    || (discount ? "Items subtotal (before discount)" : "Subtotal");
  if (includeBreakdown && itemSubtotalCents > 0) {
    lines.push(`${subtotalText}: ${formatMoney(itemSubtotalCents)}`);
  }
  if (includeBreakdown && discount) {
    const pct = discount.percent != null ? ` (${discount.percent}% off)` : "";
    lines.push(`${discount.label} (${discount.code})${pct}: -${formatMoney(discount.amountOffCents)}`);
  }
  if (includeBreakdown && creditCents > 0) {
    lines.push(`Store credit: -${formatMoney(creditCents)}`);
  }
  if (includeTotal) {
    lines.push(`${totalLabel}: ${formatMoney(order.total_cents ?? 0)}`);
  }
  return lines.join("\n");
}

function mutedHtml(text) {
  return `<p style="margin:0 0 6px; font-size:12px; color:#888;">${text}</p>`;
}

function deliveryFeeLine(order) {
  const { preTaxCents, withTaxCents } = getDeliveryFeeFromBuyerInfoStrict(
    order.buyer_stripe_payment_info
  );
  if (preTaxCents <= 0) return { html: "", text: "" };
  const value = `${formatMoney(preTaxCents)} + HST (13%): = ${formatMoney(withTaxCents)} Total`;
  return {
    html: rowHtml("Delivery Fee", value),
    text: `Delivery Fee: ${value}`,
  };
}

function fulfillmentHtml(order) {
  const note = (order.special_note || "").trim();
  if (order.delivery === true) {
    const postal = getPostalFromBuyerInfo(order.buyer_stripe_payment_info);
    const date = order.delivery_date_formatted ?? "—";
    const fee = deliveryFeeLine(order);
    return `
      ${h2("Delivery")}
      ${rowHtml("Delivery Date & Time", `${date}, between 11:00 AM – 6:00 PM`)}
      ${fee.html}
      ${mutedHtml(`Delivery Postal Code (used for Quote) ${postal}`)}
      <p style="margin:8px 0 4px;"><strong>Full Address and Special Instructions:</strong></p>
      <blockquote style="margin:8px 0 0; padding-left:12px; border-left:3px solid #ddd;">${nl2br(note || "—")}</blockquote>
    `;
  }
  const date = order.pickup_date_formatted ?? "—";
  const time = order.pickup_time_slot ?? "—";
  return `
    ${h2("Pickup")}
    ${rowHtml("Pickup Date & Time", `${date}, between ${time}`)}
    ${rowHtml("Pickup Address", "77 Woodstream Blvd, Vaughan, ON L4L 7Y7", !note)}
    ${note ? rowHtml("Special Instructions", nl2br(note), true) : ""}
  `;
}

function fulfillmentText(order) {
  const note = (order.special_note || "").trim();
  if (order.delivery === true) {
    const postal = getPostalFromBuyerInfo(order.buyer_stripe_payment_info);
    const date = order.delivery_date_formatted ?? "—";
    const fee = deliveryFeeLine(order);
    return `Delivery
Delivery Date & Time: ${date}, between 11:00 AM – 6:00 PM
${fee.text ? `${fee.text}\n` : ""}Delivery Postal Code (used for Quote) ${postal}

Full Address and Special Instructions:
${note || "—"}`;
  }
  const date = order.pickup_date_formatted ?? "—";
  const time = order.pickup_time_slot ?? "—";
  return `Pickup
Pickup Date & Time: ${date}, between ${time}
Pickup Address: 77 Woodstream Blvd, Vaughan, ON L4L 7Y7${note ? `\nSpecial Instructions: ${note}` : ""}`;
}

/**
 * Customer order confirmation email
 */
function renderCustomerOrderEmail(detailedOrder = {}) {
  const id = detailedOrder.id ?? "N/A";
  const status = detailedOrder.status ?? "processing";
  const subject = `Order Confirmation #${id} — Earth Table`;

  const html = wrapEmail(`
      ${h1("Thank you for your order!")}
      <p style="margin:0 0 16px;">We've received your order and it's being prepared.</p>
      ${card(`
        ${rowHtml("Order ID", id)}
        ${rowHtml("Status", status)}
        ${rowHtml("Total", formatMoney(detailedOrder.total_cents ?? 0), true)}
      `)}

      ${h2("Items")}
      <ul style="margin:0 0 12px; padding-left:18px;">${itemsHtml(detailedOrder)}</ul>

      ${(getOrderDiscount(detailedOrder) || Number(detailedOrder.credit_applied_cents) > 0)
        ? renderTotalsHtml(detailedOrder, { includeTotal: false })
        : ""}

      ${fulfillmentHtml(detailedOrder)}

      <p style="margin:16px 0 0;">Earth Table Team 🧡</p>
      <hr style="border:none; border-top:1px solid #eee; margin:16px 0 12px;" />
      <p style="margin:8px 0 0; font-size:12px; color:#666;">
        Questions? Email <a href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a>.
      </p>
      <p style="margin:4px 0 0; font-size:12px; color:#666;">Please do not reply to this email.</p>
  `);

  const text = `Thank you for your order!

Order ID: ${id}
Status: ${status}
Total: ${formatMoney(detailedOrder.total_cents ?? 0)}

Items
${itemsText(detailedOrder)}
${(getOrderDiscount(detailedOrder) || Number(detailedOrder.credit_applied_cents) > 0)
  ? `\n${renderTotalsText(detailedOrder, { includeTotal: false })}\n`
  : "\n"}

${fulfillmentText(detailedOrder)}

Earth Table Team
Questions? hello@earthtableco.ca
Please do not reply to this email.`;

  return { subject, html, text };
}

function partnerFirstName(partnerEarn) {
  const name = partnerEarn?.name || "Partner";
  return (partnerEarn?.first_name || name.split(" ")[0] || "Partner").trim();
}

function partnerEarnHtml(partnerEarn) {
  if (!partnerEarn) return "";
  const name = partnerEarn.name || "Partner";
  const first = partnerFirstName(partnerEarn);
  return `
      ${h2("Partner cashback")}
      ${card(`
        ${rowHtml("Partner", name)}
        ${rowHtml("Code", partnerEarn.code || "—")}
        ${rowHtml("Items subtotal (before discount)", formatMoney(partnerEarn.item_subtotal_cents))}
        ${rowHtml(`${first} cashback`, formatMoney(partnerEarn.cashback_cents), true)}
      `)}
  `;
}

function partnerEarnText(partnerEarn) {
  if (!partnerEarn) return "";
  const name = partnerEarn.name || "Partner";
  const first = partnerFirstName(partnerEarn);
  return `
Partner cashback
Partner: ${name}
Code: ${partnerEarn.code || "—"}
Items subtotal (before discount): ${formatMoney(partnerEarn.item_subtotal_cents)}
${first} cashback: ${formatMoney(partnerEarn.cashback_cents)}
`;
}

/**
 * Owner/manager notification email
 */
function renderOwnerOrderEmail(detailedOrder = {}, extras = {}) {
  const id = detailedOrder.id ?? "N/A";
  const status = detailedOrder.status ?? "processing";
  const buyerEmail = detailedOrder.buyer_email ?? "—";
  const buyerName = detailedOrder.buyer_name ?? "—";
  const buyerPhone = detailedOrder.buyer_phone_number ?? "—";
  const partnerEarn = extras.partnerEarn || detailedOrder.partnerEarn || null;
  const subject = `🛒 New order #${id} — Earth Table`;

  const html = wrapEmail(`
      ${h1("New order received!")}
      ${card(`
        ${rowHtml("Buyer Name", buyerName)}
        ${rowHtml("Email", buyerEmail)}
        ${rowHtml("Phone", buyerPhone)}
        ${rowHtml("Order ID", id)}
        ${rowHtml("Status", status)}
        ${rowHtml("Total", formatMoney(detailedOrder.total_cents ?? 0), true)}
      `)}

      ${h2("Items")}
      <ul style="margin:0 0 12px; padding-left:18px;">${itemsHtml(detailedOrder)}</ul>

      ${renderTotalsHtml(detailedOrder, {
        subtotalLabel: "Subtotal",
        totalLabel: "Total (including tax)",
      })}

      ${fulfillmentHtml(detailedOrder)}

      ${partnerEarnHtml(partnerEarn)}
  `);

  const text = `New order received!

Buyer Name: ${buyerName}
Email: ${buyerEmail}
Phone: ${buyerPhone}
Order ID: ${id}
Status: ${status}
Total: ${formatMoney(detailedOrder.total_cents ?? 0)}

Items
${itemsText(detailedOrder)}

${renderTotalsText(detailedOrder, {
  subtotalLabel: "Subtotal",
  totalLabel: "Total (including tax)",
})}

${fulfillmentText(detailedOrder)}
${partnerEarnText(partnerEarn)}`;

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
      ? 'Default payout is <strong>cash</strong>, paid by Earth Table outside the site. You can switch to <strong>store credit</strong> (or back) anytime from your <strong>partner wallet</strong>. Each order keeps whatever payout type was active when that order was placed.'
      : 'Default payout is <strong>cash</strong>, paid by Earth Table outside the site. The partner can switch to <strong>store credit</strong> (or back) anytime from their partner wallet. Each order keeps whatever payout type was active when that order was placed.';
  const invoiceLine =
    audience === 'partner'
      ? "Cashback starts as <strong>pending</strong>. On the 1st of each month, the previous month's invoice closes. You'll get an email showing <strong>cash</strong> and <strong>store credit</strong> totals separately — including who used your code. Store credit is added to your wallet automatically; cash can be marked paid after the invoice is sent."
      : "Cashback starts as pending. On the 1st of each month, the previous month's invoice closes. The partner (and admin) get an email showing cash and store credit totals separately — including who used the code. Store credit is added to the wallet automatically; cash can be marked paid after the invoice is sent.";

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
      ? 'Default payout is cash, paid by Earth Table outside the site. You can switch to store credit (or back) anytime from your partner wallet. Each order keeps whatever payout type was active when that order was placed.'
      : 'Default payout is cash, paid by Earth Table outside the site. The partner can switch to store credit (or back) anytime from their partner wallet. Each order keeps whatever payout type was active when that order was placed.';
  const invoiceLine =
    audience === 'partner'
      ? "Cashback starts as pending. On the 1st of each month, the previous month's invoice closes. You'll get an email showing cash and store credit totals separately — including who used your code. Store credit is added to your wallet automatically; cash can be marked paid after the invoice is sent."
      : "Cashback starts as pending. On the 1st of each month, the previous month's invoice closes. The partner (and admin) get an email showing cash and store credit totals separately — including who used the code. Store credit is added to the wallet automatically; cash can be marked paid after the invoice is sent.";

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
        <p style="margin:0;"><strong>Payout type:</strong> Cash (default). Switch to store credit anytime from your partner wallet — new orders use whatever you have selected.</p>
      </div>

      ${partnerProgramRulesHtml()}

      <p style="margin:16px 0 0; color:#666; font-size:13px;">Questions? Reply to this email or write to hello@earthtableco.ca.</p>
    </div>
  `;

  const text = `Welcome to the Earth Table partner program

Hi ${firstName}, you've been set up as an Earth Table partner.

Your referral code: ${code}
Payout type: Cash (default). Switch to store credit anytime from your partner wallet — new orders use whatever you have selected.

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
        <p style="margin:0;"><strong>Payout type:</strong> Cash (default). They can switch to store credit anytime from their partner wallet.</p>
      </div>

      ${partnerProgramRulesHtml('admin')}
    </div>
  `;

  const text = `New partner created

Code: ${code}
Name: ${name}
Email: ${email}
Payout type: Cash (default). They can switch to store credit anytime from their partner wallet.

${partnerProgramRulesText('admin')}
`;

  return { subject, html, text };
}

/**
 * Notify a partner that their referral code was used on an order.
 */
function renderPartnerCodeUsedEmail({
  partner = {},
  partnerUser = {},
  order = {},
  earn = {},
} = {}) {
  const code = String(partner.referral_code || order.referral_code || "").toUpperCase() || "—";
  const firstName = partnerUser.first_name || "there";
  const orderId = order.id ?? "N/A";
  const buyerName = order.buyer_name || "—";

  const subject = `Your code ${code} was used — Earth Table`;

  const payoutLabel = earn.payout_type === 'credit' ? 'Store credit' : 'Cash';

  const html = wrapEmail(`
      ${h1("Your referral code was used")}
      <p style="margin:0 0 16px;">Hi ${firstName}, someone just placed an order with your code <strong>${code}</strong>.</p>

      ${card(`
        ${rowHtml("Order ID", orderId)}
        ${rowHtml("Customer Name", buyerName)}
        ${rowHtml("Items subtotal (before discount)", formatMoney(order.item_subtotal_cents))}
        ${rowHtml("Your cashback", formatMoney(earn.amount_cents), true)}
        ${rowHtml("Recorded as", payoutLabel)}
      `)}
  `);

  const text = `Your referral code was used
Hi ${firstName}, someone just placed an order with your code ${code}.

Order ID: ${orderId}
Customer Name: ${buyerName}
Items subtotal (before discount): ${formatMoney(order.item_subtotal_cents)}
Your cashback: ${formatMoney(earn.amount_cents)}
Recorded as: ${payoutLabel}
`;

  return { subject, html, text };
}

module.exports = {
  renderCustomerOrderEmail,
  formatMoney,
  renderOwnerOrderEmail,
  renderPartnerWelcomeEmail,
  renderAdminPartnerWelcomeEmail,
  renderPartnerCodeUsedEmail,
};

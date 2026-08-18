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

const parseBuyerStripeInfo = (buyerStripeInfo) => {
  try {
    return typeof buyerStripeInfo === "string"
      ? JSON.parse(buyerStripeInfo)
      : buyerStripeInfo || {};
  } catch {
    return {};
  }
};

const getPostalFromBuyerInfo = (buyerStripeInfo) => {
  return parseBuyerStripeInfo(buyerStripeInfo)?.delivery_meta?.postal_code || "—";
};

function namesMatch(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function customerNamesFromOrder(order = {}) {
  const user = order.user || {};
  const account = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const stripe = parseBuyerStripeInfo(order.buyer_stripe_payment_info);
  const card = String(
    order.cardholder_name || stripe.customer_name || order.buyer_name || ""
  ).trim();
  return {
    customerName: account || card || "—",
    cardholderName: account && card && !namesMatch(account, card) ? card : "",
  };
}

// STRICT: read fee_cents_server (pre-tax) from Stripe meta and compute tax-included
const getDeliveryFeeFromBuyerInfoStrict = (buyerStripeInfo) => {
  const parsed = parseBuyerStripeInfo(buyerStripeInfo);
  const preTax = Number(parsed?.delivery_meta?.fee_cents_server) || 0;
  const withTax = preTax > 0 ? Math.round(preTax * (1 + HST_RATE)) : 0;
  return { preTaxCents: preTax, withTaxCents: withTax };
};

// ---------------------------------------------------------------------------
// HTML email chrome (table layout, inline styles only — Outlook/Gmail safe)
// ---------------------------------------------------------------------------
const FONT = "Arial, Helvetica, sans-serif";
const C_AMBER = "#BE7200";
const C_AMBER_LIGHT = "#EDA413";
const C_CREAM = "#FFFBF3";
const C_INK = "#1A1A1A";
const C_MUTED = "#6B6258";
const C_PAGE = "#F4F1EA";
const C_LINE = "#EEDCC0";
const C_WHITE = "#FFFFFF";

// Stacked lockup (high-logo-2.png). Embedded inline via cid:earth-table-logo
// from backend/assets/email/high-logo-2.png so it renders without a public URL.
// Optional override: set EMAIL_LOGO_URL to a public https image.
const LOGO_URL = process.env.EMAIL_LOGO_URL || 'cid:earth-table-logo';

function spacer(px = 24) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td style="height:${px}px; line-height:${px}px; font-size:1px;">&nbsp;</td></tr></table>`;
}

function wrapEmail(inner, { preheader, replyOk } = {}) {
  const footerCopy = replyOk
    ? `Questions? Reply to this email or write to <a href="mailto:hello@earthtableco.ca" style="color:${C_AMBER}; text-decoration:underline;">hello@earthtableco.ca</a>.`
    : `Questions? Email <a href="mailto:hello@earthtableco.ca" style="color:${C_AMBER}; text-decoration:underline;">hello@earthtableco.ca</a>. Please do not reply to this email.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Earth Table</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    td, p, a, h1, h2, li { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:${C_PAGE};">
  ${preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:${C_PAGE};">${preheader}</div>`
    : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C_PAGE};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;">
          <tr>
            <td align="center" bgcolor="${C_WHITE}" style="padding:32px 24px 24px; background-color:${C_WHITE};">
              <img src="${LOGO_URL}" width="140" alt="Earth Table Co" style="display:block; margin:0 auto; width:140px; max-width:140px; height:auto; border:0; outline:none; text-decoration:none;">
            </td>
          </tr>
          <tr>
            <td bgcolor="${C_AMBER}" style="height:4px; line-height:4px; font-size:1px; background-color:${C_AMBER};">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${C_AMBER_LIGHT}" style="height:2px; line-height:2px; font-size:1px; background-color:${C_AMBER_LIGHT};">&nbsp;</td>
          </tr>
          <tr>
            <td bgcolor="${C_WHITE}" style="padding:32px 28px 8px; background-color:${C_WHITE}; font-family:${FONT}; color:${C_INK};">
              ${inner}
            </td>
          </tr>
          <tr>
            <td bgcolor="${C_CREAM}" style="padding:22px 28px 28px; background-color:${C_CREAM}; font-family:${FONT};">
              <p style="margin:0 0 6px; font-size:13px; line-height:1.5; color:${C_INK}; font-family:${FONT};">Earth Table Co</p>
              <p style="margin:0; font-size:12px; line-height:1.5; color:${C_MUTED}; font-family:${FONT};">${footerCopy}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function eyebrow(text) {
  return `<p style="margin:0 0 8px; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:${C_AMBER}; font-weight:700; font-family:${FONT};">${text}</p>`;
}

function h1(text) {
  return `<h1 style="margin:0 0 10px; font-size:24px; line-height:1.25; color:${C_INK}; font-weight:700; font-family:${FONT};">${text}</h1>`;
}

function h2(text) {
  return `<h2 style="margin:0 0 12px; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:${C_AMBER}; font-weight:700; font-family:${FONT};">${text}</h2>`;
}

function intro(text) {
  return `<p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">${text}</p>`;
}

function card(inner) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
    <tr>
      <td bgcolor="${C_CREAM}" style="background-color:${C_CREAM}; border:1px solid ${C_LINE}; padding:18px 20px; font-family:${FONT};">
        ${inner}
      </td>
    </tr>
  </table>
  ${spacer(24)}`;
}

function kvTable(inner) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">${inner}</table>`;
}

function kvRow(label, value, { last = false, highlight = false } = {}) {
  const border = last ? "none" : `1px solid ${C_LINE}`;
  const labelColor = highlight ? C_AMBER : C_MUTED;
  const valueColor = highlight ? C_AMBER : C_INK;
  const valueSize = highlight ? "16px" : "14px";
  const weight = highlight ? 700 : 600;
  const pad = highlight ? "12px" : "10px";
  return `<tr>
    <td style="padding:${pad} 12px ${pad} 0; border-bottom:${border}; font-size:14px; line-height:1.4; color:${labelColor}; font-weight:${highlight ? 700 : 400}; font-family:${FONT}; vertical-align:top;">${label}</td>
    <td style="padding:${pad} 0; border-bottom:${border}; font-size:${valueSize}; line-height:1.4; color:${valueColor}; font-weight:${weight}; font-family:${FONT}; text-align:right; vertical-align:top;">${value}</td>
  </tr>`;
}

function rowHtml(label, value, last = false) {
  return kvRow(label, value, { last });
}

function highlightRowHtml(label, value, last = false) {
  return kvRow(label, value, { last, highlight: true });
}

function heroBanner(label, amount, note = "") {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
    <tr>
      <td bgcolor="${C_AMBER}" style="background-color:${C_AMBER}; padding:22px 24px;">
        <p style="margin:0 0 6px; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:${C_CREAM}; font-family:${FONT};">${label}</p>
        <p style="margin:0; font-size:32px; line-height:1.15; font-weight:700; color:${C_CREAM}; font-family:${FONT};">${amount}</p>
        ${note
          ? `<p style="margin:12px 0 0; font-size:13px; line-height:1.45; color:${C_CREAM}; font-family:${FONT};">${note}</p>`
          : ""}
      </td>
    </tr>
  </table>
  ${spacer(24)}`;
}

function payoutBreakdownLabels(audience = "admin") {
  const admin = audience === "admin";
  return {
    earnings: "Total earnings",
    credit: admin
      ? "Total store credit (already applied)"
      : "Total store credit (already in your wallet)",
    pay: admin ? "Amount to pay" : "Amount you will be paid (cash)",
    payText: admin ? "AMOUNT TO PAY (cash only)" : "AMOUNT YOU WILL BE PAID (cash)",
  };
}

function payoutBreakdownHtml({ cash, credit, total, audience = "admin" }) {
  const labels = payoutBreakdownLabels(audience);
  return kvTable(`
        ${rowHtml(labels.earnings, formatMoney(total))}
        ${rowHtml(labels.credit, formatMoney(credit))}
        ${highlightRowHtml("Total cash", formatMoney(cash))}
        ${highlightRowHtml(labels.pay, formatMoney(cash), true)}
  `);
}

function payoutBreakdownText({ cash, credit, total, audience = "admin" }) {
  const labels = payoutBreakdownLabels(audience);
  return `${labels.earnings}: ${formatMoney(total)}
${labels.credit}: ${formatMoney(credit)}
Total cash: ${formatMoney(cash)}
${labels.payText}: ${formatMoney(cash)}`;
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

function itemParts(p) {
  return {
    name: p.slug ?? p.name ?? "Item",
    qty: p.quantity ?? 1,
    price: formatMoney(p.unit_price_cents ?? 0),
  };
}

function itemsHtml(order) {
  const rows = listItems(order)
    .map((p) => {
      const { name, qty, price } = itemParts(p);
      return rowHtml(`${qty} × ${name}`, price);
    })
    .join("");
  return kvTable(rows || rowHtml("Items", "—", true));
}

function itemsText(order) {
  const rows = listItems(order).map((p) => {
    const { name, qty, price } = itemParts(p);
    return `- ${qty}x ${name} @ ${price}`;
  });
  return rows.join("\n") || "(no items)";
}

function hasOrderBreakdown(order) {
  return !!(getOrderDiscount(order) || Number(order.credit_applied_cents) > 0);
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
    lines.push(highlightRowHtml(totalLabel, formatMoney(order.total_cents ?? 0), true));
  }
  if (!lines.length) return "";
  return kvTable(lines.join("\n"));
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
  return `<p style="margin:8px 0 0; font-size:12px; line-height:1.45; color:${C_MUTED}; font-family:${FONT};">${text}</p>`;
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
      ${card(`
        ${kvTable(`
          ${rowHtml("Delivery Date & Time", `${date}, between 11:00 AM – 6:00 PM`)}
          ${fee.html}
          ${rowHtml("Delivery postal (quote)", postal, !note)}
        `)}
        ${note
          ? `<p style="margin:14px 0 6px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:${C_AMBER}; font-weight:700; font-family:${FONT};">Address &amp; instructions</p>
             <p style="margin:0; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${nl2br(note)}</p>`
          : mutedHtml("No special instructions.")}
      `)}
    `;
  }
  const date = order.pickup_date_formatted ?? "—";
  const time = order.pickup_time_slot ?? "—";
  return `
    ${h2("Pickup")}
    ${card(kvTable(`
      ${rowHtml("Pickup Date & Time", `${date}, between ${time}`)}
      ${rowHtml("Pickup Address", "77 Woodstream Blvd, Vaughan, ON L4L 7Y7", !note)}
      ${note ? rowHtml("Special Instructions", nl2br(note), true) : ""}
    `))}
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
  const hasBreakdown = hasOrderBreakdown(detailedOrder);

  const html = wrapEmail(`
      ${eyebrow("Order confirmation")}
      ${h1("Thank you for your order")}
      ${intro("We've received your order and it's being prepared.")}
      ${heroBanner("Total", formatMoney(detailedOrder.total_cents ?? 0), `Order #${id} · ${status}`)}
      ${h2("Order details")}
      ${card(kvTable(`
        ${rowHtml("Order ID", id)}
        ${rowHtml("Status", status, true)}
      `))}
      ${h2("Items")}
      ${card(itemsHtml(detailedOrder))}
      ${hasBreakdown
        ? `${h2("Pricing")}${card(renderTotalsHtml(detailedOrder, { includeTotal: false }))}`
        : ""}
      ${fulfillmentHtml(detailedOrder)}
  `, { preheader: `Order #${id} · ${formatMoney(detailedOrder.total_cents ?? 0)}` });

  const text = `Thank you for your order!

Order ID: ${id}
Status: ${status}
Total: ${formatMoney(detailedOrder.total_cents ?? 0)}

Items
${itemsText(detailedOrder)}
${hasBreakdown
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
      ${card(kvTable(`
        ${rowHtml("Partner", name)}
        ${rowHtml("Code", partnerEarn.code || "—")}
        ${rowHtml("Items subtotal (before discount)", formatMoney(partnerEarn.item_subtotal_cents))}
        ${highlightRowHtml(`${first} cashback`, formatMoney(partnerEarn.cashback_cents), true)}
      `))}
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
  const { customerName, cardholderName } = customerNamesFromOrder(detailedOrder);
  const buyerPhone = detailedOrder.buyer_phone_number ?? "—";
  const partnerEarn = extras.partnerEarn || detailedOrder.partnerEarn || null;
  const subject = `🛒 New order #${id} — Earth Table`;

  const html = wrapEmail(`
      ${eyebrow("New order")}
      ${h1("New order received")}
      ${intro(`Order #${id} is in and ready to review.`)}
      ${heroBanner("Total", formatMoney(detailedOrder.total_cents ?? 0), `Order #${id} · ${status}`)}
      ${h2("Customer")}
      ${card(kvTable(`
        ${rowHtml("Customer", customerName)}
        ${cardholderName ? rowHtml("Cardholder", cardholderName) : ""}
        ${rowHtml("Email", buyerEmail)}
        ${rowHtml("Phone", buyerPhone)}
        ${rowHtml("Order ID", id)}
        ${rowHtml("Status", status, true)}
      `))}
      ${h2("Items")}
      ${card(itemsHtml(detailedOrder))}
      ${h2("Totals")}
      ${card(renderTotalsHtml(detailedOrder, {
        subtotalLabel: "Subtotal",
        totalLabel: "Total (including tax)",
      }))}
      ${fulfillmentHtml(detailedOrder)}
      ${partnerEarnHtml(partnerEarn)}
  `, { preheader: `New order #${id} · ${formatMoney(detailedOrder.total_cents ?? 0)}` });

  const text = `New order received!

Customer: ${customerName}${cardholderName ? `\nCardholder: ${cardholderName}` : ""}
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

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, "");
}

function partnerProgramRuleLists(audience = "partner") {
  const isPartner = audience === "partner";
  return {
    how: [
      "Friends get <strong>15% off</strong> their item subtotal (delivery and tax excluded from the discount).",
      "They must be registered with Earth Table and logged in.",
      "It only applies to their <strong>first order ever</strong> on the site, and the item subtotal must be at least <strong>$50</strong> before discount, tax, and delivery.",
      "A referral code cannot be combined with a regular promo code.",
      isPartner
        ? "<strong>You cannot use your own referral code</strong> on your own orders."
        : "The partner <strong>cannot use their own referral code</strong> on their own orders.",
    ],
    cashback: [
      isPartner
        ? "You earn <strong>10% of the pre-discount item subtotal</strong> (not the discounted amount, not delivery, not tax) on orders that use your code."
        : "The partner earns <strong>10% of the pre-discount item subtotal</strong> (not the discounted amount, not delivery, not tax) on orders that use their code.",
      isPartner
        ? "Cashback starts as <strong>pending</strong>. On the 1st of each month, the previous month's invoice closes. You'll get an email showing <strong>cash</strong> and <strong>store credit</strong> totals separately — including who used your code. Store credit is added to your wallet automatically; cash can be marked paid after the invoice is sent."
        : "Cashback starts as pending. On the 1st of each month, the previous month's invoice closes. The partner (and admin) get an email showing cash and store credit totals separately — including who used the code. Store credit is added to the wallet automatically; cash can be marked paid after the invoice is sent.",
      isPartner
        ? "Default payout is <strong>cash</strong>, paid by Earth Table outside the site. You can switch to <strong>store credit</strong> (or back) anytime from your <strong>partner wallet</strong>. Each order keeps whatever payout type was active when that order was placed."
        : "Default payout is <strong>cash</strong>, paid by Earth Table outside the site. The partner can switch to <strong>store credit</strong> (or back) anytime from their partner wallet. Each order keeps whatever payout type was active when that order was placed.",
      isPartner
        ? "Store credit never expires and auto-applies at your own checkout."
        : "Store credit never expires and auto-applies at the partner's own checkout.",
    ],
  };
}

function ruleListHtml(items) {
  const li = `margin:0 0 10px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};`;
  return card(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 0 4px;">
          <ul style="margin:0; padding-left:18px;">
            ${items.map((item, i) => `<li style="${li}${i === items.length - 1 ? " margin:0;" : ""}">${item}</li>`).join("")}
          </ul>
        </td></tr></table>
      `);
}

function partnerProgramRulesHtml(audience = "partner") {
  const { how, cashback } = partnerProgramRuleLists(audience);
  return `
      ${h2("How the code works")}
      ${ruleListHtml(how)}
      ${h2("Cashback")}
      ${ruleListHtml(cashback)}
  `;
}

function partnerProgramRulesText(audience = "partner") {
  const { how, cashback } = partnerProgramRuleLists(audience);
  return `How the code works
${how.map((item) => `- ${stripHtml(item)}`).join("\n")}

Cashback
${cashback.map((item) => `- ${stripHtml(item)}`).join("\n")}`;
}

/**
 * Partner program welcome — sent to the new partner when admin assigns a code.
 */
function renderPartnerWelcomeEmail(partner = {}, user = {}) {
  const code = String(partner.referral_code || '').toUpperCase() || '—';
  const firstName = user.first_name || 'there';

  const subject = `You're an Earth Table partner — code ${code}`;

  const html = wrapEmail(`
      ${eyebrow("Partner program")}
      ${h1("Welcome to the partner program")}
      ${intro(`Hi ${firstName}, you've been set up as an Earth Table partner.`)}
      ${heroBanner("Your referral code", code, "Share this with friends. They get 15% off their first $50+ order.")}
      ${h2("Payout")}
      ${card(kvTable(`
        ${rowHtml("Payout type", "Cash (default)", true)}
      `))}
      <p style="margin:0 0 24px; font-size:14px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">Switch to store credit anytime from your partner wallet — new orders use whatever you have selected.</p>
      ${partnerProgramRulesHtml()}
  `, {
    preheader: `Your Earth Table referral code is ${code}`,
    replyOk: true,
  });

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
  const phone = user.phone_number || '—';

  const subject = `New partner assigned — ${code}`;

  const html = wrapEmail(`
      ${eyebrow("Admin")}
      ${h1("New partner created")}
      ${intro("A registered user was assigned a referral code.")}
      ${heroBanner("Referral code", code)}
      ${h2("Partner")}
      ${card(kvTable(`
        ${rowHtml("Name", name)}
        ${rowHtml("Email", email)}
        ${rowHtml("Phone", phone)}
        ${rowHtml("Payout type", "Cash (default)", true)}
      `))}
      <p style="margin:0 0 24px; font-size:14px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">They can switch to store credit anytime from their partner wallet.</p>
      ${partnerProgramRulesHtml('admin')}
  `, { preheader: `New partner ${code} · ${name}` });

  const text = `New partner created

Code: ${code}
Name: ${name}
Email: ${email}
Phone: ${phone}
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
  const { customerName, cardholderName } = customerNamesFromOrder(order);

  const subject = `Your code ${code} was used — Earth Table`;

  const payoutLabel = earn.payout_type === 'credit' ? 'Store credit' : 'Cash';

  const html = wrapEmail(`
      ${eyebrow("Referral")}
      ${h1("Your referral code was used")}
      ${intro(`Hi ${firstName}, someone just placed an order with your code <strong style="color:${C_INK};">${code}</strong>.`)}
      ${heroBanner("Your cashback", formatMoney(earn.amount_cents), `Recorded as ${payoutLabel}`)}
      ${h2("Order")}
      ${card(kvTable(`
        ${rowHtml("Order ID", orderId)}
        ${rowHtml("Customer Name", customerName)}
        ${cardholderName ? rowHtml("Cardholder", cardholderName) : ""}
        ${rowHtml("Items subtotal (before discount)", formatMoney(order.item_subtotal_cents), true)}
      `))}
  `, {
    preheader: `${code} earned ${formatMoney(earn.amount_cents)}`,
    replyOk: true,
  });

  const text = `Your referral code was used
Hi ${firstName}, someone just placed an order with your code ${code}.

Order ID: ${orderId}
Customer Name: ${customerName}${cardholderName ? `\nCardholder: ${cardholderName}` : ""}
Items subtotal (before discount): ${formatMoney(order.item_subtotal_cents)}
Your cashback: ${formatMoney(earn.amount_cents)}
Recorded as: ${payoutLabel}
`;

  return { subject, html, text };
}

function formatOrderDateShort(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function payoutTypeLabel(type) {
  return type === 'credit' ? 'Store credit' : 'Cash';
}

function invoiceOrderLines(orders = []) {
  return (orders || []).map((order) => {
    const date = formatOrderDateShort(order.order_date);
    const customer = order.customer_name || '—';
    const card = order.cardholder_name ? ` (card: ${order.cardholder_name})` : '';
    const cashback = formatMoney(order.amount_cents);
    const method = order.payout_type ? payoutTypeLabel(order.payout_type) : '—';
    return `${date} — ${customer}${card} — ${cashback} (${method})`;
  });
}

function invoiceOrdersHtml(orders = []) {
  const lines = invoiceOrderLines(orders);
  if (!lines.length) {
    return `<p style="margin:0 0 16px; font-size:14px; line-height:1.5; color:${C_MUTED}; font-family:${FONT};">No referred orders this period.</p>`;
  }
  const rows = lines.map((line, idx) => {
    const last = idx === lines.length - 1;
    return `<tr>
      <td style="padding:10px 0; border-bottom:${last ? "none" : `1px solid ${C_LINE}`}; font-size:14px; line-height:1.45; color:${C_INK}; font-family:${FONT};">${line}</td>
    </tr>`;
  }).join("");
  return `${card(kvTable(rows))}`;
}

/**
 * Monthly statement for the partner after month-end close.
 */
function renderPartnerMonthlyInvoiceEmail({
  invoice = {},
  partner = {},
  user = {},
  periodLabel = '',
  orders = [],
} = {}) {
  const firstName = user.first_name || 'there';
  const code = String(partner.referral_code || '').toUpperCase() || '—';
  const cash = Number(invoice.cash_cents) || 0;
  const credit = Number(invoice.credit_cents) || 0;
  const total = Number(invoice.total_cents) || cash + credit;
  const lines = invoiceOrderLines(orders);

  const subject = `Your Earth Table partner statement — ${periodLabel}`;

  const payNoteText = credit > 0
    ? 'Store credit is already in your wallet.\nYou can download a PDF or see the invoice on your profile page.'
    : 'You can download a PDF or see the invoice on your profile page.';
  const payNote = payNoteText.replace(/\n/g, '<br/>');

  const html = wrapEmail(`
      ${eyebrow("Partner statement")}
      ${h1("Your partner statement is ready")}
      ${intro(`Hi ${firstName}, ${periodLabel} is closed. Here's the cashback from orders that used <strong style="color:${C_INK};">${code}</strong>.`)}
      ${heroBanner('Amount you will be paid (cash only)', formatMoney(cash), payNote)}
      ${h2("Summary")}
      ${card(`
        ${kvTable(`
          ${rowHtml('Period', periodLabel)}
          ${rowHtml('Referral code', code, true)}
        `)}
        ${spacer(8)}
        ${payoutBreakdownHtml({ cash, credit, total, audience: 'partner' })}
      `)}
      ${h2('Referred orders')}
      ${invoiceOrdersHtml(orders)}
      <p style="margin:0 0 8px; font-size:14px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">Store credit auto-applies on your next order. Cash is paid by Earth Table outside the site.</p>
  `, {
    preheader: `${periodLabel}: ${formatMoney(cash)} cash to be paid`,
    replyOk: true,
  });

  const text = `Your partner statement is ready
Hi ${firstName}, ${periodLabel} is closed. Here's the cashback from orders that used ${code}.

AMOUNT YOU WILL BE PAID (cash only): ${formatMoney(cash)}
${payNoteText}

Period: ${periodLabel}
Referral code: ${code}
${payoutBreakdownText({ cash, credit, total, audience: 'partner' })}

Referred orders
${lines.length ? lines.map((line) => `- ${line}`).join('\n') : '- None'}

Store credit auto-applies on your next order. Cash is paid by Earth Table outside the site.

Questions? Reply to this email or write to hello@earthtableco.ca.
`;

  return { subject, html, text };
}

/**
 * Admin copy of the monthly partner statement.
 */
function renderAdminMonthlyInvoiceEmail({
  invoice = {},
  partner = {},
  user = {},
  periodLabel = '',
  orders = [],
} = {}) {
  const code = String(partner.referral_code || '').toUpperCase() || '—';
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
  const email = user.email || '—';
  const cash = Number(invoice.cash_cents) || 0;
  const credit = Number(invoice.credit_cents) || 0;
  const total = Number(invoice.total_cents) || cash + credit;
  const status = cash > 0 ? 'Unpaid (cash)' : 'Credited';
  const lines = invoiceOrderLines(orders);
  const dueLabel = cash > 0 ? 'Amount to pay (cash only)' : 'Amount to pay';
  const creditNote = credit > 0
    ? 'Store credit is already in their wallet. You can download the PDF from the Partners tab.'
    : 'No store credit this period. You can download the PDF from the Partners tab.';

  const subject = cash > 0
    ? `Pay ${formatMoney(cash)} cash — ${code} — ${periodLabel}`
    : `Partner invoice — ${code} — ${periodLabel}`;

  const html = wrapEmail(`
      ${eyebrow("Partner invoice")}
      ${h1("Monthly partner invoice")}
      ${intro(`${periodLabel} closed for <strong style="color:${C_INK};">${code}</strong>.`)}
      ${heroBanner(dueLabel, formatMoney(cash), creditNote)}
      ${h2("Partner")}
      ${card(kvTable(`
        ${rowHtml('Partner', name)}
        ${rowHtml('Email', email)}
        ${rowHtml('Code', code)}
        ${rowHtml('Status', status, true)}
      `))}
      ${h2("Totals")}
      ${card(payoutBreakdownHtml({ cash, credit, total, audience: 'admin' }))}
      ${h2('Referred orders')}
      ${invoiceOrdersHtml(orders)}
  `, { preheader: `Pay ${formatMoney(cash)} cash · ${code} · ${periodLabel}` });

  const text = `Monthly partner invoice
${periodLabel} closed for ${code}.

AMOUNT TO PAY (CASH ONLY): ${formatMoney(cash)}
${creditNote}

Partner: ${name}
Email: ${email}
Code: ${code}
Status: ${status}
${payoutBreakdownText({ cash, credit, total, audience: 'admin' })}

Referred orders
${lines.length ? lines.map((line) => `- ${line}`).join('\n') : '- None'}
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
  renderPartnerMonthlyInvoiceEmail,
  renderAdminMonthlyInvoiceEmail,
};

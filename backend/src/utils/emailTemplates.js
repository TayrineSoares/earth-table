// Helper: turn cents into "$12.34 CAD"
function formatMoney(cents) {
  if (!Number.isFinite(cents)) return "$0.00 CAD";
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars} CAD`;
}

function withHst(amount) {
  return `${amount} + HST`;
}

function formatMoneyHst(cents) {
  return withHst(formatMoney(cents));
}

const { mealsAWeek, mealPlanPhrase, formatFulfillmentLine } = require('../queries/subscriptionWeek');
const { PAUSE_CANCEL_BY, MEAL_LOCK_BY, PICKUP_ADDRESS } = require('../emails/subscriptionEmailSpec');

function formatDollars(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function appUrl(path) {
  const base = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function ctaLink(href, label) {
  return `<p style="margin:0 0 24px; font-family:${FONT};"><a href="${href}" style="color:${C_AMBER}; font-weight:700; font-size:15px; line-height:1.55; text-decoration:underline;">${label}</a></p>`;
}

function sundayDatePart(label) {
  const raw = String(label || '').trim();
  const stripped = raw.replace(/^Sunday,\s*/i, '').trim();
  return stripped || raw || 'this week';
}

function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(phone || '').trim() || '—';
}

function itemLineName(item, fallback = 'Item') {
  return item.slug || item.name || item.products?.slug || item.products?.name || fallback;
}

function itemQtyLine(item, fallback = 'Item') {
  const qty = Number(item.quantity) || 1;
  return `${itemLineName(item, fallback)} x ${qty}`;
}

function itemLinesHtml(items, fallback) {
  return (items || []).map((item) => itemQtyLine(item, fallback)).join('<br/>');
}

function itemLinesText(items, fallback) {
  return (items || []).map((item) => itemQtyLine(item, fallback)).join('\n');
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

// Stacked lockup (high-logo-2.png).
// Production uses a public https URL so Gmail/Outlook can load it.
// Local/dev falls back to an inline CID attachment from backend/assets/email/.
// Override with EMAIL_LOGO_URL if needed.
function getEmailLogoUrl() {
  if (process.env.EMAIL_LOGO_URL) return process.env.EMAIL_LOGO_URL;
  const frontend = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (frontend && !/localhost|127\.0\.0\.1/.test(frontend)) {
    return `${frontend}/email/high-logo-2.png`;
  }
  return 'cid:earth-table-logo';
}

function spacer(px = 24) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;"><tr><td style="height:${px}px; line-height:${px}px; font-size:1px;">&nbsp;</td></tr></table>`;
}

function wrapEmail(inner, { preheader, replyOk, title } = {}) {
  const footerCopy = replyOk
    ? `Questions? Reply to this email or write to <a href="mailto:hello@earthtableco.ca" style="color:${C_AMBER}; text-decoration:underline;">hello@earthtableco.ca</a>.`
    : `Questions? Email <a href="mailto:hello@earthtableco.ca" style="color:${C_AMBER}; text-decoration:underline;">hello@earthtableco.ca</a>. Please do not reply to this email.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title || "Earth Table"}</title>
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
              <img src="${getEmailLogoUrl()}" width="140" alt="Earth Table Co" style="display:block; margin:0 auto; width:140px; max-width:140px; height:auto; border:0; outline:none; text-decoration:none;">
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
  const qty = Number(p.quantity) || 1;
  const unit = Number(p.unit_price_cents) || 0;
  return {
    name: p.slug ?? p.name ?? "Item",
    qty,
    price: formatMoneyHst(unit * qty),
  };
}

function itemsHtml(order) {
  const rows = listItems(order)
    .map((p) => {
      const { name, qty, price } = itemParts(p);
      return rowHtml(`${name} × ${qty}`, price);
    })
    .join("");
  return kvTable(rows || rowHtml("Items", "—", true));
}

function itemsText(order) {
  const rows = listItems(order).map((p) => {
    const { name, qty, price } = itemParts(p);
    return `- ${name} × ${qty} — ${price}`;
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

function partnerProgramRuleLists(audience = "partner", rates = {}) {
  const isPartner = audience === "partner";
  const discount = Number.isFinite(Number(rates.discount_percent))
    ? Math.round(Number(rates.discount_percent))
    : 10;
  const cashback = Number.isFinite(Number(rates.cashback_percent))
    ? Math.round(Number(rates.cashback_percent))
    : 10;
  const minCents = Number(process.env.REFERRAL_MIN_SUBTOTAL_CENTS ?? 0);
  const minDollars = Number.isFinite(minCents) && minCents > 0
    ? (minCents / 100).toFixed(0)
    : null;

  const how = [
    `Friends get <strong>${discount}% off</strong> their item subtotal (delivery and tax excluded from the discount).`,
    "They must be registered with Earth Table and logged in.",
    "It only applies to their <strong>first order ever</strong> on the site.",
  ];
  if (minDollars) {
    how.push(
      `The item subtotal must be at least <strong>$${minDollars}</strong> before discount, tax, and delivery.`
    );
  }
  how.push(
    "A referral code cannot be combined with a regular promo code.",
    isPartner
      ? "<strong>You cannot use your own referral code</strong> on your own orders."
      : "The partner <strong>cannot use their own referral code</strong> on their own orders."
  );

  return {
    how,
    cashback: [
      isPartner
        ? `You earn <strong>${cashback}% of the pre-discount item subtotal</strong> (not the discounted amount, not delivery, not tax) on orders that use your code.`
        : `The partner earns <strong>${cashback}% of the pre-discount item subtotal</strong> (not the discounted amount, not delivery, not tax) on orders that use their code.`,
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

function partnerProgramRulesHtml(audience = "partner", rates = {}) {
  const { how, cashback } = partnerProgramRuleLists(audience, rates);
  return `
      ${h2("How the code works")}
      ${ruleListHtml(how)}
      ${h2("Cashback")}
      ${ruleListHtml(cashback)}
  `;
}

function partnerProgramRulesText(audience = "partner", rates = {}) {
  const { how, cashback } = partnerProgramRuleLists(audience, rates);
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
  const discount = Number.isFinite(Number(partner.discount_percent))
    ? Math.round(Number(partner.discount_percent))
    : 10;
  const cashback = Number.isFinite(Number(partner.cashback_percent))
    ? Math.round(Number(partner.cashback_percent))
    : 10;
  const rates = { discount_percent: discount, cashback_percent: cashback };

  const subject = `You're an Earth Table partner — code ${code}`;

  const html = wrapEmail(`
      ${eyebrow("Partner program")}
      ${h1("Welcome to the partner program")}
      ${intro(`Hi ${firstName}, you've been set up as an Earth Table partner.`)}
      ${heroBanner("Your referral code", code, `Share this with friends. They get ${discount}% off their first order.`)}
      ${h2("Payout")}
      ${card(kvTable(`
        ${rowHtml("Payout type", "Cash (default)", true)}
      `))}
      <p style="margin:0 0 24px; font-size:14px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">Switch to store credit anytime from your partner wallet — new orders use whatever you have selected.</p>
      ${partnerProgramRulesHtml("partner", rates)}
  `, {
    preheader: `Your Earth Table referral code is ${code}`,
    replyOk: true,
  });

  const text = `Welcome to the Earth Table partner program

Hi ${firstName}, you've been set up as an Earth Table partner.

Your referral code: ${code}
Friends get ${discount}% off. You earn ${cashback}% cashback.
Payout type: Cash (default). Switch to store credit anytime from your partner wallet — new orders use whatever you have selected.

${partnerProgramRulesText("partner", rates)}

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
  const discount = Number.isFinite(Number(partner.discount_percent))
    ? Math.round(Number(partner.discount_percent))
    : 10;
  const cashback = Number.isFinite(Number(partner.cashback_percent))
    ? Math.round(Number(partner.cashback_percent))
    : 10;
  const rates = { discount_percent: discount, cashback_percent: cashback };

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
        ${rowHtml("Discount", `${discount}%`)}
        ${rowHtml("Cashback", `${cashback}%`)}
        ${rowHtml("Payout type", "Cash (default)", true)}
      `))}
      <p style="margin:0 0 24px; font-size:14px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">They can switch to store credit anytime from their partner wallet.</p>
      ${partnerProgramRulesHtml('admin', rates)}
  `, { preheader: `New partner ${code} · ${name}` });

  const text = `New partner created

Code: ${code}
Name: ${name}
Email: ${email}
Phone: ${phone}
Discount: ${discount}%
Cashback: ${cashback}%
Payout type: Cash (default). They can switch to store credit anytime from their partner wallet.

${partnerProgramRulesText('admin', rates)}
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

/**
 * First-week subscription welcome.
 */
function renderSubscriptionWelcomeEmail({
  firstName,
  mealCount,
  planPriceCents,
  delivery,
  deliveryLabel,
  pickupSlot,
  cutoffLabel,
  chargeLabel,
  subscriptionId,
  notes,
  addons,
  discountCode,
  discountKind,
  discountLabel,
  discountSavedCents,
  planSavedCents,
  addonSavedCents,
  addonRegularCents,
} = {}) {
  const name = firstName || 'there';
  const planWeek = mealsAWeek(mealCount);
  const planPhrase = mealPlanPhrase(mealCount);
  const sunday = deliveryLabel || 'Sunday';
  const fulfillment = formatFulfillmentLine({ delivery, deliveryLabel: sunday, pickupSlot });
  const manageHref = appUrl(`/my-subscriptions/${subscriptionId || ''}`);
  const cutoff = cutoffLabel || MEAL_LOCK_BY;
  const charge = chargeLabel || PAUSE_CANCEL_BY;
  const note = String(notes || '').trim() || '—';
  const planOff = Math.max(0, Number(planSavedCents) || 0);
  const addonOff = Math.max(0, Number(addonSavedCents) || 0);
  const addonRegular = Math.max(0, Number(addonRegularCents) || 0);
  const saved = planOff + addonOff || Math.max(0, Number(discountSavedCents) || 0);
  const code = String(discountCode || '').toUpperCase();
  const savingsLabel = discountLabel
    || (code ? `${discountKind === 'promo' ? 'Promo' : discountKind === 'referral' ? 'Referral' : 'Code'} (${code})` : '');
  const label = savingsLabel || code;
  const savingsLine = saved > 0 && label
    ? `You saved ${formatDollars(saved)} this first week with ${code || savingsLabel}. Later weeks are regular price.`
    : '';
  const planDiscountRow = planOff > 0 && label
    ? kvRow(`${label} · first week only`, `−${formatDollars(planOff)}`)
    : (planOff === 0 && addonOff === 0 && saved > 0 && label
      ? kvRow(`${label} · first week only`, `−${formatDollars(saved)}`)
      : '');
  const addonHtml = itemLinesHtml(addons);
  const showAddons = addonRegular > 0 || addonOff > 0 || !!addonHtml;
  const addonRows = [
    addonRegular > 0 ? kvRow('Add-ons', formatDollars(addonRegular)) : '',
    addonOff > 0 && label ? kvRow(`${label} · first week only`, `−${formatDollars(addonOff)}`) : '',
    kvRow('Billed', cutoff, { last: true }),
  ].join('');

  const subject = `Welcome to weekly plans — your first box is ${sunday}`;

  const html = wrapEmail(`
      ${eyebrow("Weekly subscription")}
      ${h1(`You're all set, ${name}`)}
      ${intro(`Your ${planPhrase} is confirmed. The plan and delivery are paid; extras are billed ${cutoff} if they are still on the box.`)}
      ${savingsLine ? `<p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:${C_INK}; font-family:${FONT};">${savingsLine}</p>` : ''}
      ${card(kvTable(`
        ${kvRow("Plan", planWeek)}
        ${planPriceCents != null ? kvRow('Price', `${formatDollars(planPriceCents)}/week + HST`) : ''}
        ${planDiscountRow}
        ${kvRow("This Sunday", fulfillment)}
        ${kvRow("Notes", note)}
        ${kvRow("Change your meals by", cutoff, { last: true })}
      `))}
      ${showAddons ? `${h2("Add-ons")}${addonHtml ? itemListHtml(addons, '') : ''}${card(kvTable(addonRows))}` : ''}
      ${ctaLink(manageHref, "Manage my subscription")}
      <p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">Haven't picked yet? Choose your meals before ${cutoff} and we'll have them ready. Miss the cutoff and we'll repeat last week's selections.</p>
      <p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">Your plan renews every week automatically. Swap meals, switch between pickup and delivery, skip a week, or pause anytime in My Subscriptions — just before ${charge} to skip a Sunday, or before ${cutoff} to change this week's box.</p>
  `, {
    preheader: `Your first box is ${sunday}.`,
    replyOk: true,
    title: subject,
  });

  const addonText = showAddons
    ? `\nAdd-ons\n${itemLinesText(addons) || ''}${addonRegular > 0 ? `\nAdd-ons: ${formatDollars(addonRegular)}` : ''}${addonOff > 0 && label ? `\n${label} · first week only: −${formatDollars(addonOff)}` : ''}\nBilled: ${cutoff}\n`
    : '';

  const text = `You're all set, ${name}

Your ${planPhrase} is confirmed. The plan and delivery are paid; extras are billed ${cutoff} if they are still on the box.
${savingsLine ? `\n${savingsLine}\n` : ''}
Plan: ${planWeek}${planPriceCents != null ? `\nPrice: ${formatDollars(planPriceCents)}/week + HST` : ''}${planOff > 0 && label ? `\n${label} · first week only: −${formatDollars(planOff)}` : (planOff === 0 && addonOff === 0 && saved > 0 && label ? `\n${label} · first week only: −${formatDollars(saved)}` : '')}
This Sunday: ${fulfillment}
Notes: ${note}
Change your meals by: ${cutoff}
${addonText}
Manage my subscription: ${manageHref}

Haven't picked yet? Choose your meals before ${cutoff} and we'll have them ready. Miss the cutoff and we'll repeat last week's selections.

Your plan renews every week automatically. Swap meals, switch between pickup and delivery, skip a week, or pause anytime in My Subscriptions — just before ${charge} to skip a Sunday, or before ${cutoff} to change this week's box.

Questions? Reply to this email or write to hello@earthtableco.ca.`;

  return { subject, html, text };
}

function renderOwnerSubscriptionEmail({
  firstName,
  lastName,
  mealCount,
  planPriceCents,
  delivery,
  deliveryLabel,
  pickupSlot,
  subscribedAtLabel,
  paidCents,
  chargeId,
  meals,
  addons,
  cutoffLabel,
  email,
  phone,
  notes,
  deliveryFeeCents,
  discountCode,
  discountKind,
  discountLabel,
  planSavedCents,
  addonSavedCents,
  addonRegularCents,
} = {}) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Customer';
  const planWeek = mealsAWeek(mealCount);
  const sunday = deliveryLabel || 'Sunday';
  const fulfillment = formatFulfillmentLine({ delivery, deliveryLabel: sunday, pickupSlot });
  const mealHtml = itemLinesHtml(meals) || '—';
  const mealText = itemLinesText(meals) || '—';
  const addonHtml = itemLinesHtml(addons);
  const addonText = itemLinesText(addons);
  const cutoff = cutoffLabel || MEAL_LOCK_BY;
  const paid = formatDollars(paidCents);
  const stripeRef = chargeId || '—';
  const note = String(notes || '').trim() || '—';
  const planOff = Math.max(0, Number(planSavedCents) || 0);
  const addonOff = Math.max(0, Number(addonSavedCents) || 0);
  const addonRegular = Math.max(0, Number(addonRegularCents) || 0);
  const deliveryFee = Math.max(0, Number(deliveryFeeCents) || 0);
  const code = String(discountCode || '').toUpperCase();
  const codeLabel = discountLabel
    || (code
      ? `${discountKind === 'promo' ? 'Promo' : discountKind === 'referral' ? 'Referral' : 'Code'} (${code})`
      : 'First-week discount');
  const hasDiscount = planOff > 0 || addonOff > 0;

  const moneyRows = hasDiscount
    ? `${kvRow('Regular price', `${formatDollars(planPriceCents)}/week + HST`)}
        ${planOff > 0 ? kvRow(`${codeLabel} · first week only`, `−${formatDollars(planOff)}`) : ''}
        ${deliveryFee > 0 ? kvRow('Delivery', `${formatDollars(deliveryFee)} + HST`) : ''}
        ${addonRegular > 0
          ? kvRow(
            'Add-ons (cutoff)',
            addonOff > 0
              ? `${formatDollars(addonRegular)} regular · ${codeLabel} −${formatDollars(addonOff)}`
              : `${formatDollars(addonRegular)} billed at cutoff`
          )
          : ''}
        ${kvRow('Paid today', `${paid} including HST${stripeRef !== '—' ? ` · Stripe ${stripeRef}` : ''}`, { last: true, highlight: true })}`
    : `${kvRow('Plan', `${planWeek} — ${formatDollars(planPriceCents)}/week + HST`)}
        ${deliveryFee > 0 ? kvRow('Delivery', `${formatDollars(deliveryFee)} + HST`) : ''}
        ${kvRow('First payment', `${paid} paid · Stripe ${stripeRef}`, { last: true })}`;

  const moneyText = hasDiscount
    ? [
      `Regular price: ${formatDollars(planPriceCents)}/week + HST`,
      planOff > 0 ? `Discount: ${codeLabel} · first week only −${formatDollars(planOff)}` : null,
      deliveryFee > 0 ? `Delivery: ${formatDollars(deliveryFee)} + HST` : null,
      addonRegular > 0
        ? (addonOff > 0
          ? `Add-ons (cutoff): ${formatDollars(addonRegular)} regular · ${codeLabel} −${formatDollars(addonOff)}`
          : `Add-ons (cutoff): ${formatDollars(addonRegular)}`)
        : null,
      `Paid today: ${paid} including HST${stripeRef !== '—' ? ` · Stripe ${stripeRef}` : ''}`,
    ].filter(Boolean).join('\n')
    : [
      `Plan: ${planWeek} — ${formatDollars(planPriceCents)}/week + HST`,
      deliveryFee > 0 ? `Delivery: ${formatDollars(deliveryFee)} + HST` : null,
      `First payment: ${paid} paid · Stripe ${stripeRef}`,
    ].filter(Boolean).join('\n');

  const subject = `New subscription — ${fullName} — ${planWeek}`;

  const html = wrapEmail(`
      ${eyebrow("New subscription")}
      ${h1(`${fullName} — ${planWeek}`)}
      ${intro(`Subscribed ${subscribedAtLabel || 'just now'}. First box: ${sunday}.`)}
      ${card(kvTable(`
        ${kvRow("Fulfillment", fulfillment)}
        ${moneyRows}
      `))}
      ${h2("Meals selected")}
      <p style="margin:0 0 8px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${mealHtml}</p>
      ${addonHtml ? `${h2("Add-ons")}<p style="margin:0 0 8px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${addonHtml}</p>` : ''}
      <p style="margin:0 0 24px; font-size:13px; line-height:1.5; color:${C_MUTED}; font-family:${FONT};">Maybe change by ${cutoff}</p>
      ${card(kvTable(`
        ${kvRow("Customer", `${email || '—'} · ${formatPhone(phone)}`)}
        ${kvRow("Notes", note, { last: true })}
      `))}
  `, {
    preheader: `${fullName} subscribed — first box ${sunday}.`,
    replyOk: true,
  });

  const text = `New subscription
${fullName} — ${planWeek}
Subscribed ${subscribedAtLabel || 'just now'}.
First box: ${sunday}.

Fulfillment: ${fulfillment}
${moneyText}

Meals selected
${mealText}
${addonHtml ? `\nAdd-ons\n${addonText}\n` : ''}
Maybe change by ${cutoff}

Customer: ${email || '—'} · ${formatPhone(phone)}
Notes: ${note}`;

  return { subject, html, text };
}

function renderSubscriptionUpdatedEmail({
  firstName,
  mealCount,
  delivery,
  deliveryLabel,
  pickupSlot,
  cutoffLabel,
  appliesTo,
  meals,
  addons,
  notes,
} = {}) {
  const name = firstName || 'there';
  const planWeek = mealsAWeek(mealCount);
  const sunday = deliveryLabel || 'Sunday';
  const sundayDate = sundayDatePart(sunday);
  const fulfillment = formatFulfillmentLine({ delivery, deliveryLabel: sunday, pickupSlot });
  const cutoff = cutoffLabel || MEAL_LOCK_BY;
  const note = String(notes || '').trim() || '—';
  const thisSunday = appliesTo !== 'next_week';
  const timing = thisSunday
    ? `These changes apply to this Sunday, ${sundayDate}.`
    : `This week's cutoff has passed, so these changes apply to next Sunday, ${sundayDate} only. This Sunday's box is already locked.`;
  const mealHtml = itemLinesHtml(meals) || '—';
  const addonHtml = itemLinesHtml(addons);
  const mealText = itemLinesText(meals) || '—';
  const addonText = itemLinesText(addons);

  const subject = thisSunday
    ? `You've updated this Sunday's box — ${sunday}`
    : `You've updated next week's box — ${sunday}`;

  const html = wrapEmail(`
      ${eyebrow("Weekly subscription")}
      ${h1(`You've updated your plan, ${name}`)}
      ${intro(timing)}
      ${card(kvTable(`
        ${kvRow("Plan", planWeek)}
        ${kvRow("That Sunday", fulfillment)}
        ${kvRow("Notes", note)}
        ${kvRow("Change meals by", cutoff, { last: true })}
      `))}
      ${h2("Meals")}
      <p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${mealHtml}</p>
      ${h2("Add-ons")}
      <p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${addonHtml || 'None this week.'}</p>
      ${thisSunday
        ? ''
        : `<p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">If you need a delivery change for this Sunday, email <a href="mailto:hello@earthtableco.ca" style="color:${C_AMBER};">hello@earthtableco.ca</a>.</p>`}
      <p style="margin:0 0 24px; font-size:15px; line-height:1.55; color:${C_MUTED}; font-family:${FONT};">Manage anything else in My Subscriptions before ${cutoff}.</p>
  `, {
    preheader: timing,
    replyOk: true,
  });

  const text = `You've updated your plan, ${name}

${timing}

Plan: ${planWeek}
That Sunday: ${fulfillment}
Notes: ${note}
Change meals by: ${cutoff}

Meals
${mealText}

Add-ons
${addonText || 'None this week.'}

${thisSunday ? '' : 'If you need a delivery change for this Sunday, email hello@earthtableco.ca.\n\n'}Manage anything else in My Subscriptions before ${cutoff}.`;

  return { subject, html, text };
}

function renderSubscriptionManageEmail(payload = {}) {
  const {
    kind,
    firstName,
    mealCount,
    nextMealCount,
    deliveryLabel,
    chargeLabel,
    cutoffLabel,
    cardBrand,
    last4,
    expMonth,
    expYear,
  } = payload;
  const name = firstName || 'there';
  const planWeek = mealsAWeek(mealCount);
  const sunday = deliveryLabel || 'Sunday';
  const charge = chargeLabel || PAUSE_CANCEL_BY;
  const cutoff = cutoffLabel || MEAL_LOCK_BY;
  const manageHref = appUrl('/my-subscriptions');
  const nextPlan = mealsAWeek(nextMealCount);

  if (kind === 'card_expiry') {
    const month = String(expMonth || '').padStart(2, '0');
    const label = expYear ? `${month}/${expYear}` : '';
    const brand = String(cardBrand || 'card');
    const niceBrand = brand.charAt(0).toUpperCase() + brand.slice(1);
    const cardOnFile = `${niceBrand} •••• ${last4 || '••••'}`;
    const subject = `This card expires ${label}`;
    const note = `This card expires ${label}. Update it before then and nothing on your plan changes.`;
    const html = wrapEmail(`
      ${eyebrow('Weekly subscription')}
      ${h1('Your card is expiring')}
      ${card(kvTable(`
        ${kvRow('Card on file', cardOnFile)}
        ${kvRow('Expires', label || '—', { last: true })}
      `))}
      ${intro(note)}
      ${ctaLink(manageHref, 'My Subscriptions →')}
    `, { preheader: note, replyOk: true, title: subject });
    const text = `Your card is expiring

Card on file: ${cardOnFile}
Expires: ${label}

${note}

My Subscriptions: ${manageHref}`;
    return { subject, html, text };
  }

  const copy = {
    pause_now: {
      subject: `Your weekly plan is paused until you resume`,
      heading: `You're paused, ${name}`,
      intro: `This Sunday, ${sundayDatePart(sunday)}, will not go out. Your meals and card stay on file. The plan stays paused until you tap Resume — we'll email you on Mondays in case you want a box this week.`,
    },
    pause_first: {
      subject: `Your weekly plan is paused — first box still runs`,
      heading: `First box still goes out, ${name}`,
      intro: `Your first box on ${sundayDatePart(sunday)} cannot be paused or cancelled, so it still goes out. Later weeks are paused until you resume. You can still change add-ons on that first box until Thursday at 5:00 PM ET.`,
    },
    pause_next: {
      subject: `Pause confirmed — this Sunday still runs`,
      heading: `Pause starts after this Sunday, ${name}`,
      intro: `The payment cutoff for this week has passed, so this Sunday, ${sundayDatePart(sunday)}, still goes out. The plan is paused starting the following week. Your meals and card stay on file until you resume. We'll email you on Mondays in case you want a box that week.`,
    },
    cancel_now: {
      subject: `Your weekly plan is cancelled`,
      heading: `You're cancelled, ${name}`,
      intro: `This Sunday, ${sundayDatePart(sunday)}, will not go out. Your plan, meals, and saved card are removed. You can start fresh any time from Subscribe & Save.`,
    },
    cancel_next: {
      subject: `Your weekly plan is cancelled — this Sunday still runs`,
      heading: `This Sunday still goes out, ${name}`,
      intro: `The payment cutoff for this week has passed, so this Sunday, ${sundayDatePart(sunday)}, still goes out. The plan is cancelled starting the following week — meals and card are not kept after that. Start a new plan any time from Subscribe & Save.`,
    },
    pause_nudge: {
      subject: `Your weekly plan is still paused — resume for this Sunday?`,
      heading: `We saved your plan, ${name}`,
      intro: `Your ${planWeek} is still paused, with your meals and card on file. Resume in My Subscriptions by ${charge} if you want a box this Sunday. We'll keep inviting you back on Mondays until you resume or cancel.`,
    },
    payment_failed: {
      subject: `Update your card to keep this Sunday's box`,
      heading: `We could not charge this week, ${name}`,
      intro: `Your card was declined for this Sunday, ${sundayDatePart(sunday)}. Update it in My Subscriptions before ${cutoff} to keep the box. If it is still unpaid at cutoff, this Sunday is skipped and the plan stays paused.`,
    },
    resume: {
      subject: `Your weekly plan is active again`,
      heading: `Welcome back, ${name}`,
      intro: `Your ${planWeek} is active again. Weekly boxes stay on until you pause or cancel. Pause by ${charge} to skip a Sunday.`,
    },
    plan_now: {
      subject: `You're on a ${nextPlan}`,
      heading: `Plan updated, ${name}`,
      intro: `You're now on a ${nextPlan}. This Sunday, ${sundayDatePart(sunday)}, uses the new count — pick that many meals before ${cutoff}.`,
    },
    plan_next: {
      subject: `Plan change saved — starts after this Sunday`,
      heading: `This Sunday stays as-is, ${name}`,
      intro: `This Sunday, ${sundayDatePart(sunday)}, stays on your ${planWeek}. The ${nextPlan} starts the following week.`,
    },
  }[kind] || {
    subject: 'Your weekly plan',
    heading: `Update, ${name}`,
    intro: 'Your weekly plan was updated.',
  };

  const html = wrapEmail(`
      ${eyebrow("Weekly subscription")}
      ${h1(copy.heading)}
      ${intro(copy.intro)}
      ${ctaLink(manageHref, "My Subscriptions →")}
  `, {
    preheader: copy.subject,
    replyOk: true,
    title: copy.subject,
  });

  const text = `${copy.heading}

${copy.intro}

My Subscriptions: ${manageHref}

Questions? Reply to this email or write to hello@earthtableco.ca.`;

  return { subject: copy.subject, html, text };
}

function renderSubscriptionHolidaySkipEmail({
  firstName,
  skippedSunday,
  nextSunday,
  chargeLabel,
  owner = false,
} = {}) {
  const name = firstName || 'there';
  const skipped = skippedSunday || 'this Sunday';
  const next = nextSunday || 'the next Sunday';
  const charge = chargeLabel || PAUSE_CANCEL_BY;
  const subject = owner
    ? `Holiday skip — no boxes ${skipped}`
    : `No box this Sunday — next delivery is ${next}`;
  const heading = owner ? `Holiday skip` : `No box this Sunday, ${name}`;
  const bodyText = owner
    ? `Sunday ${skipped} is a holiday. No weekly boxes go out and no one is charged. Next Sunday that runs is ${next}.`
    : `Sunday ${skipped} is a holiday, so there is no box and no charge. Your next delivery is ${next}. Weekly billing stays on the usual ${charge} schedule.`;

  const html = wrapEmail(`
      ${eyebrow("Weekly subscription")}
      ${h1(heading)}
      ${intro(bodyText)}
  `, {
    preheader: subject,
    replyOk: true,
    title: subject,
  });
  const text = `${heading}\n\n${bodyText}\n`;
  return { subject, html, text };
}

function boxMealCount(row) {
  const n = Number(row?.mealCount);
  if (n > 0) return n;
  const fromItems = (row?.meals || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return fromItems > 0 ? fromItems : '—';
}

function renderOwnerThursdayLockEmail({ sunday, boxes = [] } = {}) {
  const pickup = boxes.filter((row) => !row.delivery);
  const delivery = boxes.filter((row) => row.delivery);
  const ordered = [...pickup, ...delivery];
  const count = ordered.length;
  const orderIds = ordered.map((row) => row.orderId).filter(Boolean);
  const orderTag = orderIds.length ? ` · #${orderIds.join(', #')}` : '';
  const subject = `Weekly boxes locked — ${sunday || 'Sunday'} (${count})${orderTag}`;
  const block = (row, i) => {
    const name = String(row.name || '').trim() || 'Customer';
    const meals = boxMealCount(row);
    const method = row.method || (row.delivery ? 'Delivery' : 'Pickup');
    const start = row.windowStart || '—';
    const end = row.windowEnd || '—';
    const notes = String(row.notes || '').trim();
    const extrasHtml = itemLinesHtml(row.extras, 'Add-on');
    const loc = row.address || (row.delivery ? '—' : PICKUP_ADDRESS);
    const boxLine = `${method} ${sunday || 'Sunday'}, ${start} – ${end}`;
    const orderLine = row.orderId ? ` · order #${row.orderId}` : '';
    const place = row.delivery
      ? `<p style="margin:0 0 6px; font-size:14px; color:${C_INK}; font-family:${FONT};"><strong>Delivery Address:</strong> ${loc}</p>
      <p style="margin:0 0 10px; font-size:14px; color:${C_INK}; font-family:${FONT};"><strong>Notes:</strong> ${notes || loc}</p>`
      : `<p style="margin:0 0 6px; font-size:14px; color:${C_INK}; font-family:${FONT};">${PICKUP_ADDRESS}</p>
      ${notes ? `<p style="margin:0 0 10px; padding:8px 10px; background-color:${C_CREAM}; font-size:14px; color:${C_INK}; font-family:${FONT};"><strong>Notes:</strong> ${notes}</p>` : ''}`;
    return `
    <div style="margin:0 0 24px; padding:16px 0; border-top:1px solid ${C_LINE};">
      <p style="margin:0 0 8px; font-size:16px; font-weight:700; color:${C_INK}; font-family:${FONT};">${i}. ${name} — ${meals} meals</p>
      <p style="margin:0 0 6px; font-size:14px; color:${C_INK}; font-family:${FONT};">${boxLine}</p>
      <p style="margin:0 0 10px; font-size:14px; color:${C_MUTED}; font-family:${FONT};">${formatPhone(row.phone)} · ${row.email || '—'}${orderLine}</p>
      ${place}
      <p style="margin:0 0 10px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${itemLinesHtml(row.meals, 'Meal') || '—'}</p>
      ${extrasHtml ? `<p style="margin:0; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};"><strong>Extras:</strong><br/>${extrasHtml}</p>` : ''}
    </div>`;
  };
  const html = wrapEmail(`
      ${eyebrow("Kitchen")}
      ${h1(`${count} weekly box${count === 1 ? '' : 'es'} for ${sunday || 'Sunday'}`)}
      ${intro(`Meals are locked. These rows are on the Subscriptions tab, not Orders. <strong>${count} plan${count === 1 ? '' : 's'}</strong> · ${pickup.length} pickup, ${delivery.length} delivery.`)}
      ${ordered.map((row, i) => block(row, i + 1)).join('') || `<p style="margin:0; font-size:14px; color:${C_MUTED}; font-family:${FONT};">None.</p>`}
  `, {
    preheader: subject,
    replyOk: true,
    title: subject,
  });
  const textLines = ordered.map((row, i) => {
    const notes = String(row.notes || '').trim();
    const loc = row.address || (row.delivery ? '—' : PICKUP_ADDRESS);
    const method = row.method || (row.delivery ? 'Delivery' : 'Pickup');
    return [
      `${i + 1}. ${String(row.name || '').trim() || 'Customer'} — ${boxMealCount(row)} meals`,
      `${method} ${sunday || 'Sunday'}, ${row.windowStart || '—'} – ${row.windowEnd || '—'}`,
      `${formatPhone(row.phone)} · ${row.email || '—'}${row.orderId ? ` · order #${row.orderId}` : ''}`,
      row.delivery ? `Delivery Address: ${loc}` : `Address: ${PICKUP_ADDRESS}`,
      row.delivery ? `Notes: ${notes || loc}` : (notes ? `Notes: ${notes}` : ''),
      itemLinesText(row.meals, 'Meal') || '—',
      row.extras?.length ? `Extras:\n${itemLinesText(row.extras, 'Add-on')}` : '',
    ].filter(Boolean).join('\n');
  });
  const text = `${subject}\n\n${count} plan${count === 1 ? '' : 's'} · ${pickup.length} pickup, ${delivery.length} delivery\n\n${textLines.join('\n\n') || 'None.'}\n`;
  return { subject, html, text };
}

function receiptMoney(cents) {
  const n = Number(cents) || 0;
  if (n < 0) return `−${formatDollars(Math.abs(n))}`;
  return formatDollars(n);
}

function moneyReceiptHtml(lines, totalLabel, totalCents) {
  const rows = (lines || []).map((line, i, all) => {
    const last = i === all.length - 1 && !totalLabel;
    return kvRow(line.label, receiptMoney(line.cents), { last });
  });
  if (totalLabel) {
    rows.push(kvRow(totalLabel, formatDollars(totalCents), { last: true, highlight: true }));
  }
  return card(kvTable(rows.join('')));
}

function moneyReceiptText(lines, totalLabel, totalCents) {
  const body = (lines || []).map((line) => `${line.label}: ${receiptMoney(line.cents)}`).join('\n');
  if (!totalLabel) return body;
  return `${body}\n${totalLabel}: ${formatDollars(totalCents)}`;
}

function itemListHtml(items, emptyCopy) {
  const html = itemLinesHtml(items);
  return `<p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:${C_INK}; font-family:${FONT};">${html || emptyCopy}</p>`;
}

function receiptLines({
  planCents,
  deliveryCents,
  addonCents,
  chargedCents,
  discountCents,
  discountLabel,
} = {}) {
  const lines = [];
  const off = Math.max(0, Number(discountCents) || 0);
  if (planCents > 0) lines.push({ label: 'Plan', cents: planCents });
  if (deliveryCents > 0) lines.push({ label: 'Delivery', cents: deliveryCents });
  if (addonCents > 0) lines.push({ label: 'Add-ons', cents: addonCents });
  if (off > 0) {
    lines.push({ label: discountLabel || 'First-week discount · first week only', cents: -off });
  }
  const pretax = (Number(planCents) || 0) + (Number(deliveryCents) || 0) + (Number(addonCents) || 0) - off;
  const tax = Math.max(0, (Number(chargedCents) || 0) - pretax);
  if (tax > 0) lines.push({ label: 'HST', cents: tax });
  return lines;
}

/**
 * Wednesday: plan+delivery receipt (if the card was billed) plus tomorrow's meal cutoff.
 */
function renderSubscriptionWednesdayEmail({
  firstName,
  mealCount,
  delivery,
  deliveryLabel,
  pickupSlot,
  cutoffLabel,
  charged = false,
  planCents = 0,
  deliveryCents = 0,
  chargedCents = 0,
  meals,
  addons,
  subscriptionId,
  cardBrand,
  last4,
} = {}) {
  const name = firstName || 'there';
  const planWeek = mealsAWeek(mealCount);
  const sunday = deliveryLabel || 'Sunday';
  const fulfillment = formatFulfillmentLine({ delivery, deliveryLabel: sunday, pickupSlot });
  const cutoff = cutoffLabel || MEAL_LOCK_BY;
  const manageHref = appUrl('/my-subscriptions');
  const mealsHref = appUrl(`/my-subscriptions/${subscriptionId || ''}/meals`);
  const chargeLines = charged
    ? receiptLines({ planCents, deliveryCents, chargedCents })
    : [];
  const cardLine = charged && last4
    ? `${cardBrand || 'Card'} •••• ${last4}`
    : '';
  const chargedLabel = cardLine ? `Charged to ${cardLine}` : 'Charged to your card';

  const introText = charged
    ? `This is your receipt for this week's plan and delivery${cardLine ? `, charged to ${cardLine}` : ''}. You can still change meals and extras until ${cutoff}. Add-ons still on the box then are billed at cutoff.`
    : `Plan and delivery for this Sunday are already paid. You can still change meals and extras until ${cutoff}. Add-ons still on the box then are billed at cutoff.`;

  const subject = charged
    ? `Receipt — ${planWeek} charged for ${sunday}`
    : `This Sunday's box — meals and extras until ${cutoff}`;

  const html = wrapEmail(`
      ${eyebrow("Weekly subscription")}
      ${h1(charged ? `Your receipt, ${name}` : `This week's box, ${name}`)}
      ${intro(introText)}
      ${card(kvTable(`
        ${kvRow("Plan", planWeek)}
        ${kvRow("This Sunday", fulfillment)}
        ${kvRow("Change meals by", cutoff, { last: true })}
      `))}
      ${charged ? `${h2("Receipt")}${moneyReceiptHtml(chargeLines, chargedLabel, chargedCents)}` : ''}
      ${h2("Meals")}
      ${itemListHtml(meals, 'None yet — pick them before cutoff and we will have them ready.')}
      ${h2("Add-ons")}
      ${itemListHtml(addons, 'None yet. Add extras before cutoff if you want them this week.')}
      ${ctaLink(mealsHref, "Manage this week's meals →")}
      ${ctaLink(manageHref, "My Subscriptions →")}
  `, {
    preheader: introText,
    replyOk: true,
    title: subject,
  });

  const text = `${charged ? `Your receipt, ${name}` : `This week's box, ${name}`}

${introText}

Plan: ${planWeek}
This Sunday: ${fulfillment}
Change meals by: ${cutoff}

${charged ? `Receipt\n${moneyReceiptText(chargeLines, chargedLabel, chargedCents)}\n\n` : ''}Meals
${itemLinesText(meals) || 'None yet — pick them before cutoff.'}

Add-ons
${itemLinesText(addons) || 'None yet.'}

Manage this week's meals: ${mealsHref}
My Subscriptions: ${manageHref}

Questions? Reply to this email or write to hello@earthtableco.ca.`;

  return { subject, html, text };
}

/**
 * Thursday lock: box is placed. Add-on receipt only if extras were billed.
 */
function renderSubscriptionThursdayEmail({
  firstName,
  mealCount,
  delivery,
  deliveryLabel,
  pickupSlot,
  postalCode,
  chargedAddons = false,
  addonCents = 0,
  chargedCents = 0,
  discountCents = 0,
  discountLabel,
  addonItems,
  meals,
} = {}) {
  const name = firstName || 'there';
  const planWeek = mealsAWeek(mealCount);
  const sunday = deliveryLabel || 'Sunday';
  const fulfillment = formatFulfillmentLine({ delivery, deliveryLabel: sunday, pickupSlot });
  const postal = String(postalCode || '').trim();
  const chargeLines = chargedAddons
    ? receiptLines({ addonCents, chargedCents, discountCents, discountLabel })
    : [];
  const introText = `Your weekly box has been placed and cannot be modified. ${delivery
    ? 'It will be delivered in the window below.'
    : 'Pick it up in the window below.'}`;

  const subject = `This Sunday's box is locked — ${sunday}`;

  const html = wrapEmail(`
      ${eyebrow("Weekly subscription")}
      ${h1(`This Sunday is locked, ${name}`)}
      ${intro(introText)}
      ${card(kvTable(`
        ${kvRow("Plan", planWeek)}
        ${kvRow(delivery ? "Delivery" : "Pickup", fulfillment, { last: !postal })}
        ${postal ? kvRow("Postal code", postal, { last: true }) : ''}
      `))}
      ${chargedAddons ? `${h2("Add-ons charged today")}${moneyReceiptHtml(chargeLines, "Charged to your card", chargedCents)}` : ''}
      ${h2("Meals")}
      ${itemListHtml(meals, '—')}
      ${h2("Add-ons")}
      ${itemListHtml(addonItems, 'None this week.')}
      ${ctaLink(appUrl('/my-subscriptions'), "My Subscriptions →")}
  `, {
    preheader: introText,
    replyOk: true,
    title: subject,
  });

  const text = `This Sunday is locked, ${name}

${introText}

Plan: ${planWeek}
${delivery ? 'Delivery' : 'Pickup'}: ${fulfillment}
${postal ? `Postal code: ${postal}\n` : ''}
${chargedAddons ? `Add-ons charged today\n${moneyReceiptText(chargeLines, 'Charged to your card', chargedCents)}\n\n` : ''}Meals
${itemLinesText(meals) || '—'}

Add-ons
${itemLinesText(addonItems) || 'None this week.'}

My Subscriptions: ${appUrl('/my-subscriptions')}

Questions? Reply to this email or write to hello@earthtableco.ca.`;

  return { subject, html, text };
}

function brandLabel(brand) {
  const raw = String(brand || 'card').trim();
  if (!raw) return 'Card';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function renderOwnerPaymentFailedEmail({
  customerName,
  amount,
  fulfillmentDate,
  cardBrand,
  last4,
  declineReason,
  dateTime,
  cutoffDateTime,
} = {}) {
  const name = customerName || 'Customer';
  const paid = amount || formatDollars(0);
  const when = fulfillmentDate || 'this Sunday';
  const subject = `Payment failed — ${name}, ${paid}`;
  const html = wrapEmail(`
      ${eyebrow('Weekly subscription')}
      ${h1('Payment failed')}
      ${intro(`<strong>${name} — ${paid} for ${when}</strong>`)}
      ${card(kvTable(`
        ${kvRow('Card', `${brandLabel(cardBrand)} •••• ${last4 || '••••'}`)}
        ${kvRow('Declined', `${declineReason || 'card_declined'} · ${dateTime || ''}`, { last: true })}
      `))}
      ${intro("The plan is paused until they add a new card. This Sunday's box will not go out.")}
      ${cutoffDateTime ? intro(`Meal lock / last retry: ${cutoffDateTime}`) : ''}
      ${ctaLink(appUrl('/admin'), 'View subscription →')}
  `, {
    preheader: subject,
    replyOk: true,
    title: subject,
  });
  const text = `${subject}\n\n${name} — ${paid} for ${when}\n${brandLabel(cardBrand)} •••• ${last4 || '••••'} · declined (${declineReason || 'card_declined'}) · ${dateTime || ''}\nThe plan is paused until they add a new card. This Sunday's box will not go out.\n`;
  return { subject, html, text };
}

function renderSubscriptionPriceEmail({
  firstName,
  mealCount,
  oldPriceCents,
  newPriceCents,
  chargeLabel,
} = {}) {
  const name = firstName || 'there';
  const planWeek = mealsAWeek(mealCount);
  const charge = chargeLabel || PAUSE_CANCEL_BY;
  const subject = `Your ${planWeek} is now ${formatDollars(newPriceCents)}/week`;
  const introText = `Your ${planWeek} is changing from ${formatDollars(oldPriceCents)} to ${formatDollars(newPriceCents)} per week (before tax). The new price applies at the next ${charge} charge — this Sunday stays at the amount already billed if you already paid.`;
  const html = wrapEmail(`
      ${eyebrow("Weekly subscription")}
      ${h1(`Price update, ${name}`)}
      ${intro(introText)}
      ${ctaLink(appUrl('/my-subscriptions'), "My Subscriptions →")}
  `, {
    preheader: subject,
    replyOk: true,
    title: subject,
  });
  const text = `Price update, ${name}\n\n${introText}\n\nMy Subscriptions: ${appUrl('/my-subscriptions')}\n`;
  return { subject, html, text };
}

module.exports = {
  renderCustomerOrderEmail,
  formatMoney,
  formatDollars,
  renderOwnerOrderEmail,
  renderPartnerWelcomeEmail,
  renderAdminPartnerWelcomeEmail,
  renderPartnerCodeUsedEmail,
  renderPartnerMonthlyInvoiceEmail,
  renderAdminMonthlyInvoiceEmail,
  renderSubscriptionWelcomeEmail,
  renderOwnerSubscriptionEmail,
  renderSubscriptionUpdatedEmail,
  renderSubscriptionManageEmail,
  renderSubscriptionHolidaySkipEmail,
  renderOwnerThursdayLockEmail,
  renderOwnerPaymentFailedEmail,
  renderSubscriptionWednesdayEmail,
  renderSubscriptionThursdayEmail,
  renderSubscriptionPriceEmail,
  getEmailLogoUrl,
};

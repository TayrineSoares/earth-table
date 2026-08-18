/**
 * Writes HTML previews of transactional emails to backend/email-previews/
 * Open the files in a browser. Re-run after template edits:
 *   node scripts/preview-emails.js
 */
const fs = require('fs');
const path = require('path');
const {
  renderCustomerOrderEmail,
  renderOwnerOrderEmail,
  renderPartnerWelcomeEmail,
  renderAdminPartnerWelcomeEmail,
  renderPartnerCodeUsedEmail,
  renderPartnerMonthlyInvoiceEmail,
  renderAdminMonthlyInvoiceEmail,
} = require('../src/utils/emailTemplates');

const outDir = path.join(__dirname, '../email-previews');
const logoRel = '../assets/email/high-logo-2.png';

function withLocalLogo(html) {
  return html.replace(/cid:earth-table-logo/g, logoRel);
}

const files = [];

function write(name, html) {
  const dest = path.join(outDir, name);
  fs.writeFileSync(dest, withLocalLogo(html));
  files.push(name);
  console.log(dest);
}

const sampleOrder = {
  id: 329,
  status: 'processing',
  buyer_email: 'tayrinecristina2@gmail.com',
  buyer_name: 'John Smith',
  buyer_phone_number: '4165550101',
  total_cents: 4803,
  item_subtotal_cents: 5000,
  credit_applied_cents: 0,
  referral_code: 'JOSH15',
  pickup_date_formatted: 'August 20, 2026',
  pickup_time_slot: '12:00 PM – 4:00 PM',
  delivery: false,
  special_note: 'Please leave at the side door.',
  user: { first_name: 'Tayrine', last_name: 'Soares' },
  cardholder_name: 'John Smith',
  buyer_stripe_payment_info: JSON.stringify({
    discount_meta: {
      kind: 'referral',
      code: 'JOSH15',
      percent: 15,
      amount_off_cents: 750,
    },
  }),
  products: [
    { slug: 'Seasonal Soup', quantity: 2, unit_price_cents: 1500 },
    { slug: 'Sourdough Loaf', quantity: 1, unit_price_cents: 2000 },
  ],
};

const partner = { referral_code: 'JOSH15' };
const partnerUser = {
  first_name: 'Tayrine',
  last_name: 'Soares',
  email: 'tayrinecristina@hotmail.com',
  phone_number: '4165550199',
};
const invoice = {
  cash_cents: 1200,
  credit_cents: 600,
  total_cents: 1800,
};
const referredOrders = [
  {
    order_date: '2026-08-04T15:00:00.000Z',
    customer_name: 'Tayrine Soares',
    cardholder_name: 'John Smith',
    amount_cents: 500,
    payout_type: 'cash',
  },
  {
    order_date: '2026-08-12T15:00:00.000Z',
    customer_name: 'Alex Kim',
    amount_cents: 700,
    payout_type: 'cash',
  },
  {
    order_date: '2026-08-18T15:00:00.000Z',
    customer_name: 'Sam Lee',
    amount_cents: 600,
    payout_type: 'credit',
  },
];

fs.mkdirSync(outDir, { recursive: true });

write('01-customer-order.html', renderCustomerOrderEmail(sampleOrder).html);
write('02-owner-order.html', renderOwnerOrderEmail(sampleOrder, {
  partnerEarn: {
    name: 'Tayrine Soares',
    first_name: 'Tayrine',
    code: 'JOSH15',
    cashback_cents: 500,
    item_subtotal_cents: 5000,
  },
}).html);
write('03-partner-welcome.html', renderPartnerWelcomeEmail(partner, partnerUser).html);
write('04-admin-partner-welcome.html', renderAdminPartnerWelcomeEmail(partner, partnerUser).html);
write('05-partner-code-used.html', renderPartnerCodeUsedEmail({
  partner,
  partnerUser,
  order: sampleOrder,
  earn: { amount_cents: 500, payout_type: 'cash' },
}).html);
write('06-partner-monthly.html', renderPartnerMonthlyInvoiceEmail({
  invoice,
  partner,
  user: partnerUser,
  periodLabel: 'August 2026',
  orders: referredOrders,
}).html);
write('07-admin-monthly.html', renderAdminMonthlyInvoiceEmail({
  invoice,
  partner,
  user: partnerUser,
  periodLabel: 'August 2026',
  orders: referredOrders,
}).html);

const labels = {
  '01-customer-order.html': 'Customer order confirmation',
  '02-owner-order.html': 'Owner new order',
  '03-partner-welcome.html': 'Partner welcome',
  '04-admin-partner-welcome.html': 'Admin: new partner',
  '05-partner-code-used.html': 'Partner code used',
  '06-partner-monthly.html': 'Partner monthly statement',
  '07-admin-monthly.html': 'Admin monthly invoice',
};

fs.writeFileSync(path.join(outDir, 'index.html'), `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Email previews</title></head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;line-height:1.6;">
  <h1>Earth Table email previews</h1>
  <ol>
    ${files.map((name) => `<li><a href="./${name}">${labels[name] || name}</a></li>`).join('\n    ')}
  </ol>
</body></html>`);

console.log('\nOpen http://localhost:8080/email-previews/');

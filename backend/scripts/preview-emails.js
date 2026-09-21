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
  renderSubscriptionWelcomeEmail,
  renderOwnerSubscriptionEmail,
  renderSubscriptionUpdatedEmail,
  renderSubscriptionManageEmail,
  renderSubscriptionWednesdayEmail,
  renderSubscriptionThursdayEmail,
  renderSubscriptionHolidaySkipEmail,
  renderOwnerThursdayLockEmail,
  renderOwnerStatusEmail,
  renderOwnerPlanChangedEmail,
  renderOwnerFulfillmentEmail,
  renderOwnerPaymentFailedEmail,
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

const partner = {
  referral_code: 'JOSH15',
  discount_percent: 15,
  cashback_percent: 12,
};
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

const subMail = {
  firstName: 'Tayrine',
  lastName: 'Soares',
  mealCount: 10,
  planPriceCents: 18000,
  delivery: false,
  deliveryLabel: 'Sunday, September 20',
  pickupSlot: '10:00-13:00',
  cutoffLabel: 'Thursday, September 17 at 5:00 PM ET',
  chargeLabel: 'Wednesday, September 16 at 9:00 AM ET',
  subscriptionId: 'preview',
  subscribedAtLabel: 'Wednesday, September 16, 2026 at 2:14 PM',
  paidCents: 20340,
  meals: [
    { slug: 'Harvest Bowl', quantity: 4 },
    { slug: 'Citrus Salad', quantity: 3 },
    { slug: 'Herb Chicken Plate', quantity: 3 },
  ],
  addons: [{ slug: 'Green Smoothie', quantity: 2 }],
  email: 'tayrine.a@email.com',
  phone: '6475550148',
  notes: 'No nut allergy flagged · Dairy: OK',
  appliesTo: 'this_sunday',
  address: '12 Bartlett Ave, Toronto',
  discountCode: 'TAYRINE15',
  discountKind: 'referral',
  discountLabel: 'Referral (TAYRINE15)',
  planSavedCents: 9000,
  addonSavedCents: 2750,
  addonRegularCents: 5500,
};
write('09-subscription-welcome.html', renderSubscriptionWelcomeEmail(subMail).html);
write('10-subscription-owner.html', renderOwnerSubscriptionEmail(subMail).html);
write('11-subscription-updated.html', renderSubscriptionUpdatedEmail(subMail).html);
write('12-subscription-paused.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'pause_now',
}).html);
write('12b-subscription-paused-next.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'pause_next',
}).html);
write('12c-subscription-pause-nudge.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'pause_nudge',
  unsubscribeHref: 'http://localhost:5173/unsubscribe?token=preview',
}).html);
write('12d-subscription-resume.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'resume',
}).html);
write('12e-subscription-cancel.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'cancel_now',
}).html);
write('12f-subscription-cancel-last-box.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'cancel_next',
  lastBox: true,
}).html);
write('12g-subscription-payment-failed.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'payment_failed',
  planPrice: '$180.00',
  cardBrand: 'visa',
  last4: '4242',
}).html);
write('12h-subscription-plan-up.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'plan_now',
  oldMealCount: 10,
  nextMealCount: 15,
  oldPrice: '$180.00',
  newPrice: '$270.00',
  effectiveDate: 'Sunday, September 20',
  nextChargeDate: 'Wednesday, September 23 at 9:00 AM ET',
  difference: 5,
}).html);
write('12i-subscription-plan-down.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'plan_now',
  oldMealCount: 15,
  nextMealCount: 10,
  oldPrice: '$270.00',
  newPrice: '$180.00',
  effectiveDate: 'Sunday, September 27',
  nextChargeDate: 'Wednesday, September 23 at 9:00 AM ET',
}).html);
write('12j-subscription-delivery.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'fulfillment_delivery',
  address: subMail.address,
}).html);
write('12k-subscription-pickup.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'fulfillment_pickup',
}).html);
write('12l-subscription-card-expiry.html', renderSubscriptionManageEmail({
  ...subMail,
  kind: 'card_expiry',
  cardBrand: 'visa',
  last4: '4242',
  expMonth: '10',
  expYear: 2026,
}).html);
write('13-subscription-wednesday.html', renderSubscriptionWednesdayEmail({
  ...subMail,
  charged: true,
  planCents: 18000,
  deliveryCents: 800,
  chargedCents: 21234,
  cardBrand: 'visa',
  last4: '4242',
  unsubscribeHref: 'http://localhost:5173/unsubscribe?token=preview',
}).html);
write('13b-subscription-wednesday-paid.html', renderSubscriptionWednesdayEmail({
  ...subMail,
  charged: false,
  unsubscribeHref: 'http://localhost:5173/unsubscribe?token=preview',
}).html);
write('14-subscription-thursday.html', renderSubscriptionThursdayEmail({
  ...subMail,
  delivery: true,
  address: subMail.address,
  notes: subMail.address,
  chargedAddons: true,
  addonCents: 5500,
  discountCents: 1210,
  discountLabel: 'Promo (PROMOTEST22) · first week only',
  chargedCents: 4848,
  addonItems: subMail.addons,
  cardBrand: 'visa',
  last4: '4242',
}).html);
write('14b-subscription-thursday-no-extras.html', renderSubscriptionThursdayEmail({
  ...subMail,
  chargedAddons: false,
  addonItems: [],
}).html);
write('15-holiday-user.html', renderSubscriptionHolidaySkipEmail({
  firstName: 'Tayrine',
  skippedSunday: 'Sunday, December 27',
  nextSunday: 'Sunday, January 3',
}).html);
write('15b-holiday-owner.html', renderSubscriptionHolidaySkipEmail({
  skippedSunday: 'Sunday, December 27',
  nextSunday: 'Sunday, January 3',
  owner: true,
}).html);
write('16-owner-thursday.html', renderOwnerThursdayLockEmail({
  sunday: 'Sunday, September 20',
  boxes: [
    {
      name: 'Tayrine Soares',
      mealCount: 10,
      delivery: false,
      method: 'Pickup',
      windowStart: '10:00 AM',
      windowEnd: '1:00 PM',
      address: '77 Woodstream Blvd, Vaughan, ON L4L 7Y7',
      phone: '6475550148',
      email: 'tayrine.a@email.com',
      notes: 'No nuts',
      meals: subMail.meals,
      extras: subMail.addons,
    },
    {
      name: 'Alex Kim',
      mealCount: 15,
      delivery: true,
      method: 'Delivery',
      windowStart: '11:00 AM',
      windowEnd: '6:00 PM',
      address: '88 Clinton St, Toronto',
      phone: '4165550199',
      email: 'alex@email.com',
      meals: [{ slug: 'Harvest Bowl', quantity: 15 }],
      extras: [],
    },
  ],
}).html);
write('17-owner-paused.html', renderOwnerStatusEmail({
  kind: 'paused',
  customerName: 'Tayrine Soares',
  mealCount: 10,
  price: '$180.00',
  dateTime: 'Friday, September 18, 2026 at 3:02 PM',
  weeks: 6,
  lifetimeValue: '$1,080.00',
}).html);
write('17c-owner-resumed.html', renderOwnerStatusEmail({
  kind: 'resumed',
  customerName: 'Tayrine Soares',
  mealCount: 10,
  price: '$180.00',
  dateTime: 'Friday, September 18, 2026 at 3:02 PM',
  weeks: 6,
  lifetimeValue: '$1,080.00',
}).html);
write('17b-owner-cancelled.html', renderOwnerStatusEmail({
  kind: 'cancelled',
  customerName: 'Tayrine Soares',
  mealCount: 10,
  price: '$180.00',
  dateTime: 'Friday, September 18, 2026 at 3:02 PM',
  lastBoxDate: 'Sunday, September 20',
  lastBoxPaid: true,
  weeks: 6,
  lifetimeValue: '$1,080.00',
}).html);
write('18-owner-plan.html', renderOwnerPlanChangedEmail({
  customerName: 'Tayrine Soares',
  oldMealCount: 10,
  newMealCount: 15,
  oldPriceCents: 18000,
  newPriceCents: 27000,
  effectiveDate: 'Sunday, September 20',
  selectedCount: 10,
}).html);
write('19-owner-fulfillment.html', renderOwnerFulfillmentEmail({
  customerName: 'Tayrine Soares',
  oldMethod: 'pickup',
  newMethod: 'delivery',
  fulfillmentDate: 'Sunday, September 20',
  address: '12 Bartlett Ave, Toronto',
  windowStart: '11:00 AM',
  windowEnd: '6:00 PM',
}).html);
write('20-owner-payment-failed.html', renderOwnerPaymentFailedEmail({
  customerName: 'Tayrine Soares',
  amount: '$180.00',
  fulfillmentDate: 'Sunday, September 20',
  cardBrand: 'visa',
  last4: '4242',
  declineReason: 'insufficient_funds',
  dateTime: 'Wednesday, September 16, 2026 at 9:01 AM',
  cutoffDateTime: 'Thursday, September 17 at 5:00 PM ET',
}).html);

const labels = {
  '01-customer-order.html': 'Customer order confirmation',
  '02-owner-order.html': 'Owner new order',
  '03-partner-welcome.html': 'Partner welcome',
  '04-admin-partner-welcome.html': 'Admin: new partner',
  '05-partner-code-used.html': 'Partner code used',
  '06-partner-monthly.html': 'Partner monthly statement',
  '07-admin-monthly.html': 'Admin monthly invoice',
  '08-confirm-signup.html': 'Confirm signup (Supabase Auth)',
  '09-subscription-welcome.html': '1. Welcome',
  '10-subscription-owner.html': '13. Owner: new subscription',
  '11-subscription-updated.html': '4. Box updated',
  '12-subscription-paused.html': '5. Paused',
  '12b-subscription-paused-next.html': '5. Paused after charge',
  '12c-subscription-pause-nudge.html': '6. Pause reminder',
  '12d-subscription-resume.html': '7. Resumed',
  '12e-subscription-cancel.html': '8. Cancelled',
  '12f-subscription-cancel-last-box.html': '8. Cancelled, last box remains',
  '12g-subscription-payment-failed.html': '9. Payment failed',
  '12h-subscription-plan-up.html': '10. Plan upgrade',
  '12i-subscription-plan-down.html': '10. Plan downgrade',
  '12j-subscription-delivery.html': '11. Switched to delivery',
  '12k-subscription-pickup.html': '11. Switched to pickup',
  '12l-subscription-card-expiry.html': '12. Card expiring',
  '13-subscription-wednesday.html': '2. Wednesday charge + reminder',
  '13b-subscription-wednesday-paid.html': '2. Wednesday reminder (already paid)',
  '14-subscription-thursday.html': '3. Thursday lock + extras',
  '14b-subscription-thursday-no-extras.html': '3. Thursday lock, no extras',
  '15-holiday-user.html': 'Holiday skip (customer)',
  '15b-holiday-owner.html': 'Holiday skip (owner)',
  '16-owner-thursday.html': '14. Owner Thursday prep',
  '17-owner-paused.html': '15. Owner paused',
  '17c-owner-resumed.html': '15. Owner resumed',
  '17b-owner-cancelled.html': '15. Owner cancelled',
  '18-owner-plan.html': '16. Owner plan changed',
  '19-owner-fulfillment.html': '17. Owner fulfillment',
  '20-owner-payment-failed.html': '18. Owner payment failed',
};

const confirmSignupPreview = '08-confirm-signup.html';
if (fs.existsSync(path.join(outDir, confirmSignupPreview))) {
  files.push(confirmSignupPreview);
}

fs.writeFileSync(path.join(outDir, 'index.html'), `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Email previews</title></head>
<body style="font-family:Arial,sans-serif;max-width:560px;margin:40px auto;line-height:1.6;">
  <h1>Earth Table email previews</h1>
  <ol>
    ${files.map((name) => `<li><a href="./${name}">${labels[name] || name}</a></li>`).join('\n    ')}
  </ol>
</body></html>`);

console.log('\nOpen http://localhost:8080/email-previews/');

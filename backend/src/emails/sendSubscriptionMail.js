const { sendEmail, ownerNotificationEmails } = require('../utils/email');

function emailPrefOn(user, key) {
  const prefs = user?.email_prefs && typeof user.email_prefs === 'object' ? user.email_prefs : {};
  if (prefs[key] === false) return false;
  return true;
}

function monitoredFrom() {
  return process.env.CONTACT_FROM || 'Earth Table <hello@earthtableco.ca>';
}

async function sendCustomerEmail({ to, msg, replyOk = false, from }) {
  if (!to || !msg) return;
  await sendEmail({
    to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: 'hello@earthtableco.ca',
    from: from || undefined,
  });
}

async function sendOwnerEmail(msg) {
  const to = ownerNotificationEmails();
  if (!to.length || !msg) return;
  await sendEmail({
    to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: 'hello@earthtableco.ca',
  });
}

async function cardForPaymentMethod(paymentMethodId) {
  if (!paymentMethodId) return null;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!pm?.card?.last4) return null;
    return {
      brand: pm.card.brand || 'card',
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  } catch (err) {
    console.warn('[subscriptions] card lookup failed:', err.message);
    return null;
  }
}

function declineReasonFrom(err) {
  return err?.decline_code || err?.code || err?.raw?.decline_code || err?.raw?.code || 'card_declined';
}

module.exports = {
  emailPrefOn,
  monitoredFrom,
  sendCustomerEmail,
  sendOwnerEmail,
  cardForPaymentMethod,
  declineReasonFrom,
};

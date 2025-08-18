// api/stripe-webhook.js
const Stripe = require('stripe');
const getRawBody = require('raw-body');

const { createOrderWithProducts, getOrderByStripeSessionId } = require('../src/queries/order');
const { sendEmail } = require('../src/utils/email');
const { renderCustomerOrderEmail, renderOwnerOrderEmail } = require('../src/utils/emailTemplates');
const { getUserByAuthId } = require('../src/queries/user');

const stripe = Stripe(process.env.STRIPE_SECRET_SK);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let buf;
  try {
    buf = await getRawBody(req);
  } catch {
    return res.status(400).send('Invalid body');
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook signature verify failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};

      let buyerPhoneNumber = session.customer_details?.phone || null;
      const email =
        session.customer_email ||
        session.customer_details?.email ||
        metadata.email ||
        'unknown';
      const buyerName = session.customer_details?.name || null;

      const userId = metadata.userId || null;
      const pickupDate = metadata.pickup_date || null;
      const pickupSlot = metadata.pickup_time_slot || null;
      const specialNote = metadata.special_note || null;
      const delivery = metadata.delivery || false;

      const cart = JSON.parse(metadata.cart || '[]');

      if (userId) {
        const user = await getUserByAuthId(userId);
        if (user) {
          buyerPhoneNumber = user.phone_number || buyerPhoneNumber;
        }
      }

      await createOrderWithProducts({
        user_id: userId || null,
        buyer_email: email,
        buyer_name: buyerName,
        buyer_phone_number: buyerPhoneNumber,
        buyer_stripe_payment_info: JSON.stringify({
          session_id: session.id,
          payment_intent: session.payment_intent,
          amount_total: session.amount_total,
          currency: session.currency,
          payment_status: session.payment_status,
          customer_name: session.customer_details?.name || '',
          customer_phone: session.customer_details?.phone || '',
          customer_address: session.customer_details?.address || {}
        }),
        status: session.payment_status,
        stripe_session_id: session.id,
        total_cents: session.amount_total,
        products: cart,
        pickup_date: pickupDate,
        pickup_time_slot: pickupSlot,
        delivery,
        special_note: specialNote,
      });

      const detailedOrder = await getOrderByStripeSessionId(session.id);

      // Customer email
      const { subject, html, text } = renderCustomerOrderEmail(detailedOrder);
      await sendEmail({
        to: email,
        subject,
        html,
        text,
        replyTo: 'hello@earthtableco.ca'
      });

      // Owner email
      const ownerTo = (process.env.OWNER_NOTIFICATIONS_TO || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const ownerMsg = renderOwnerOrderEmail(detailedOrder);
      await sendEmail({
        to: ownerTo,
        subject: ownerMsg.subject,
        html: ownerMsg.html,
        text: ownerMsg.text,
      });
    } else {
      console.log(`Skipped event: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).send('Internal Server Error');
  }
};

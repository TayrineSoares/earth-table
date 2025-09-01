// backend/api/webhook.js
// Stripe webhook for production on Vercel (serverless).
// SAFE MODE:
// - Verifies Stripe signature using RAW body
// - Only creates an order if metadata.cart is a non-empty array
// - Emails are skipped unless SEND_EMAILS !== 'false'

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_SK);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const { createOrderWithProducts, getOrderByStripeSessionId } = require('../src/queries/order');
const { getUserByAuthId } = require('../src/queries/user');
const { sendEmail } = require('../src/utils/email');
const { renderCustomerOrderEmail, renderOwnerOrderEmail } = require('../src/utils/emailTemplates');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  // Read RAW body for signature verification
  let rawBody;
  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    rawBody = Buffer.concat(chunks);
  } catch (err) {
    console.error('Failed to read raw body:', err);
    res.statusCode = 400;
    return res.end('Invalid body');
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.statusCode = 400;
    return res.end(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('✅ checkout.session.completed received. session.id =', session.id);

      const metadata = session.metadata || {};
      const pickupDate = metadata.pickup_date || null;
      const pickupSlot = metadata.pickup_time_slot || null;
      const specialNote = metadata.special_note || null;
      const delivery = metadata.delivery || false;

      let buyerPhoneNumber = session.customer_details?.phone || null;``
      const email =
        session.customer_email ||
        session.customer_details?.email ||
        metadata.email ||
        'unknown';
      const buyerName = session.customer_details?.name || null;
      const userId = metadata.userId || null;

      // Parse cart from metadata (expected from your frontend checkout)
      let cart = [];
      try {
        cart = JSON.parse(metadata.cart || '[]');
      } catch (e) {
        cart = [];
      }

      if (!Array.isArray(cart) || cart.length === 0) {
        console.warn('ℹ️ No cart in metadata; skipping order creation (safe mode).');
        res.statusCode = 200;
        return res.end('ok');
      }

      if (userId) {
        try {
          const user = await getUserByAuthId(userId);
          if (user) buyerPhoneNumber = user.phone_number || buyerPhoneNumber;
        } catch (e) {
          console.warn('Could not fetch user by auth id:', e?.message || e);
        }
      }

      try {
        // Create order
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
            customer_address: session.customer_details?.address || {},
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

        // Email sending is gated by env
        const sendEmails = String(process.env.SEND_EMAILS || '').toLowerCase() !== 'false';
        if (sendEmails) {
          // customer email
          const { subject, html, text } = renderCustomerOrderEmail(detailedOrder);
          const c1 = await sendEmail({
            to: email,
            subject,
            html,
            text,
            replyTo: 'hello@earthtableco.ca',
          });
          console.log('[ORDER EMAIL][customer]', c1?.data?.id || c1);

          // owner email
          const ownerTo = (process.env.OWNER_NOTIFICATIONS_TO || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const ownerMsg = renderOwnerOrderEmail(detailedOrder);
          const c2 = await sendEmail({
            to: ownerTo,
            subject: ownerMsg.subject,
            html: ownerMsg.html,
            text: ownerMsg.text,
          });
          console.log('[ORDER EMAIL][owner]', c2?.data?.id || c2);
        } else {
          console.log('✉️ SEND_EMAILS=false — skipping email sends.');
        }
      } catch (err) {
        console.error('Failed to persist order or send emails:', err);
        // Acknowledge 200 to avoid endless Stripe retries
      }
    } else {
      console.log(`Skipped event: ${event.type}`);
    }

    res.statusCode = 200;
    res.end('ok');
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};

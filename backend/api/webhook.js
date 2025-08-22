// Minimal Stripe webhook that ONLY verifies the signature and returns 200.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_SK);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('Method Not Allowed');
    return;
  }

  // Read RAW body (critical for Stripe signature verification)
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
    res.end('Invalid body');
    return;
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.statusCode = 400;
    res.end(`Webhook Error: ${err.message}`);
    return;
  }

  console.log('✅ Stripe event received:', event.type);
  res.statusCode = 200;
  res.end('ok');
};

// backend/api/webhook.js
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_SK);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  // raw body for signature verification
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
      // no DB or emails yet — just logging
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

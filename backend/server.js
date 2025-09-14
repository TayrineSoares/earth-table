// server.js (updated)

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const supabase = require('./supabase/db');
const { createOrderWithProducts, getOrderByStripeSessionId } = require('./src/queries/order');
const { sendEmail } = require('./src/utils/email');
const { renderCustomerOrderEmail, renderOwnerOrderEmail } = require('./src/utils/emailTemplates');

const categoriesRouter = require('./src/routes/categoriesRoutes');
const productsRouter = require('./src/routes/productsRoutes');
const ordersRouter = require('./src/routes/ordersRoutes');
const usersRouter = require('./src/routes/usersRoutes');
const loginRouter = require('./src/routes/loginRoutes');
const registerRouter = require('./src/routes/registerRoutes');
const logoutRouter = require('./src/routes/logoutRoutes');
const contactRouter = require('./src/routes/contactRoutes');
const tagsRouter = require('./src/routes/tagsRoutes');
const cartRouter = require('./src/routes/cartRoutes');
const testEmail = require('./src/routes/testEmail');
const deliveryQuote = require('./api/delivery/quote');
const { getUserByAuthId } = require('./src/queries/user');
const { getServerDeliveryQuote } = require('./src/lib/deliveryQuote');

require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
const PORT = process.env.PORT || 8080;

// single source of truth for where the frontend lives
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// --- Stripe Webhook Handler (shared) ---
// IMPORTANT: This handler expects the request body to be raw (NOT JSON-parsed).
const stripeWebhookHandler = async (request, response) => {
  console.log('[webhook] Express handler active at path:', request.path);
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    console.error(`[webhook] signature verification failed: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type !== 'checkout.session.completed') {
      console.log('[webhook] skipped event:', event.type);
      return response.status(200).send('ok');
    }

    console.log('[webhook] checkout.session.completed received');
    const session = event.data.object;
    const md = session.metadata || {};

    // Idempotency guard: bail if we already created an order for this session
    const existing = await getOrderByStripeSessionId(session.id);
    if (existing) {
      console.log('[webhook] order already exists for session:', session.id);
      return response.status(200).send('ok');
    }

    // Try to load the big payload from checkout_drafts via metadata.draft_id
    const draftId = md.draft_id || null;
    let draft = null;
    if (draftId) {
      const { data: d, error: dErr } = await supabase
        .from('checkout_drafts')
        .select('*')
        .eq('id', draftId)
        .maybeSingle();

      if (!dErr && d) draft = d;
      console.log('[webhook] using draft_id:', draftId, 'found:', !!d);
    } else {
      console.log('[webhook] no draft_id present in metadata');
    }

    // Derive values with sane fallbacks (prefer draft when present)
    const delivery = draft?.delivery ?? (String(md.delivery).toLowerCase() === 'true');
    const deliveryDate = draft?.delivery_date || md.delivery_date || null;
    const deliveryPostal = md.delivery_postal_code || draft?.delivery_postal_code || '';
    const deliveryKm = md.delivery_km || '';
    const deliveryFeeCentsServer = md.delivery_fee_cents_server || '0';

    const pickupDate = md.pickup_date || null;
    const pickupSlot = md.pickup_time_slot || null;

    const specialNote = (draft?.special_note ?? md.special_note ?? null) || null;

    // Cart: from draft if available; otherwise parse metadata.cart (legacy fallback)
    let cart = Array.isArray(draft?.cart) ? draft.cart : [];
    if (!cart.length && md.cart) {
      try { cart = JSON.parse(md.cart); } catch { cart = []; }
    }

    console.log('[webhook] delivery:', delivery, 'delivery_date:', deliveryDate);

    // Buyer info
    let buyerPhoneNumber = session.customer_details?.phone || null;
    const email =
      session.customer_email ||
      session.customer_details?.email ||
      md.email ||
      'unknown';
    const buyerName = session.customer_details?.name || '';
    const userId = md.userId || null;

    if (userId) {
      try {
        const user = await getUserByAuthId(userId);
        if (user) {
          buyerPhoneNumber = user.phone_number || buyerPhoneNumber;
        }
      } catch (e) {
        console.warn('[webhook] getUserByAuthId failed (non-fatal):', e.message);
      }
    }

    // Create order
    try {
      await createOrderWithProducts({
        user_id: userId || null,
        buyer_email: email,
        buyer_name: buyerName,
        buyer_phone_number: buyerPhoneNumber,

        // store raw Stripe info (helpful for support/debugging)
        buyer_stripe_payment_info: JSON.stringify({
          session_id: session.id,
          payment_intent: session.payment_intent,
          amount_total: session.amount_total,
          currency: session.currency,
          payment_status: session.payment_status,
          customer_name: session.customer_details?.name || '',
          customer_phone: session.customer_details?.phone || '',
          customer_address: session.customer_details?.address || {},
          draft_id: draftId || null,
          delivery_meta: {
            postal_code: deliveryPostal,
            km: deliveryKm,
            fee_cents_server: Number(deliveryFeeCentsServer || 0),
            delivery_flag: delivery,
          },
        }),

        status: session.payment_status,
        stripe_session_id: session.id,
        total_cents: session.amount_total,

        // order data
        products: cart,
        pickup_date: pickupDate,
        pickup_time_slot: pickupSlot,
        delivery,
        delivery_date: deliveryDate,
        special_note: specialNote,
      });

      // Fetch full order for emails
      const detailedOrder = await getOrderByStripeSessionId(session.id);

      // Customer email
      const { subject, html, text } = renderCustomerOrderEmail(detailedOrder);
      await sendEmail({
        to: email,
        subject,
        html,
        text,
        replyTo: 'hello@earthtableco.ca',
      });

      // Owner email(s)
      const ownerTo = (process.env.OWNER_NOTIFICATIONS_TO || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const ownerMsg = renderOwnerOrderEmail(detailedOrder);
      if (ownerTo.length) {
        await sendEmail({
          to: ownerTo,
          subject: ownerMsg.subject,
          html: ownerMsg.html,
          text: ownerMsg.text,
        });
      }

      // Best-effort cleanup: remove the draft now that it's used
      if (draftId) {
        await supabase.from('checkout_drafts').delete().eq('id', draftId);
      }
    } catch (err) {
      console.error('[webhook] Failed to save order or send emails:', err.message);
      // Still 200 so Stripe won't retry forever if it's a non-retriable error.
      // If you prefer retries, you can 500 here—but make sure your code is idempotent.
    }

    return response.status(200).send('ok');
  } catch (err) {
    console.error('[webhook] processing error:', err);
    return response.status(500).send('Server error');
  }
};

// --- Mount webhook routes BEFORE express.json() ---
app.post('/webhook',     express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.post('/api/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// CORS & middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'https://www.earthtableco.ca',
    'https://earth-table-frontend.vercel.app',
  ],
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());

// Test and root routes
app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.get('/cart', (req, res) => {
  res.json({
    message: 'Cart route works!',
    items: []
  });
});

// Create Checkout Session
const createCheckoutSession = async (req, res) => {
  const {
    cartItems, email, userId, pickup_date, pickup_time_slot, special_note,
    delivery, delivery_postal_code, delivery_date,
  } = req.body;

  console.log('[checkout] delivery:', delivery, 'postal:', delivery_postal_code);
  console.log('[checkout] delivery_date:', delivery_date);

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  try {
    // Build line items with tax included (13%)
    const items = cartItems.map(item => ({
      price_data: {
        currency: 'cad',
        product_data: { name: `${item.slug} (includes tax)`, images: [item.image_url] },
        unit_amount: Math.round(item.price_cents * 1.13),
      },
      quantity: item.quantity,
    }));

    let deliveryFeeCentsServer = 0;
    let deliveryKm = null;

    if (delivery) {
      // require a valid delivery_date when delivery is selected
      if (!delivery_date || !ISO_DATE.test(delivery_date)) {
        return res.status(400).json({ error: "delivery_date (YYYY-MM-DD) is required for delivery." });
      }
      if (!special_note || special_note.trim().length < 8) {
        return res.status(400).json({ error: "Please enter your full delivery address." });
      }

      const quote = await getServerDeliveryQuote(delivery_postal_code);
      if (!quote.ok) {
        return res.status(400).json({
          error: quote.reason === 'OUT_OF_ZONE'
            ? 'Delivery not available for this address.'
            : 'Invalid delivery postal code.',
        });
      }

      deliveryFeeCentsServer = quote.fee_cents;
      deliveryKm = quote.km;

      console.log('[delivery] postal:', delivery_postal_code, 'km:', deliveryKm, 'fee_cents:', deliveryFeeCentsServer);

      // Push delivery fee line item (includes tax)
      items.push({
        price_data: {
          currency: 'cad',
          product_data: { name: 'Delivery fee (includes tax)' },
          unit_amount: Math.round(deliveryFeeCentsServer * 1.13),
        },
        quantity: 1,
      });
    }

    // Stash large payload in DB, keep Stripe metadata small
    const { data: draft, error: draftErr } = await supabase
      .from('checkout_drafts')
      .insert([{
        user_id: userId || null,
        email: email || null,
        cart: cartItems,          // full cart (no metadata limit here)
        special_note,             // long text ok
        delivery: !!delivery,
        delivery_date: delivery ? delivery_date : null,
        delivery_postal_code: delivery_postal_code || null,
      }])
      .select('id')
      .single();

    if (draftErr) {
      console.error('Failed to create checkout_draft', draftErr);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items,
      mode: 'payment',
      success_url: `${FRONTEND_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cart`,
      ...(email ? { customer_email: email } : {}),
      phone_number_collection: { enabled: true },
      // Keep metadata tiny — Stripe limit applies
      metadata: {
        draft_id: draft.id,   // reference to big payload in DB
        email: email || '',
        userId: userId || '',
        pickup_date: pickup_date || '',
        pickup_time_slot: pickup_time_slot || '',
        delivery: delivery ? 'true' : 'false',
        delivery_date: delivery ? delivery_date : '',
        delivery_postal_code: delivery_postal_code || '',
        delivery_fee_cents_server: String(deliveryFeeCentsServer || 0),
        delivery_km: deliveryKm != null ? String(deliveryKm) : '',
        
      },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe session creation failed', {
      type: error?.type,
      code: error?.code,
      param: error?.param,
      message: error?.message,
      raw: error?.raw?.message,
    });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// register BOTH paths for session creation
app.post('/create-checkout-session', createCheckoutSession);
app.post('/api/create-checkout-session', createCheckoutSession);

// ROUTES
app.use('/categories', categoriesRouter);
app.use('/products', productsRouter);
app.use('/orders', ordersRouter);
app.use('/api/orders', ordersRouter);
app.use('/users', usersRouter);
app.use('/login', loginRouter);
app.use('/register', registerRouter);
app.use('/logout', logoutRouter);
app.use('/contact', contactRouter);
app.use('/tags', tagsRouter);
app.use('/cart', cartRouter);
app.use('/dev', testEmail);

app.post('/delivery/quote', deliveryQuote);
app.post('/api/delivery/quote', deliveryQuote);

// Export the Express app for Vercel / serverless usage
module.exports = app;

// Only listen when running locally (node server.js or npm run start)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
    // lightweight env sanity logs (non-secret presence checks)
    console.log('[env] FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('[env] SUPABASE_URL present?', !!process.env.SUPABASE_URL);
    console.log('[env] SERVICE_ROLE_KEY present?', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('[env] STRIPE_WEBHOOK_SECRET present?', !!process.env.STRIPE_WEBHOOK_SECRET);
  });
}

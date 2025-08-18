// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const categoriesRouter = require('../../backend/src/routes/categoriesRoutes');
const productsRouter   = require('../../backend/src/routes/productsRoutes');
const ordersRouter     = require('../../backend/src/routes/ordersRoutes');
const usersRouter      = require('../../backend/src/routes/usersRoutes');
const loginRouter      = require('../../backend/src/routes/loginRoutes');
const registerRouter   = require('../../backend/src/routes/registerRoutes');
const logoutRouter     = require('../../backend/src/routes/logoutRoutes');
const contactRouter    = require('../../backend/src/routes/contactRoutes');
const tagsRouter       = require('../../backend/src/routes/tagsRoutes');
const cartRouter       = require('../../backend/src/routes/cartRoutes');
const testEmail        = require('../../backend/src/routes/testEmail');

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_SK);

// For success/cancel URLs at checkout (set on Vercel → Environment Variables)
// e.g. SITE_URL=https://your-app.vercel.app
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

const app = express();

// If frontend and backend share the same Vercel domain, you could tighten this,
// but leaving permissive for preview domains:
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json()); // OK here (webhook is handled in a separate function)

// Health/test routes
app.get('/', (req, res) => res.send('Backend is running'));
app.get('/cart', (req, res) => res.json({ message: 'Cart route works!', items: [] }));

// Create Checkout Session (unchanged, but uses SITE_URL)
app.post('/create-checkout-session', async (req, res) => {
  const { cartItems, email, userId, pickup_date, pickup_time_slot, special_note, delivery } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cartItems.map(item => ({
        price_data: {
          currency: 'cad',
          product_data: {
            name: `${item.slug} (includes tax)`,
            images: [item.image_url],
          },
          // includes HST
          unit_amount: Math.round(item.price_cents * 1.13),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${SITE_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cart`,
      ...(userId && email ? { customer_email: email } : {}),
      phone_number_collection: { enabled: true },
      metadata: {
        email: email || '',
        userId: userId || '',
        pickup_date: pickup_date || '',
        pickup_time_slot: pickup_time_slot || '',
        delivery: delivery || false,
        special_note: special_note || '',
        cart: JSON.stringify(cartItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price_cents: item.price_cents
        }))),
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe session creation failed', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Mount your existing routers
app.use('/categories', categoriesRouter);
app.use('/products',   productsRouter);
app.use('/orders',     ordersRouter);
app.use('/users',      usersRouter);
app.use('/login',      loginRouter);
app.use('/register',   registerRouter);
app.use('/logout',     logoutRouter);
app.use('/contact',    contactRouter);
app.use('/tags',       tagsRouter);
app.use('/cart',       cartRouter);
app.use('/dev',        testEmail);

module.exports = app;

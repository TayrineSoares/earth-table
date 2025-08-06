const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createOrderWithProducts } = require('./src/queries/order');
const { sendEmail } = require('./src/utils/email')
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

require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
const PORT = 8080;

//MAKE SURE THIS COMES BEFORE EXPRESS.JSON
// This route is called by Stripe (not the frontend) after a customer successfully pays
app.post('/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);

    //Log only the relevant event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      //console.log("Full checkout session:", JSON.stringify(session, null, 2));

      const metadata = session.metadata;
      const email = 
        session.customer_email || 
        session.customer_details?.email ||
        metadata?.email ||
        'unknown';
      const buyerName = session.customer_details?.name;

      const userId = metadata?.userId || null;
      const cart = JSON.parse(metadata?.cart || '[]');

      console.log("Payment succeeded");
      console.log("User email:", email);
      console.log("Cart:", cart);

      console.log("Stripe webhook received and parsed successfully");

       try {
        await createOrderWithProducts({
          user_id: userId || null,
          buyer_email: email,
          buyer_name: buyerName,
          buyer_phone_number: null,
          buyer_address: null,
          buyer_stripe_payment_info: JSON.stringify({
            session_id: session.id,
            payment_intent: session.payment_intent,
            amount_total: session.amount_total,
            currency: session.currency,
            payment_status: session.payment_status,
            customer_name: session.customer_details?.name || '',
            customer_address: session.customer_details?.address || {}
          }),
          status: session.payment_status,
          stripe_session_id: session.id,
          total_cents: session.amount_total,
          products: cart
        });

        console.log("Order saved to database");

        await sendEmail({
          // to: email, UPDATE THIS LINE AFTER REGISTERING DOMAIN
          to: 'earthtabledatabase@gmail.com',
          subject: "Order Confirmation - Earth Table",
          html: `
            <h2>Thank you for your order!</h2>
            <p>We've received your order and it's being processed.</p>
            <p>If you have any questions, feel free to reply to this email.</p>
            <p>🧡 Earth Table Team</p>
          `
        });

        // Send notification email to business
        await sendEmail({
          to: 'earthtabledatabase@gmail.com', // UPDATE THIS LINE AFTER REGISTERING DOMAIN to selena's email 
          subject: `🛒 New Order from ${email}`,
          html: `
            <h2>New Order Received</h2>
            <p>Email: ${email}</p>
            <p>Session ID: ${session.id}</p>
            <p>Total: $${(session.amount_total / 100).toFixed(2)}</p>
          `
        });


      } catch (err) {
        console.error("Failed to save order:", err.message);
      }
    } else {
      console.log(`Skipped event: ${event.type}`);
    }

    response.status(200).send();
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    response.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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




app.post('/create-checkout-session', async (req, res) => {
  const { cartItems, email, userId } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cartItems.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.slug,
            images: [item.image_url],
          },
          unit_amount: item.price_cents,
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: 'http://localhost:5173/confirmation?session_id={CHECKOUT_SESSION_ID}', // Stripe will replace {CHECKOUT_SESSION_ID} with the actual ID (e.g., cs_test_123abc...)
      cancel_url: 'http://localhost:5173/cart',
      ...(userId && email ? { customer_email: email } : {}), // add email if logged in, if not leave blank

      metadata: {
        email: email || '',
        userId: userId || '',
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



//ROUTES
app.use('/categories', categoriesRouter);

app.use('/products', productsRouter);

app.use('/orders', ordersRouter);

app.use('/users', usersRouter);

app.use('/login', loginRouter);

app.use('/register', registerRouter);

app.use('/logout', logoutRouter);

app.use('/contact', contactRouter);

app.use('/tags', tagsRouter);

app.use('/cart', cartRouter);




app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createOrderWithProducts, getOrderByStripeSessionId } = require('./src/queries/order');
const { sendEmail } = require('./src/utils/email')
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
const { getUserByAuthId } = require('./src/queries/user');

require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();
const PORT = 8080;


// single source of truth for where the frontend lives
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';


app.post('/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);

  
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const metadata = session.metadata;
      const pickupDate = metadata?.pickup_date || null;
      const pickupSlot = metadata?.pickup_time_slot || null;
      const specialNote = metadata?.special_note || null;
      const delivery = metadata?.delivery || false;
      let buyerPhoneNumber = session.customer_details?.phone || null;


      const email = 
        session.customer_email || 
        session.customer_details?.email ||
        metadata?.email ||
        'unknown';
      const buyerName = session.customer_details?.name;

      const userId = metadata?.userId || null;
      const cart = JSON.parse(metadata?.cart || '[]');

      if (userId) {
        const user = await getUserByAuthId(userId);
        if (user) {
          buyerPhoneNumber = user.phone_number|| buyerPhoneNumber;
        }
      }

       try {
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
          delivery: delivery,
          special_note: specialNote,
        });

        const detailedOrder = await getOrderByStripeSessionId(session.id);

        //Send email to customer
        const { subject, html, text } = renderCustomerOrderEmail(detailedOrder);
           
        await sendEmail({
          to: email,
          subject,
          html,
          text,
          replyTo: 'hello@earthtableco.ca'
  
        });
        
        // Send email to business notifying new order
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
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080'],
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
  const { cartItems, email, userId, pickup_date, pickup_time_slot, special_note, delivery } = req.body;
  

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: cartItems.map(item => ({
        price_data: {
          currency: 'cad',
          product_data: {
            name: `${item.slug} (includes tax)` ,
            images: [item.image_url],
          },
          unit_amount: Math.round(item.price_cents * 1.13),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${FRONTEND_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cart`,
      ...(userId && email ? { customer_email: email } : {}),
      phone_number_collection: { enabled: true },

      metadata: {
        email: email || '',
        userId: userId || '',
        pickup_date: pickup_date || '',
        pickup_time_slot: pickup_time_slot || '',
        delivery: delivery || false,
        special_note: special_note ||'',
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

app.use('/dev', testEmail);


// Export the Express app for Vercel / serverless usage
module.exports = app;

// Only listen when running locally (node server.js or npm run start)
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
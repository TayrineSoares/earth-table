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

      //console.log("Payment succeeded");
      //console.log("User email:", email);
      //console.log("Cart:", cart);

      //console.log("Stripe webhook received and parsed successfully");

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
          to: email, // later: to: email
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
          unit_amount: Math.round(item.price_cents * 1.13), // include 13% tax
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: 'http://localhost:5173/confirmation?session_id={CHECKOUT_SESSION_ID}', // Stripe will replace {CHECKOUT_SESSION_ID} with the actual ID (e.g., cs_test_123abc...)
      cancel_url: 'http://localhost:5173/cart',
      ...(userId && email ? { customer_email: email } : {}), // add email if logged in, if not leave blank
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




app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
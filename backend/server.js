const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
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

const app = express();
const PORT = 8080;

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
      success_url: 'http://localhost:5173/confirmation',
      cancel_url: 'http://localhost:5173/cart',
      metadata: {
        email: email || '',
        userId: userId || '',
        cart: JSON.stringify(cartItems),
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
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const categoriesRouter = require('./src/routes/categoriesRoutes');
const productsRouter = require('./src/routes/productsRoutes');
const ordersRouter = require('./src/routes/ordersRoutes')
const usersRouter = require('./src/routes/usersRoutes')
const loginRouter = require('./src/routes/loginRoutes')


const app = express();
const PORT = 8080;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Test and root routes
app.get('/', (req, res) => {
  res.send('Backend is running');
});


//ROUTES
app.use('/categories', categoriesRouter);

app.use('/products', productsRouter);

app.use('/orders', ordersRouter);

app.use('/users', usersRouter);

app.use('/login', loginRouter);


app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
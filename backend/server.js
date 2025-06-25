const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const categoriesRouter = require('./routes/categories');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Test and root routes
app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.get('/fakedata', (req, res) => {
  const data = [
    {
      id: 123,
      title: 'FAKE DATA TEST',
      instructions: 'Bacon ipsum dolor amet buffalo boudin ham...'
    }
  ];
  res.json(data);
});

// Use router for categories
app.use('/categories', categoriesRouter);

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
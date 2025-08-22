const express = require('express');
const app = require('../server'); // your existing Express app

// mount your app at /api so routes like /categories still match
const handler = express();
handler.use('/api', app);

module.exports = handler;

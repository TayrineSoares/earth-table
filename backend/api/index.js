const express = require('express');
const app = require('../app');

// mount your app at /api so routes like /categories still match
const handler = express();
handler.use('/api', app);

module.exports = handler;

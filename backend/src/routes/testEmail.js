const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/email')

router.get('/test-email', async (req, res) => {
  try {
    const response = await sendEmail({
      to: 'tayrinecristina@hotmail.com',
      subject: 'Earth Table: Test email',
      html: '<p>Hello again from Earth Table </p>',
      text: 'Hello from Earth Table',
      replyTo: 'hello@mail.earthtableco.ca'
    });
    res.json({ ok: true, id: response?.data?.id || 'sent' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
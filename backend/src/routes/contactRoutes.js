const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Earth Table Contact <onboarding@resend.dev>', // onboarding@resend.dev is allowed for unverified domains during testing UPDATE THIS AFTER 
      to: ['earthtabledatabase@gmail.com'], // UPDATE THIS TO SELENA'S EMAIL LATER
      subject: `New message from ${name}`,
      html: `
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
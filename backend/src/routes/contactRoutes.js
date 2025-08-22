const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const CONTACT_TO = (process.env.CONTACT_TO || 'earthtabledatabase@gmail.com')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const CONTACT_FROM = process.env.CONTACT_FROM || 'Earth Table Contact <hello@mail.earthtableco.ca>';

// Sanitizer so user input doesn't break email HTML
function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

  
router.post('/', async (req, res) => {
  const { name = '', email = '', message = '' } = req.body || {};

  const n = name.trim();
  const e = email.trim();
  const m = message.trim();

  if (!n || !e || !m) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  // email check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (!CONTACT_TO.length) {
    return res.status(500).json({ error: 'Contact destination not configured.' });
  }

  const safeName = escapeHtml(n);
  const safeEmail = escapeHtml(e);
  const safeMsgHtml = escapeHtml(m).replace(/\n/g, '<br>');

  const subject = `New message from ${safeName}`;
  const html = `
    <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
    <p><strong>Message:</strong></p>
    <p>${safeMsgHtml}</p>
  `;
  const text = `From: ${n} <${e}>\n\nMessage:\n${m}`;


  try {
    const { data, error } = await resend.emails.send({
      from: CONTACT_FROM, 
      to: CONTACT_TO,
      subject,
      html,
      text, 
      reply_to: e,
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
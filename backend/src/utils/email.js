const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email via Resend
 * @param {Object} params
 * @param {string|string[]} params.to - Recipient(s)
 * @param {string} params.subject
 * @param {string} [params.html] - HTML body
 * @param {string} [params.text] - Plain-text fallback
 * @param {string} [params.replyTo] - Reply-To address
 * @param {string|string[]} [params.cc]
 * @param {string|string[]} [params.bcc]
 * @param {string} [params.from] - Override default sender if needed
 */

async function sendEmail({ to, subject, html, text, replyTo, cc, bcc, from }) {
  try {
    const response = await resend.emails.send({
      from: 
        from || process.env.RESEND_FROM || 'Earth Table <orders@earthtableco.ca>',
      to,
      subject,
      html,
      text,
      reply_to: replyTo || process.env.CONTACT_FROM || 'Earth Table <hello@earthtableco.ca>',
      cc,
      bcc,
    });
    //console.log('Email sent:', response?.data?.id || response);
    return response;
  } catch (error) {
    // Resend often nests useful info here:
    const detail =
      error?.response?.data?.error?.message ||
      error?.message ||
      JSON.stringify(error);
    console.error('Failed to send email:', detail);
    throw error;
  }
}

module.exports = { sendEmail };
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email via Resend
 * @param {Object} params - The email data
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content of the email
 */

async function sendEmail({ to, subject, html }) {
  try {
    const response = await resend.emails.send({
      from: 'Earth Table <earthtabledatabase@gmail.com>', // Replace with theverified sender domain
      to,
      subject,
      html
    });
    console.log("Email sent:", response);
  } catch (error) {
    console.error("Failed to send email:", error.message);
  }
}

module.exports = { sendEmail };
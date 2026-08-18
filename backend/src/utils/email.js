const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');
const { getEmailLogoUrl } = require('./emailTemplates');

const resend = new Resend(process.env.RESEND_API_KEY);

const LOGO_PATH = path.join(__dirname, '../../assets/email/high-logo-2.png');

function logoAttachment() {
  try {
    if (!String(getEmailLogoUrl()).startsWith('cid:')) return null;
    if (!fs.existsSync(LOGO_PATH)) return null;
    return {
      filename: 'high-logo-2.png',
      content: fs.readFileSync(LOGO_PATH),
      contentId: 'earth-table-logo',
      contentType: 'image/png',
    };
  } catch (error) {
    console.warn('[email] could not attach header logo:', error.message);
    return null;
  }
}

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
 * @param {Array} [params.attachments] - Resend attachments ({ filename, content })
 */

async function sendEmail({ to, subject, html, text, replyTo, cc, bcc, from, attachments }) {
  try {
    const logo = logoAttachment();
    const allAttachments = [
      ...(logo ? [logo] : []),
      ...(attachments || []),
    ];
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
      ...(allAttachments.length ? { attachments: allAttachments } : {}),
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

function parseEmailList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function ownerNotificationEmails() {
  return parseEmailList(process.env.OWNER_NOTIFICATIONS_TO);
}

function adminNotificationEmails() {
  const admin = parseEmailList(process.env.ADMIN_NOTIFICATIONS_TO);
  return admin.length ? admin : ownerNotificationEmails();
}

module.exports = { sendEmail, ownerNotificationEmails, adminNotificationEmails };
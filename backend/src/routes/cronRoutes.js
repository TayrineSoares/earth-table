const crypto = require('crypto');
const express = require('express');
const router = express.Router();

const {
  PartnerError,
  closePartnerMonth,
  markInvoicesEmailed,
} = require('../queries/partner');
const { sendEmail } = require('../utils/email');
const {
  renderPartnerMonthlyInvoiceEmail,
  renderAdminMonthlyInvoiceEmail,
} = require('../utils/emailTemplates');
const {
  renderPartnerInvoicePdf,
  invoicePdfFilename,
} = require('../utils/partnerInvoicePdf');

function ownerNotificationEmails() {
  return (process.env.OWNER_NOTIFICATIONS_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function secretsEqual(provided, secret) {
  if (!provided || !secret) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(secret));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const alt = req.get('x-cron-secret') || '';
  return secretsEqual(bearer, secret) || secretsEqual(alt, secret);
}

function handleCron(req, res) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/partner-monthly] CRON_SECRET is not set');
    return res.status(500).json({ error: 'Cron is not configured.' });
  }
  if (!cronAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const period = req.query.period || req.body?.period || null;

  closePartnerMonth({ periodKey: period || undefined })
    .then(async (result) => {
      const ownerTo = ownerNotificationEmails();
      const sends = [];
      const invoiceSends = [];

      for (const payload of result.payloads || []) {
        const tasks = [];
        const user = payload.user || {};
        let attachments;
        try {
          const pdf = await renderPartnerInvoicePdf(payload);
          attachments = [{
            filename: invoicePdfFilename(payload.periodKey, payload.partner?.referral_code),
            content: Buffer.isBuffer(pdf) ? pdf.toString('base64') : pdf,
          }];
        } catch (e) {
          console.warn(
            '[cron/partner-monthly] invoice PDF attach failed (sending without PDF):',
            payload.invoice?.id,
            e.message
          );
        }

        if (user.email) {
          const partnerMsg = renderPartnerMonthlyInvoiceEmail(payload);
          tasks.push(
            sendEmail({
              to: user.email,
              subject: partnerMsg.subject,
              html: partnerMsg.html,
              text: partnerMsg.text,
              replyTo: 'hello@earthtableco.ca',
              attachments,
            })
          );
        } else {
          console.warn('[cron/partner-monthly] partner has no email; skipped partner statement', payload.invoice?.id);
        }

        if (ownerTo.length) {
          const adminMsg = renderAdminMonthlyInvoiceEmail(payload);
          tasks.push(
            sendEmail({
              to: ownerTo,
              subject: adminMsg.subject,
              html: adminMsg.html,
              text: adminMsg.text,
              attachments,
            })
          );
        }

        invoiceSends.push({ invoiceId: payload.invoice?.id, tasks });
      }

      if (!ownerTo.length) {
        console.warn('[cron/partner-monthly] OWNER_NOTIFICATIONS_TO empty; skipped admin statements');
      }

      for (const group of invoiceSends) {
        for (const task of group.tasks) sends.push(task);
      }

      const results = await Promise.allSettled(sends);
      const failedReasons = [];
      results.forEach((entry) => {
        if (entry.status === 'rejected') {
          failedReasons.push(entry.reason?.message || String(entry.reason));
          console.warn('[cron/partner-monthly] email failed (non-fatal):', entry.reason?.message || entry.reason);
        }
      });

      let cursor = 0;
      const emailed = [];
      const emailFailed = [];
      for (const group of invoiceSends) {
        const slice = results.slice(cursor, cursor + group.tasks.length);
        cursor += group.tasks.length;
        const allOk = slice.length === 0 || slice.every((entry) => entry.status === 'fulfilled');
        if (group.invoiceId && allOk && group.tasks.length > 0) {
          emailed.push(group.invoiceId);
        } else if (group.invoiceId && group.tasks.length > 0) {
          emailFailed.push(group.invoiceId);
        }
      }

      if (emailed.length) {
        await markInvoicesEmailed(emailed);
      }

      res.json({
        ok: true,
        period: result.period,
        period_label: result.periodLabel,
        created_count: result.created_count,
        reused_count: result.reused_count,
        emailed_count: emailed.length,
        email_failed_count: emailFailed.length,
        created: result.created,
        emailed,
        email_failed: emailFailed,
        email_errors: failedReasons,
      });
    })
    .catch((err) => {
      if (err instanceof PartnerError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('[cron/partner-monthly]', err);
      return res.status(500).json({ error: err.message || 'Server error' });
    });
}

router.get('/partner-monthly', handleCron);
router.post('/partner-monthly', handleCron);

module.exports = router;

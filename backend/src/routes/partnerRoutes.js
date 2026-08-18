const express = require('express');
const router = express.Router();

const {
  PartnerError,
  listPartners,
  createPartner,
  updatePartner,
  getPartnerWalletByUserId,
  getPartnerAdminDetail,
  getPartnerDetailByUserId,
  getInvoicePdfPayload,
  setPayoutPreference,
  setInvoicePaid,
} = require('../queries/partner');
const { sendEmail, ownerNotificationEmails } = require('../utils/email');
const { renderPartnerInvoicePdf, invoicePdfFilename } = require('../utils/partnerInvoicePdf');
const {
  renderPartnerWelcomeEmail,
  renderAdminPartnerWelcomeEmail,
} = require('../utils/emailTemplates');

function handlePartnerError(res, err, label) {
  if (err instanceof PartnerError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(label, err);
  return res.status(500).json({ error: err.message || 'Server error' });
}

async function sendPartnerWelcomeEmails(partner) {
  const user = partner.user || {};
  const ownerTo = ownerNotificationEmails();

  const sends = [];

  if (user.email) {
    const partnerMsg = renderPartnerWelcomeEmail(partner, user);
    sends.push(
      sendEmail({
        to: user.email,
        subject: partnerMsg.subject,
        html: partnerMsg.html,
        text: partnerMsg.text,
        replyTo: 'hello@earthtableco.ca',
      })
    );
  } else {
    console.warn('[POST /partners] partner has no email; skipped partner welcome');
  }

  if (ownerTo.length) {
    const adminMsg = renderAdminPartnerWelcomeEmail(partner, user);
    sends.push(
      sendEmail({
        to: ownerTo,
        subject: adminMsg.subject,
        html: adminMsg.html,
        text: adminMsg.text,
      })
    );
  } else {
    console.warn('[POST /partners] OWNER_NOTIFICATIONS_TO empty; skipped admin welcome');
  }

  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[POST /partners] welcome email failed (non-fatal):', result.reason?.message || result.reason);
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const partners = await listPartners();
    res.json(partners);
  } catch (err) {
    handlePartnerError(res, err, '[GET /partners]');
  }
});

router.get('/by-user/:auth_user_id', async (req, res) => {
  try {
    const partner = await getPartnerWalletByUserId(req.params.auth_user_id);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    res.json(partner);
  } catch (err) {
    handlePartnerError(res, err, '[GET /partners/by-user]');
  }
});

router.get('/by-user/:auth_user_id/detail', async (req, res) => {
  try {
    const partner = await getPartnerDetailByUserId(req.params.auth_user_id);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    res.json(partner);
  } catch (err) {
    handlePartnerError(res, err, '[GET /partners/by-user/detail]');
  }
});

router.patch('/by-user/:auth_user_id/payout-preference', async (req, res) => {
  try {
    const updated = await setPayoutPreference(
      req.params.auth_user_id,
      req.body?.payout_type
    );
    res.json(updated);
  } catch (err) {
    handlePartnerError(res, err, '[PATCH /partners/by-user/payout-preference]');
  }
});

router.post('/', async (req, res) => {
  try {
    const partner = await createPartner(req.body || {});
    try {
      await sendPartnerWelcomeEmails(partner);
    } catch (emailErr) {
      console.warn('[POST /partners] welcome emails failed (non-fatal):', emailErr.message);
    }
    res.status(201).json(partner);
  } catch (err) {
    handlePartnerError(res, err, '[POST /partners]');
  }
});

router.get('/invoices/:invoiceId/pdf', async (req, res) => {
  try {
    const payload = await getInvoicePdfPayload(req.params.invoiceId);
    if (!payload) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const pdf = await renderPartnerInvoicePdf(payload);
    const filename = invoicePdfFilename(payload.periodKey, payload.partner?.referral_code);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.send(pdf);
  } catch (err) {
    handlePartnerError(res, err, '[GET /partners/invoices/pdf]');
  }
});

router.patch('/invoices/:invoiceId', async (req, res) => {
  try {
    const paid = req.body?.paid;
    const updated = await setInvoicePaid(req.params.invoiceId, paid);
    res.json(updated);
  } catch (err) {
    handlePartnerError(res, err, '[PATCH /partners/invoices]');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const partner = await getPartnerAdminDetail(req.params.id);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    res.json(partner);
  } catch (err) {
    handlePartnerError(res, err, '[GET /partners/:id]');
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { active, referral_code } = req.body || {};
    const updated = await updatePartner(req.params.id, { active, referral_code });
    res.json(updated);
  } catch (err) {
    handlePartnerError(res, err, '[PATCH /partners/:id]');
  }
});

module.exports = router;

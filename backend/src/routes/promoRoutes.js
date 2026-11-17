const express = require('express');
const router = express.Router();
const {
  getActivePromoByCode,
  normalize,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} = require('../queries/promo_code');
const { getActiveReferralByCode } = require('../queries/partner');
const {
  optionalAuth,
  bindRequestUserId,
  requireAdmin,
} = require('../middleware/requireAuth');

// Cart calls this to preview the discount. Guests OK; logged-in identity from Bearer.
router.post('/validate', optionalAuth, async (req, res) => {
  try {
    const { code, subtotalCents } = req.body || {};
    const bound = bindRequestUserId(req);
    if (bound.error) {
      return res.status(bound.status).json({ valid: false, message: bound.error });
    }
    const userId = bound.userId;
    const cleaned = normalize(code);

    if (!cleaned) {
      return res.status(400).json({ valid: false, message: 'Promo code is required.' });
    }
    if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
      return res.status(400).json({ valid: false, message: 'Subtotal is invalid.' });
    }

    const referral = await getActiveReferralByCode(cleaned, userId || null, subtotalCents);
    if (referral.found) {
      if (!referral.ok) {
        return res.json({ valid: false, kind: 'referral', message: referral.message });
      }
      const pct = referral.discountPercentage;
      const amountOffCents = Math.floor((subtotalCents * pct) / 100);
      const displayCode = (referral.partner.referral_code || cleaned).toUpperCase();
      return res.json({
        valid: true,
        kind: 'referral',
        code: displayCode,
        discountPercentage: pct,
        amountOffCents,
        appliesTo: 'subtotal',
        message: `Applied ${pct}% off items with referral ${displayCode} (delivery excluded).`,
      });
    }

    const result = await getActivePromoByCode(cleaned, userId || null);
    if (!result.ok) {
      return res.json({ valid: false, message: result.message });
    }

    const promo = result.promo;
    const pct = promo.discount_percentage;
    const amountOffCents = Math.floor((subtotalCents * pct) / 100);

    return res.json({
      valid: true,
      kind: 'promo',
      code: promo.code,
      discountPercentage: pct,
      amountOffCents,
      appliesTo: 'subtotal',
      message: `Applied ${pct}% off items (delivery excluded).`,
    });
  } catch (err) {
    console.error('[POST /promo/validate] error:', err);
    return res.status(500).json({ valid: false, message: 'Server error validating promo.' });
  }
});

// Admin CRUD — service-role via Express; do not use anon client from the browser.
router.get('/', requireAdmin, async (req, res) => {
  try {
    const rows = await listPromoCodes();
    res.json(rows);
  } catch (err) {
    console.error('[GET /promo]', err.message);
    res.status(500).json({ error: 'Failed to load promo codes.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const cleaned = normalize(body.code);
    if (!cleaned) {
      return res.status(400).json({ error: 'Code is required.' });
    }
    const pct = parseInt(String(body.discount_percentage), 10);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'Discount percentage must be 0–100.' });
    }
    let maxUsesVal = null;
    if (body.max_uses !== '' && body.max_uses != null) {
      maxUsesVal = parseInt(String(body.max_uses), 10);
      if (Number.isNaN(maxUsesVal) || maxUsesVal < 0) {
        return res.status(400).json({ error: 'Max uses must be a non-negative integer or empty.' });
      }
    }
    const row = await createPromoCode({
      code: cleaned,
      discount_percentage: pct,
      active: body.active !== false,
      first_time_only: !!body.first_time_only,
      expires_at: body.expires_at || null,
      max_uses: maxUsesVal,
    });
    res.status(201).json(row);
  } catch (err) {
    const status = err.status || 500;
    console.error('[POST /promo]', err.message);
    res.status(status).json({ error: err.message || 'Failed to create promo code.' });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const patch = {};
    if (typeof req.body?.active === 'boolean') patch.active = req.body.active;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No supported fields to update.' });
    }
    const row = await updatePromoCode(req.params.id, patch);
    res.json(row);
  } catch (err) {
    const status = err.status || 500;
    console.error('[PATCH /promo/:id]', err.message);
    res.status(status).json({ error: err.message || 'Failed to update promo code.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await deletePromoCode(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /promo/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete promo code.' });
  }
});

module.exports = router;

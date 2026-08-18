const express = require('express');
const router = express.Router();
const { getActivePromoByCode, normalize } = require('../queries/promo_code');
const { getActiveReferralByCode } = require('../queries/partner');

// Cart calls this to preview the discount. Pass userId when logged in so first-time / capped rules work.
// Referral codes are checked first; if the string is a partner code, do not fall through to promo_codes.
router.post('/validate', async (req, res) => {
  try {
    const { code, subtotalCents, userId } = req.body || {};
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

module.exports = router;

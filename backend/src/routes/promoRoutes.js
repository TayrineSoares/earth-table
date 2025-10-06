const express = require('express');
const router = express.Router();
const { getActivePromoByCode, normalize } = require('../queries/promo_code');

router.post('/validate', async (req, res) => {
  try {
    const { code, subtotalCents } = req.body || {};
    const cleaned = normalize(code);

    if (!cleaned) {
      return res.status(400).json({ valid: false, message: 'Promo code is required.' });
    }
    if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) {
      return res.status(400).json({ valid: false, message: 'Subtotal is invalid.' });
    }

    const promo = await getActivePromoByCode(cleaned);
    if (!promo) {
      return res.json({ valid: false, message: 'Invalid or inactive promo code.' });
    }

    const pct = promo.discount_percentage;
    const amountOffCents = Math.floor((subtotalCents * pct) / 100);

    return res.json({
      valid: true,
      code: promo.code,
      discountPercentage: pct,
      amountOffCents,
      appliesTo: 'subtotal',               // explicit
      message: `Applied ${pct}% off items (delivery excluded).`,
    });
  } catch (err) {
    console.error('[POST /promo/validate] error:', err);
    return res.status(500).json({ valid: false, message: 'Server error validating promo.' });
  }
});

module.exports = router;

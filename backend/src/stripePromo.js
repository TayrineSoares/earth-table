const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_SK);

/**
 * Finds or creates a Stripe Promotion Code for the given code & %.
 * Returns the promotion_code id (to pass in Checkout 'discounts').
 */
async function ensureStripePromotionCode(code, percentOff) {
  const existing = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const coupon = await stripe.coupons.create({
    percent_off: percentOff,
    duration: 'once',
  });

  const promo = await stripe.promotionCodes.create({
    code,
    coupon: coupon.id,
    active: true,
  });

  return promo.id;
}

module.exports = { ensureStripePromotionCode };

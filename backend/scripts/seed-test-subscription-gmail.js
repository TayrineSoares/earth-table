/**
 * One-off: seed a paid+open test subscription for tayrinecristina2@gmail.com
 * so localhost can exercise Wed-cutoff pause/plan/fulfillment refunds.
 *
 * Uses Stripe TEST keys + existing test customer/card.
 * Safe to re-run: deletes prior seed labeled "LOCAL TEST SEED" for this user first.
 *
 *   node scripts/seed-test-subscription-gmail.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
const { getSignupDates, cutoffAtForSunday } = require('../src/queries/subscriptionWeek');

const EMAIL = 'tayrinecristina2@gmail.com';
const USER_ID = '3a196460-a5ff-4a14-8bff-92ea90b8e77f';
const STRIPE_CUSTOMER = 'cus_VdmD1eS6SIIGpr';
const STRIPE_PM = 'pm_1UcUjtDBOTFkel1rwPgWGD8n'; // visa 4242
const LABEL = 'LOCAL TEST SEED';
const PLAN_ID = 'a2563a73-8432-4a92-8f13-b83c20c7aa47'; // 15 meals / $270

function prevSunday(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 7);
  return dt.toISOString().slice(0, 10);
}

async function main() {
  if (!String(process.env.STRIPE_SECRET_SK || '').startsWith('sk_test')) {
    throw new Error('Refusing to seed: STRIPE_SECRET_SK is not sk_test_…');
  }
  const sb = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const dates = getSignupDates(new Date(), {});
  const thisSunday = dates.job_sunday; // e.g. 2026-11-29
  const firstSunday = prevSunday(thisSunday);
  const plan = { id: PLAN_ID, price_cents: 27000, meal_count: 15 };

  // Remove prior seed for this user
  const { data: old } = await sb
    .from('subscriptions')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('label', LABEL);
  for (const row of old || []) {
    const { data: cycles } = await sb.from('subscription_cycles').select('id').eq('subscription_id', row.id);
    for (const c of cycles || []) {
      await sb.from('subscription_cycle_items').delete().eq('cycle_id', c.id);
    }
    await sb.from('subscription_cycles').delete().eq('subscription_id', row.id);
    await sb.from('subscriptions').delete().eq('id', row.id);
    console.log('removed prior seed', row.id);
  }

  const { data: sub, error: subErr } = await sb
    .from('subscriptions')
    .insert({
      user_id: USER_ID,
      plan_id: plan.id,
      label: LABEL,
      status: 'active',
      stripe_customer_id: STRIPE_CUSTOMER,
      stripe_payment_method_id: STRIPE_PM,
      delivery: false,
      pickup_time_slot: '11:00 AM - 1:00 PM',
      special_note: null,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();
  if (subErr) throw subErr;

  // Past first box (locked) so pause won't use first-box protection on this Sunday.
  const { data: firstCycle, error: firstErr } = await sb
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: plan.id,
      plan_price_cents: plan.price_cents,
      meal_count: plan.meal_count,
      cutoff_at: cutoffAtForSunday(firstSunday, {}) || dates.cutoff_at,
      delivery_date: firstSunday,
      pickup_date: firstSunday,
      status: 'locked',
      delivery: false,
      pickup_time_slot: '11:00 AM - 1:00 PM',
      delivery_fee_cents: 0,
      plan_paid_cents: plan.price_cents,
      addon_paid_cents: 0,
      promo_percent: 0,
      charged_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('*')
    .single();
  if (firstErr) throw firstErr;

  // Charge a real test PI for this Sunday so pause can refund it.
  const amount = Math.round(plan.price_cents * 1.13);
  const pi = await stripe.paymentIntents.create({
    amount,
    currency: 'cad',
    customer: STRIPE_CUSTOMER,
    payment_method: STRIPE_PM,
    off_session: true,
    confirm: true,
    description: 'LOCAL TEST SEED — weekly plan',
    metadata: {
      kind: 'subscription_plan',
      seed: 'local_test_gmail',
      subscription_id: sub.id,
    },
  }, {
    idempotencyKey: `seed-test-gmail-${sub.id}-${thisSunday}`,
  });

  const { data: openCycle, error: openErr } = await sb
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: plan.id,
      plan_price_cents: plan.price_cents,
      meal_count: plan.meal_count,
      cutoff_at: cutoffAtForSunday(thisSunday, {}) || dates.cutoff_at,
      delivery_date: thisSunday,
      pickup_date: thisSunday,
      status: 'open',
      delivery: false,
      pickup_time_slot: '11:00 AM - 1:00 PM',
      delivery_fee_cents: 0,
      plan_paid_cents: plan.price_cents,
      addon_paid_cents: 0,
      promo_percent: 0,
      stripe_payment_intent_id: pi.id,
      charged_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (openErr) throw openErr;

  // Plan meals only (bowls / salads / main plates / soups) — not add-ons.
  const PLAN_CATS = new Set(['bowls', 'salads', 'main plates', 'soups']);
  const { data: cats } = await sb.from('categories').select('id, name');
  const catIds = (cats || [])
    .filter((c) => PLAN_CATS.has(String(c.name || '').trim().toLowerCase()))
    .map((c) => c.id);
  const { data: products } = await sb
    .from('products')
    .select('id, price_cents')
    .in('category_id', catIds)
    .eq('is_available', true)
    .limit(2);
  if (products?.length) {
    const qty = Math.floor(plan.meal_count / products.length);
    let left = plan.meal_count;
    const rows = products.map((p, i) => {
      const q = i === products.length - 1 ? left : qty;
      left -= q;
      return {
        cycle_id: openCycle.id,
        product_id: p.id,
        quantity: q,
        unit_price_cents: Number(p.price_cents) || 0,
        kind: 'plan',
      };
    }).filter((r) => r.quantity > 0);
    if (rows.length) {
      const { error: itemErr } = await sb.from('subscription_cycle_items').insert(rows);
      if (itemErr) console.warn('meal seed warning:', itemErr.message);
    }
  } else {
    console.warn('no plan-meal products found to seed');
  }

  console.log(JSON.stringify({
    ok: true,
    email: EMAIL,
    subscription_id: sub.id,
    first_box_sunday: firstSunday,
    this_sunday: thisSunday,
    open_cycle_id: openCycle.id,
    payment_intent: pi.id,
    amount_cents_with_hst: amount,
    plan: '15 meals / $270',
    next: 'Log in as tayrinecristina2@gmail.com → My Subscriptions → downgrade to 10 or switch delivery',
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

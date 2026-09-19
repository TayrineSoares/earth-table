/**
 * First-week subscription payment (Stripe Checkout) + webhook fulfill.
 *
 * We use Checkout mode "payment" (not Stripe Subscriptions) and ask Stripe
 * to save the card with setup_future_usage. Later weeks (Phase 5/6) charge
 * that saved payment method off-session. First Checkout is plan + delivery + tax;
 * add-ons stay on the cycle and are billed Thursday.
 */

const supabase = require('../../supabase/db');
const { getAllCategories } = require('./category');
const { getUserByAuthId, updateUserByAuthId } = require('./user');
const { getActivePromoByCode, incrementPromoUsedCount } = require('./promo_code');
const { getActiveReferralByCode } = require('./partner');
const { getServerDeliveryQuote } = require('../lib/deliveryQuote');
const { sendEmail, ownerNotificationEmails } = require('../utils/email');
const { renderSubscriptionWelcomeEmail, renderOwnerSubscriptionEmail } = require('../utils/emailTemplates');
const {
  SubscriptionError,
  getPlanById,
  getSettings,
  getOwnedSubscription,
} = require('./subscription');
const { getSignupDates, formatTorontoStamp } = require('./subscriptionWeek');

const HST = 1.13;
const PICKUP_SLOTS = new Set(['10:00-13:00', '14:00-16:30']);
const PLAN_MEAL_CATEGORY_ORDER = ['bowls', 'salads', 'main plates'];
const ADDON_EXCLUDED = new Set(['catering', 'custom meals']);

function getStripe() {
  return require('stripe')(process.env.STRIPE_SECRET_SK);
}

function frontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function categoryKey(name) {
  return String(name || '').trim().toLowerCase();
}

function isPlanMealCategory(name) {
  return PLAN_MEAL_CATEGORY_ORDER.includes(categoryKey(name));
}

function isAddonCategory(name) {
  const key = categoryKey(name);
  return Boolean(key) && !ADDON_EXCLUDED.has(key);
}

function qtyLines(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const id = Number(row.id ?? row.product_id);
    const quantity = parseInt(String(row.quantity), 10);
    if (!Number.isFinite(id) || !Number.isFinite(quantity) || quantity < 1) continue;
    byId.set(id, (byId.get(id) || 0) + quantity);
  }
  return [...byId.entries()].map(([id, quantity]) => ({ id, quantity }));
}

function paymentIntentId(session) {
  const pi = session && session.payment_intent;
  if (!pi) return null;
  return typeof pi === 'string' ? pi : pi.id;
}

async function loadProductsByIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, price_cents, image_url, category_id, is_available')
    .in('id', ids);
  if (error) throw error;
  return data || [];
}

async function categoryNameById() {
  const cats = await getAllCategories();
  const map = {};
  for (const cat of cats || []) map[cat.id] = cat.name;
  return map;
}

async function resolveLines(lines, { kind, allowUnavailableIds = new Set() } = {}) {
  const names = await categoryNameById();
  const products = await loadProductsByIds(lines.map((line) => line.id));
  const byId = new Map(products.map((p) => [p.id, p]));
  const resolved = [];

  for (const line of lines) {
    const product = byId.get(line.id);
    if (!product) {
      throw new SubscriptionError(400, `Product ${line.id} was not found.`);
    }
    if (!product.is_available && !allowUnavailableIds.has(product.id)) {
      throw new SubscriptionError(400, `${product.slug} is no longer available.`);
    }
    const catName = names[product.category_id] || '';
    if (kind === 'plan' && !isPlanMealCategory(catName)) {
      throw new SubscriptionError(400, `${product.slug} is not a plan meal (bowls, salads, or mains).`);
    }
    if (kind === 'addon' && !isAddonCategory(catName)) {
      throw new SubscriptionError(400, `${product.slug} cannot be added as an add-on.`);
    }
    resolved.push({
      product_id: product.id,
      quantity: line.quantity,
      unit_price_cents: Number(product.price_cents) || 0,
      kind,
      slug: product.slug,
      image_url: product.image_url,
    });
  }
  return resolved;
}

async function getOrCreateStripeCustomer(user, email) {
  const stripe = getStripe();
  if (user.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(user.stripe_customer_id);
      if (existing && !existing.deleted) return existing.id;
    } catch (err) {
      console.warn('[subscriptions] stored Stripe customer missing, creating a new one:', err.message);
    }
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const customer = await stripe.customers.create({
    email: email || user.email || undefined,
    name: name || undefined,
    metadata: { userId: user.auth_user_id },
  });
  await updateUserByAuthId(user.auth_user_id, { stripe_customer_id: customer.id });
  return customer.id;
}

async function findCycleByPaymentIntent(piId) {
  if (!piId) return null;
  const { data, error } = await supabase
    .from('subscription_cycles')
    .select('id, subscription_id')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/**
 * Build a Stripe Checkout session for the first week.
 * Dates come from the server (next Sunday), not the client.
 */
async function createSubscriptionCheckout(body = {}) {
  const userId = body.userId;
  const email = String(body.email || '').trim();
  if (!userId) throw new SubscriptionError(400, 'Sign in to subscribe.');
  if (!email) throw new SubscriptionError(400, 'Email is required.');

  const user = await getUserByAuthId(userId);
  if (!user) throw new SubscriptionError(400, 'Account not found.');

  const plan = await getPlanById(body.planId);
  if (!plan || !plan.is_active) {
    throw new SubscriptionError(400, 'That plan is not available.');
  }

  const meals = qtyLines(body.meals);
  const mealQty = meals.reduce((sum, line) => sum + line.quantity, 0);
  if (mealQty !== Number(plan.meal_count)) {
    throw new SubscriptionError(
      400,
      `Pick exactly ${plan.meal_count} meal${plan.meal_count === 1 ? '' : 's'} for this plan.`
    );
  }

  const addons = qtyLines(body.addons);
  const planItems = await resolveLines(meals, { kind: 'plan' });
  const addonItems = await resolveLines(addons, { kind: 'addon' });

  const delivery = !!body.delivery;
  const specialNote = String(body.special_note || '').trim() || null;
  const pickupSlot = String(body.pickup_time_slot || '').trim();

  if (delivery) {
    if (!specialNote || specialNote.length < 8) {
      throw new SubscriptionError(400, 'Please enter your full delivery address.');
    }
  } else if (!PICKUP_SLOTS.has(pickupSlot)) {
    throw new SubscriptionError(400, 'Choose a pickup time.');
  }

  const settings = await getSettings();
  const dates = getSignupDates(new Date(), settings || {});
  const sunday = dates.first_delivery_date;

  let deliveryFeeCents = 0;
  let deliveryPostal = null;
  if (delivery) {
    const quote = await getServerDeliveryQuote(body.delivery_postal_code);
    if (!quote.ok) {
      throw new SubscriptionError(
        400,
        quote.reason === 'OUT_OF_ZONE'
          ? 'Delivery not available for this address.'
          : 'Invalid delivery postal code.'
      );
    }
    deliveryFeeCents = quote.fee_cents;
    deliveryPostal = String(body.delivery_postal_code || '').toUpperCase().replace(/\s+/g, '');
    if (deliveryPostal.length === 6) {
      deliveryPostal = `${deliveryPostal.slice(0, 3)} ${deliveryPostal.slice(3)}`;
    }
  }

  // Promo/referral at signup is plan-only. Add-ons get that discount on Thursday.
  const discountableCents = Number(plan.price_cents) || 0;

  let discountFactor = 1;
  let discountMeta = null;
  const promoCode = String(body.promoCode || '').trim();
  if (promoCode) {
    const referralResult = await getActiveReferralByCode(promoCode, userId, discountableCents);
    if (referralResult.found) {
      if (!referralResult.ok) {
        throw new SubscriptionError(400, referralResult.message);
      }
      const pct = referralResult.discountPercentage;
      discountFactor = (100 - pct) / 100;
      discountMeta = {
        kind: 'referral',
        code: (referralResult.partner.referral_code || '').toUpperCase(),
        pct,
        partnerId: referralResult.partner.id,
      };
    } else {
      const promoResult = await getActivePromoByCode(promoCode, userId);
      if (!promoResult.ok) {
        throw new SubscriptionError(400, promoResult.message);
      }
      const pct = promoResult.promo.discount_percentage;
      discountFactor = (100 - pct) / 100;
      discountMeta = {
        kind: 'promo',
        code: promoResult.promo.code,
        pct,
        id: promoResult.promo.id,
      };
    }
  }

  // Same as à la carte: discount each pre-tax unit, then add 13% HST. Delivery is not discounted.
  const planDiscounted = Math.floor((Number(plan.price_cents) || 0) * discountFactor);
  const lineItems = [
    {
      price_data: {
        currency: 'cad',
        product_data: { name: `${plan.name} weekly plan (includes tax)` },
        unit_amount: Math.max(0, Math.round(planDiscounted * HST)),
      },
      quantity: 1,
    },
  ];

  if (delivery && deliveryFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: 'cad',
        product_data: { name: 'Delivery fee (includes tax)' },
        unit_amount: Math.round(deliveryFeeCents * HST),
      },
      quantity: 1,
    });
  }

  const { data: draft, error: draftErr } = await supabase
    .from('checkout_drafts')
    .insert([{
      user_id: userId,
      email,
      cart: {
        kind: 'subscription',
        plan_id: plan.id,
        plan_name: plan.name,
        meal_count: plan.meal_count,
        plan_price_cents: plan.price_cents,
        meals: planItems,
        addons: addonItems,
        pickup_time_slot: delivery ? null : pickupSlot,
        delivery_fee_cents: deliveryFeeCents,
        cutoff_at: dates.cutoff_at,
        cutoff_label: dates.cutoff_label,
        first_delivery_label: dates.first_delivery_label,
        discount: discountMeta,
        plan_paid_cents: planDiscounted,
        addon_paid_cents: 0,
      },
      special_note: specialNote,
      delivery,
      delivery_date: sunday,
      delivery_postal_code: deliveryPostal,
    }])
    .select('id')
    .single();

  if (draftErr) {
    console.error('[subscriptions] checkout draft failed', draftErr);
    throw new SubscriptionError(500, 'Could not start checkout.');
  }

  const customerId = await getOrCreateStripeCustomer(user, email);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: lineItems,
    custom_text: {
      submit: {
        message: 'Today you pay the weekly plan and delivery. After this week we charge plan and delivery Wednesday at 9:00 AM ET and email a receipt. Add-ons still on the box Thursday at 5:00 PM ET are billed then.',
      },
    },
    success_url: `${frontendUrl()}/subscribe/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl()}/subscribe/cart`,
    phone_number_collection: { enabled: true },
    // Save this card for weekly off-session charges later.
    payment_intent_data: {
      setup_future_usage: 'off_session',
      metadata: { kind: 'subscription', userId },
    },
    metadata: {
      kind: 'subscription',
      draft_id: String(draft.id),
      userId,
      email,
    },
  });

  return { url: session.url };
}

async function loadDraft(draftId) {
  if (!draftId) return null;
  const { data, error } = await supabase
    .from('checkout_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadSignupPayload(subscriptionId) {
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select(`
      id, status, plan_id, label, user_id, delivery, delivery_postal_code, pickup_time_slot, special_note,
      subscription_plans!subscriptions_plan_id_fkey ( id, name, meal_count, price_cents )
    `)
    .eq('id', subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!sub) return null;

  const { data: cycle, error: cycleErr } = await supabase
    .from('subscription_cycles')
    .select(`
      id, status, cutoff_at, delivery_date, pickup_date, delivery, delivery_postal_code,
      pickup_time_slot, special_note, delivery_fee_cents, plan_paid_cents, addon_paid_cents,
      promo_percent, plan_price_cents, stripe_payment_intent_id,
      subscription_cycle_items (
        id, product_id, quantity, unit_price_cents, kind,
        products ( id, slug, image_url )
      )
    `)
    .eq('subscription_id', subscriptionId)
    .order('delivery_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cycleErr) throw cycleErr;

  let customer = null;
  if (sub.user_id) {
    try {
      customer = await getUserByAuthId(sub.user_id);
    } catch (err) {
      console.warn('[subscriptions] signup payload user lookup failed:', err.message);
    }
  }

  return {
    ready: true,
    subscription: sub,
    cycle: cycle || null,
    customer: customer
      ? {
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone_number: customer.phone_number,
          address_line1: customer.address_line1,
          address_line2: customer.address_line2,
          city: customer.city,
          province: customer.province,
          postal_code: customer.postal_code,
        }
      : null,
  };
}

/**
 * Webhook (and the success-page poll) create the subscription after Stripe is paid.
 * First cycle stays `open` so meals can still change until Thursday lock.
 */
async function completeSubscriptionSignup(session) {
  const md = (session && session.metadata) || {};
  if (String(md.kind || '') !== 'subscription') return { ok: false, skipped: true };

  const stripe = getStripe();
  let paidSession = session;
  if (!paymentIntentId(paidSession)) {
    paidSession = await stripe.checkout.sessions.retrieve(session.id);
  }

  const piId = paymentIntentId(paidSession);
  if (piId) {
    const existing = await findCycleByPaymentIntent(piId);
    if (existing) return loadSignupPayload(existing.subscription_id);
  }

  const draft = await loadDraft(md.draft_id);
  const cart = draft?.cart && typeof draft.cart === 'object' ? draft.cart : {};
  if (cart.kind !== 'subscription') {
    throw new Error('Subscription checkout draft was missing.');
  }

  const userId = md.userId || draft.user_id;
  const user = userId ? await getUserByAuthId(userId) : null;
  const email =
    paidSession.customer_email ||
    paidSession.customer_details?.email ||
    md.email ||
    draft.email;

  let customerId = typeof paidSession.customer === 'string'
    ? paidSession.customer
    : paidSession.customer?.id || null;
  let paymentMethodId = null;
  let paidCents = Number(paidSession.amount_total) || 0;

  if (piId) {
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
    const pm = pi.payment_method;
    paymentMethodId = typeof pm === 'string' ? pm : pm?.id || null;
    if (!customerId) {
      customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id || null;
    }
    if (!paidCents && Number(pi.amount_received)) paidCents = Number(pi.amount_received);
  }

  if (customerId && paymentMethodId) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } catch (err) {
      console.warn('[subscriptions] could not set default payment method:', err.message);
    }
  }

  if (userId && customerId && user && user.stripe_customer_id !== customerId) {
    try {
      await updateUserByAuthId(userId, { stripe_customer_id: customerId });
    } catch (err) {
      console.warn('[subscriptions] could not save stripe_customer_id:', err.message);
    }
  }

  const delivery = !!draft.delivery;
  const sunday = draft.delivery_date;
  const discount = cart.discount || null;
  const promoPercent = Number(discount?.pct) || 0;

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_id: cart.plan_id,
      status: 'active',
      stripe_customer_id: customerId,
      stripe_payment_method_id: paymentMethodId,
      delivery,
      delivery_postal_code: delivery ? draft.delivery_postal_code : null,
      pickup_time_slot: delivery ? null : cart.pickup_time_slot,
      special_note: draft.special_note || null,
      first_promo_code: discount?.code || null,
      first_promo_percent: promoPercent,
      first_promo_applied: Boolean(discount),
    })
    .select()
    .single();

  if (subErr) throw subErr;

  const { data: cycle, error: cycleErr } = await supabase
    .from('subscription_cycles')
    .insert({
      subscription_id: sub.id,
      plan_id: cart.plan_id,
      plan_price_cents: Number(cart.plan_price_cents) || 0,
      cutoff_at: cart.cutoff_at,
      delivery_date: sunday,
      pickup_date: delivery ? null : sunday,
      status: 'open',
      delivery,
      delivery_postal_code: delivery ? draft.delivery_postal_code : null,
      pickup_time_slot: delivery ? null : cart.pickup_time_slot,
      special_note: draft.special_note || null,
      delivery_fee_cents: Number(cart.delivery_fee_cents) || 0,
      plan_paid_cents: Number(cart.plan_paid_cents) || 0,
      addon_paid_cents: Number(cart.addon_paid_cents) || 0,
      promo_percent: promoPercent,
      stripe_payment_intent_id: piId,
    })
    .select()
    .single();

  if (cycleErr) {
    // Unique week row: webhook retried after the cycle already existed.
    if (cycleErr.code === '23505' && piId) {
      const again = await findCycleByPaymentIntent(piId);
      if (again) return loadSignupPayload(again.subscription_id);
    }
    throw cycleErr;
  }

  const itemRows = [...(cart.meals || []), ...(cart.addons || [])].map((item) => ({
    cycle_id: cycle.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    kind: item.kind,
  }));

  if (itemRows.length) {
    const { error: itemErr } = await supabase
      .from('subscription_cycle_items')
      .insert(itemRows);
    if (itemErr) throw itemErr;
  }

  if (discount?.kind === 'promo' && discount.id) {
    try {
      await incrementPromoUsedCount(discount.id);
    } catch (err) {
      console.warn('[subscriptions] incrementPromoUsedCount failed:', err.message);
    }
  }

  if (email) {
    try {
      const msg = renderSubscriptionWelcomeEmail({
        firstName: user?.first_name || '',
        mealCount: cart.meal_count,
        planPriceCents: cart.plan_price_cents,
        delivery,
        deliveryLabel: cart.first_delivery_label,
        pickupSlot: cart.pickup_time_slot,
        cutoffLabel: cart.cutoff_label,
        subscriptionId: sub.id,
        address: delivery ? draft.special_note : undefined,
        notes: draft.special_note,
        meals: (cart.meals || []).map((item) => ({ slug: item.slug, quantity: item.quantity })),
      });
      await sendEmail({
        to: email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: 'hello@earthtableco.ca',
      });
    } catch (err) {
      console.warn('[subscriptions] welcome email failed:', err.message);
    }
  }

  const ownerTo = ownerNotificationEmails();
  if (ownerTo.length) {
    try {
      const ownerMsg = renderOwnerSubscriptionEmail({
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        mealCount: cart.meal_count,
        planPriceCents: cart.plan_price_cents,
        delivery,
        deliveryLabel: cart.first_delivery_label,
        pickupSlot: cart.pickup_time_slot,
        subscribedAtLabel: formatTorontoStamp(new Date()),
        paidCents,
        meals: (cart.meals || []).map((item) => ({ slug: item.slug, quantity: item.quantity })),
        addons: (cart.addons || []).map((item) => ({ slug: item.slug, quantity: item.quantity })),
        cutoffLabel: cart.cutoff_label,
        email,
        phone: paidSession.customer_details?.phone || user?.phone_number,
        notes: draft.special_note,
        address: delivery ? draft.special_note : undefined,
      });
      await sendEmail({
        to: ownerTo,
        subject: ownerMsg.subject,
        html: ownerMsg.html,
        text: ownerMsg.text,
        replyTo: 'hello@earthtableco.ca',
      });
    } catch (err) {
      console.warn('[subscriptions] owner subscribe email failed:', err.message);
    }
  }

  if (md.draft_id) {
    await supabase.from('checkout_drafts').delete().eq('id', md.draft_id);
  }

  return loadSignupPayload(sub.id);
}

/**
 * Success page poll. Completes signup here too so local testing works
 * even if Stripe CLI is not forwarding webhooks.
 */
async function getSignupBySessionId(sessionId) {
  if (!sessionId) throw new SubscriptionError(400, 'Missing session id.');
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session || String((session.metadata || {}).kind || '') !== 'subscription') {
    throw new SubscriptionError(404, 'Subscription checkout not found.');
  }
  if (session.payment_status !== 'paid') {
    return { ready: false };
  }

  const piId = paymentIntentId(session);
  if (piId) {
    const existing = await findCycleByPaymentIntent(piId);
    if (existing) return loadSignupPayload(existing.subscription_id);
  }

  return completeSubscriptionSignup(session);
}

async function createCardSetupCheckout(userId, subscriptionId) {
  const sub = await getOwnedSubscription(userId, subscriptionId);
  if (sub.status === 'cancelled') {
    throw new SubscriptionError(400, 'This subscription is cancelled.');
  }
  if (!sub.stripe_customer_id) {
    throw new SubscriptionError(400, 'No card on file yet. Email hello@earthtableco.ca.');
  }
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: sub.stripe_customer_id,
    payment_method_types: ['card'],
    success_url: `${frontendUrl()}/my-subscriptions?card_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl()}/my-subscriptions`,
    custom_text: {
      submit: {
        message: 'This saves a card for your Earth Table weekly plan. We charge plan and delivery every Wednesday at 9:00 AM ET and email a receipt. Extras are billed Thursday at 5:00 PM ET if you added any.',
      },
    },
    metadata: {
      kind: 'subscription_card',
      userId,
      subscription_id: sub.id,
    },
  });
  return { url: session.url };
}

async function completeCardSetup(session) {
  const md = (session && session.metadata) || {};
  if (String(md.kind || '') !== 'subscription_card') return { ok: false, skipped: true };

  const stripe = getStripe();
  let setupId = session.setup_intent;
  if (setupId && typeof setupId === 'object') setupId = setupId.id;
  if (!setupId) {
    const full = await stripe.checkout.sessions.retrieve(session.id, { expand: ['setup_intent'] });
    setupId = typeof full.setup_intent === 'string' ? full.setup_intent : full.setup_intent?.id;
    session = full;
  }
  if (!setupId) throw new SubscriptionError(400, 'Card setup was missing.');

  const si = await stripe.setupIntents.retrieve(setupId);
  const pmId = typeof si.payment_method === 'string' ? si.payment_method : si.payment_method?.id;
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subId = md.subscription_id;
  const userId = md.userId;
  if (!pmId || !subId || !userId) throw new SubscriptionError(400, 'Card setup was incomplete.');

  const { error } = await supabase
    .from('subscriptions')
    .update({
      stripe_payment_method_id: pmId,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
    })
    .eq('id', subId)
    .eq('user_id', userId);
  if (error) throw error;

  if (customerId && pmId) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pmId },
      });
    } catch (err) {
      console.warn('[subscriptions] could not set default payment method:', err.message);
    }
  }

  try {
    const sub = await getOwnedSubscription(userId, subId);
    if (sub.pause_reason === 'payment_failed') {
      const { retryFailedCharge } = require('./subscriptionCharge');
      await retryFailedCharge({ ...sub, stripe_payment_method_id: pmId, stripe_customer_id: customerId || sub.stripe_customer_id });
    }
  } catch (err) {
    console.warn('[subscriptions] retry after card update failed:', err.message);
  }

  return { ok: true };
}

async function getCardSetupBySessionId(sessionId) {
  if (!sessionId) throw new SubscriptionError(400, 'Missing checkout session.');
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['setup_intent'] });
  if (String((session.metadata || {}).kind || '') !== 'subscription_card') {
    throw new SubscriptionError(404, 'Card update not found.');
  }
  if (session.status !== 'complete') return { ready: false };
  await completeCardSetup(session);
  return { ready: true };
}

module.exports = {
  createSubscriptionCheckout,
  completeSubscriptionSignup,
  getSignupBySessionId,
  createCardSetupCheckout,
  completeCardSetup,
  getCardSetupBySessionId,
  qtyLines,
  resolveLines,
  PICKUP_SLOTS,
};

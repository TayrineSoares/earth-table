/**
 * Rebuild order_products rows from Stripe Checkout Session line items.
 *
 * Writes ONLY to order_products_recovery_staging. Does not touch order_products.
 *
 * Matching (Stripe description → products.slug):
 *   1. Strip a trailing " (includes tax)" suffix (how checkout names every item).
 *   2. Exact case-insensitive match on products.slug.
 *   3. If none, fuzzy: unique/best substring match, else similarity >= 0.72.
 *   4. If still none, stage the row with match_confidence = 'no_match'
 *      and matched_product_id = null. Never drop a catalog-unknown line silently.
 *
 * unit_price_cents always comes from the matched product's current products.price_cents,
 * not from Stripe's tax-inclusive unit_amount. Unmatched rows get null.
 *
 * Delivery fee lines are not catalog products (they live on orders.delivery /
 * payment info). They are logged and skipped, not staged.
 *
 * Resume: orders that already have any staging row are skipped.
 * Re-process one order by deleting its staging rows, then re-run.
 *
 * Usage (from backend/, with .env loaded):
 *   node scripts/recover-order-products-from-stripe.js
 *   node scripts/recover-order-products-from-stripe.js --limit=5
 *   node scripts/recover-order-products-from-stripe.js --order-id=364
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
const supabase = require('../supabase/db');

const SKIP_ORDER_IDS = new Set([363]); // already recovered and verified by hand
const FUZZY_MIN_SIMILARITY = 0.72;
const HST = 1.13;

function parseArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const LIMIT = parseArg('limit') ? Number(parseArg('limit')) : null;
const ONLY_ORDER_ID = parseArg('order-id') ? Number(parseArg('order-id')) : null;

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Put it in backend/.env (same file the API uses).`);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripTaxSuffix(name) {
  return String(name || '').replace(/\s*\(includes tax\)\s*$/i, '').trim();
}

function normalizeExact(name) {
  return stripTaxSuffix(name).replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeFuzzy(name) {
  return normalizeExact(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function isDeliveryFee(description) {
  return /delivery fee/i.test(description || '');
}

async function withRetry(label, fn, { maxAttempts = 6, baseDelayMs = 500 } = {}) {
  let delay = baseDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.statusCode || err.status;
      const retryable = status === 429 || status >= 500 || status == null;
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      const retryAfter = Number(err.headers?.['retry-after']);
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : delay;
      console.warn(
        `[retry] ${label} attempt ${attempt}/${maxAttempts} failed (${err.message}). Waiting ${wait}ms`
      );
      await sleep(wait);
      delay = Math.min(delay * 2, 15000);
    }
  }
}

async function fetchAllRows(table, columns, build = (q) => q) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(
      supabase.from(table).select(columns)
    ).range(from, from + pageSize - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function matchProduct(cleanName, products) {
  const exactKey = normalizeExact(cleanName);
  const fuzzyKey = normalizeFuzzy(cleanName);

  const exactHits = products.filter((p) => p.exactKey === exactKey);
  if (exactHits.length === 1) {
    return { product: exactHits[0], confidence: 'exact', note: null };
  }
  if (exactHits.length > 1) {
    const ids = exactHits.map((p) => p.id).join(', ');
    return {
      product: exactHits[0],
      confidence: 'fuzzy',
      note: `Multiple exact slug matches (${ids}); staged the first. Confirm by hand.`,
    };
  }

  // Same idea as `slug ilike '%term%' or term ilike '%slug%'`.
  // Unique substring hits count as fuzzy even when Levenshtein is low
  // (e.g. "Pie" vs "Apple Pie").
  const substringHits = products.filter((p) => {
    if (!fuzzyKey || !p.fuzzyKey) return false;
    if (fuzzyKey.length < 4 && p.fuzzyKey.length < 4) return false;
    return fuzzyKey.includes(p.fuzzyKey) || p.fuzzyKey.includes(fuzzyKey);
  });

  if (substringHits.length === 1) {
    return {
      product: substringHits[0],
      confidence: 'fuzzy',
      note: `Substring match against slug "${substringHits[0].slug}".`,
    };
  }
  if (substringHits.length > 1) {
    const scoredSubs = substringHits
      .map((p) => ({ product: p, score: similarity(fuzzyKey, p.fuzzyKey) }))
      .sort((a, b) => b.score - a.score);
    const bestSub = scoredSubs[0];
    const secondSub = scoredSubs[1];
    return {
      product: bestSub.product,
      confidence: 'fuzzy',
      note: `Substring matched ${substringHits.length} slugs; picked "${bestSub.product.slug}" (also "${secondSub.product.slug}"). Confirm by hand.`,
    };
  }

  const scored = products
    .map((p) => ({ product: p, score: similarity(fuzzyKey, p.fuzzyKey) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];
  if (best && best.score >= FUZZY_MIN_SIMILARITY) {
    const closeSecond = second && (best.score - second.score) < 0.08;
    return {
      product: best.product,
      confidence: 'fuzzy',
      note: closeSecond
        ? `Fuzzy match (${best.score.toFixed(2)}) but also close to "${second.product.slug}" (${second.score.toFixed(2)}). Confirm by hand.`
        : `Fuzzy match (similarity ${best.score.toFixed(2)}).`,
    };
  }

  return { product: null, confidence: 'no_match', note: 'No catalog slug matched this Stripe description.' };
}

async function listLineItems(sessionId) {
  return withRetry(`listLineItems ${sessionId}`, async () => {
    const items = [];
    for await (const line of stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 })) {
      items.push(line);
    }
    return items;
  });
}

function priceNote(product, stripeUnitAmount) {
  if (!product || stripeUnitAmount == null) return null;
  const derivedPreTax = Math.round(Number(stripeUnitAmount) / HST);
  if (derivedPreTax === Number(product.price_cents)) return null;
  return `Catalog price_cents=${product.price_cents} vs Stripe unit_amount/1.13≈${derivedPreTax} (promo, credit, or price change).`;
}

async function main() {
  requireEnv('STRIPE_SECRET_SK');
  requireEnv('SUPABASE_PROJECT_URL');
  requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!process.env.STRIPE_SECRET_SK.startsWith('sk_live_')) {
    console.warn(
      'STRIPE_SECRET_SK does not look like a live key (sk_live_...). Live Checkout Sessions need the live secret.'
    );
  }

  const products = (await fetchAllRows('products', 'id, slug, price_cents')).map((p) => ({
    ...p,
    exactKey: normalizeExact(p.slug),
    fuzzyKey: normalizeFuzzy(p.slug),
  }));
  console.log(`Loaded ${products.length} products for matching.`);

  const stagedRows = await fetchAllRows('order_products_recovery_staging', 'order_id');
  const stagedOrderIds = new Set(stagedRows.map((r) => r.order_id));
  console.log(`Staging already has rows for ${stagedOrderIds.size} orders (those will be skipped).`);

  let orders = await fetchAllRows(
    'orders',
    'id, stripe_session_id, total_cents, delivery, credit_applied_cents, referral_code',
    (q) => q.like('stripe_session_id', 'cs_live_%').order('id', { ascending: true })
  );

  if (ONLY_ORDER_ID) {
    orders = orders.filter((o) => o.id === ONLY_ORDER_ID);
  }

  const eligible = orders.filter((o) => !SKIP_ORDER_IDS.has(o.id));
  const toProcess = eligible.filter((o) => !stagedOrderIds.has(o.id));
  const work = Number.isFinite(LIMIT) && LIMIT > 0 ? toProcess.slice(0, LIMIT) : toProcess;

  console.log(
    `Live orders: ${orders.length}. Skip already-recovered: ${SKIP_ORDER_IDS.size}. ` +
    `Already staged: ${eligible.length - toProcess.length}. This run: ${work.length}.`
  );

  const failures = [];
  let processed = 0;
  let stagedLineItems = 0;
  let skippedDelivery = 0;
  let exactCount = 0;
  let fuzzyCount = 0;
  let noMatchCount = 0;

  for (const order of work) {
    processed += 1;
    const label = `order ${order.id} (${processed}/${work.length})`;
    try {
      const lineItems = await listLineItems(order.stripe_session_id);
      if (!lineItems.length) {
        console.warn(`[${label}] Stripe returned 0 line items — not marking as done.`);
        failures.push({ orderId: order.id, error: 'empty line items' });
        continue;
      }

      const rows = [];
      for (const line of lineItems) {
        const description = line.description || '';
        if (isDeliveryFee(description)) {
          skippedDelivery += 1;
          console.log(`[${label}] skipped delivery fee line: "${description}"`);
          continue;
        }

        const cleanName = stripTaxSuffix(description);
        const match = matchProduct(cleanName, products);
        const stripeUnit = line.price?.unit_amount != null ? Number(line.price.unit_amount) : null;
        const extraPrice = priceNote(match.product, stripeUnit);
        const notes = [match.note, extraPrice].filter(Boolean).join(' ') || null;

        if (match.confidence === 'exact') exactCount += 1;
        else if (match.confidence === 'fuzzy') fuzzyCount += 1;
        else noMatchCount += 1;

        rows.push({
          order_id: order.id,
          stripe_line_item_description: description,
          matched_product_id: match.product ? match.product.id : null,
          matched_product_slug: match.product ? match.product.slug : null,
          quantity: Number(line.quantity) || 1,
          unit_price_cents: match.product ? Number(match.product.price_cents) : null,
          match_confidence: match.confidence,
          notes,
        });
      }

      if (!rows.length) {
        console.warn(`[${label}] only non-product line items (e.g. delivery). Nothing staged.`);
        continue;
      }

      const { error } = await supabase.from('order_products_recovery_staging').insert(rows);
      if (error) throw new Error(`staging insert failed: ${error.message}`);

      stagedLineItems += rows.length;
      console.log(
        `Processed order ${processed}/${work.length} (id ${order.id}) — ${rows.length} line item(s) staged.`
      );
    } catch (err) {
      console.error(`[${label}] FAILED: ${err.message}`);
      failures.push({ orderId: order.id, error: err.message });
    }

    await sleep(100);
  }

  console.log('\n--- summary ---');
  console.log(`Orders attempted: ${processed}`);
  console.log(`Line items staged: ${stagedLineItems}`);
  console.log(`exact / fuzzy / no_match: ${exactCount} / ${fuzzyCount} / ${noMatchCount}`);
  console.log(`Delivery fee lines skipped: ${skippedDelivery}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures) console.log(`  order ${f.orderId}: ${f.error}`);
    console.log('Re-run the same command to retry failures (successful orders are skipped).');
  } else {
    console.log('No failures.');
  }
  console.log('order_products was not modified.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

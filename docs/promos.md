# Promo codes — internal wiki

Internal map of regular (non-partner) percent-off codes for à la carte and first-week weekly plans.

Support email: **hello@earthtableco.ca**.  
Related: [Partners](./partners.md) (collision + validate order), [À la carte](./alacarte.md), [Subscriptions](./subscriptions.md).

---

## Quick orientation

| Layer | Start here |
|---|---|
| Table | `public.promo_codes` (no create SQL in repo — inferred from Admin + queries) |
| Rules | `backend/src/queries/promo_code.js` |
| Validate API | `backend/src/routes/promoRoutes.js` |
| À la carte apply | `backend/server.js` `createCheckoutSession` + webhook `incrementPromoUsedCount` |
| Stripe helper | `backend/src/stripePromo.js` — **imported unused**; discounts are price-baked |
| Admin | `frontend/src/components/PromoAdmin.jsx` (direct Supabase client) |
| Cart / Subscribe UI | `frontend/src/pages/Cart.jsx`, `SubscribeCart.jsx` |
| Sub fulfill | `subscriptionCheckout.js` + Wednesday path in `subscriptionCharge.js` |
| Collision | `backend/sql/partner_referral.sql` → `private.prevent_discount_code_collision` |

---

## Product model (one sentence)

Admin-defined **promo codes** give a **percent off item subtotal** (delivery excluded); optional expiry, max uses, and first-time-only; usage increments **only after successful payment**; on weekly plans the discount is **first week only**.

---

## Data model

### `promo_codes`

| Field | Meaning |
|---|---|
| `code` | Matched `ilike` (trim; case-insensitive) |
| `discount_percentage` | 0–100 |
| `active` | Soft disable |
| `expires_at` | Optional; reject if past |
| `max_uses` / `used_count` | Cap; bump after pay |
| `first_time_only` | Needs login; blocks if user has non-cancelled order |
| `created_at` | Ordering in Admin |

Weekly plan snapshots: `subscriptions.first_promo_code|percent|applied`, `subscription_cycles.promo_percent` — see [subscriptions.md](./subscriptions.md).

---

## Flows

### Validate → checkout → webhook (à la carte)
1. `POST /api/promo/validate` — referral first; if not a partner code → `getActivePromoByCode`.
2. UI shows preview; checkout sends `promoCode`.
3. Server re-validates; sets `discountFactor`; bakes discount into line items; metadata `promo_id`, `discount_kind=promo`.
4. Webhook creates order; `incrementPromoUsedCount(promo_id)`.

### Weekly plan
Same validate on `SubscribeCart.jsx`. Signup: plan discounted in Checkout; `first_promo_*` + cycle `promo_percent`. Add-ons get the same % on the **first** Wednesday charge. Later weeks `promo_percent: 0`. Promo `used_count` bumps at signup fulfill when `discount.kind === 'promo'`.

---

## Money rules

- % off **items only**; delivery full price.
- Pre-tax discount, then × **1.13** HST on discounted unit.
- Cap preview to subtotal; UI `round` vs server `floor` per unit may differ slightly — **server wins at charge**.
- `used_count` never increments on validate alone.
- `max_uses` or `first_time_only` → must be signed in.
- First-time promo: cancelled-only history still allowed; referral first-time does not.

---

## APIs

| Method | Path | Notes |
|---|---|---|
| POST | `/api/promo/validate` | Body `{ code, subtotalCents }`; optional Bearer binds identity (do not send forged `userId`) |
| POST | `/api/create-checkout-session` | Same identity bind; enforces promo rules; sets `promo_id` |
| — | Supabase from Admin | CRUD on `promo_codes` (no dedicated promo admin REST) |
| POST | `/api/subscriptions/checkout` | `promoCode` via `subscriptionCheckout.js` |

---

## Admin

Admin → **Promos** tab: create (code, %, expiry, first-time, max uses), activate/deactivate, delete. Create failures include DB collision message if code matches a referral code.

---

## Promo vs partner referral

| Rule | Behavior |
|---|---|
| Namespace | One string cannot be both a promo and a referral code (DB trigger + API checks) |
| Runtime | **Referral lookup first**; never fall through to promo if partner code found |
| Combine | Impossible — one `promoCode` field |
| Copy | “A referral code cannot be combined with a regular promo code.” |

---

## Cheat sheet

| Want… | Do… |
|---|---|
| New code | Admin → Promos |
| Pause | Deactivate (keep row) |
| Cap / first-time | Set `max_uses` / `first_time_only` (forces login) |
| Debug invalid | active, expiry, uses, login, prior orders |
| Sub first week | Same code field — [subscriptions.md](./subscriptions.md) |
| Rules logic | `promo_code.js` + `promoRoutes.js` |

---

## Quirks

1. **`stripePromo.js` / `ensureStripePromotionCode`**: unused; Checkout never passes Stripe `discounts`.
2. Promo Admin bypasses Express; collision relies on DB trigger (+ partner API pre-check the other way).
3. Normalize: promo trims only; partner codes forced uppercase — matching still case-insensitive.
4. If the typed string exists as a **partner** code, promo rules never run.

---

## Keeping this doc honest

When you change validate rules or usage bump timing, update `promo_code.js` / checkout webhook and this wiki (+ [partners.md](./partners.md) if collision order changes).

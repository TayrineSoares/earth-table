# À la carte orders — internal wiki

Internal map of Earth Table’s one-off (menu → cart → Stripe) ordering feature: how it works, where the code lives, and what to change when something breaks.

Customer-facing terms: [Privacy / Terms à la carte section](../frontend/src/components/PrivacyPolicy.jsx).  
Support email in all copy: **hello@earthtableco.ca**.

Not covered here: weekly Subscribe & Save — see [subscriptions.md](./subscriptions.md). The two carts cannot be active at the same time in the browser (`App.jsx` drops one when the other starts).

---

## Quick orientation

| Layer | Start here |
|---|---|
| Checkout entry | `frontend/src/pages/Cart.jsx` |
| Cart state (live) | `frontend/src/App.jsx` → `localStorage` keys `cart_guest` / `cart_{userId}` |
| Stripe session + webhook | `backend/server.js` (`createCheckoutSession`, `stripeWebhookHandler`) |
| Order create / read | `backend/src/queries/order.js` + `backend/src/routes/ordersRoutes.js` |
| Delivery quote | `backend/src/lib/deliveryQuote.js` + `backend/api/delivery/quote` |
| Promo / referral validate | `backend/src/routes/promoRoutes.js` + `promo_code.js` / `partner.js` |
| Confirmation UI | `frontend/src/pages/Confirmation.jsx` |
| Order history | `frontend/src/pages/OrderHistory.jsx` |
| Admin kitchen board | `frontend/src/components/OrderAdmin.jsx` |
| Email HTML | `backend/src/utils/emailTemplates.js` (`renderCustomerOrderEmail`, `renderOwnerOrderEmail`) |
| Holidays (FE) | `frontend/src/helpers/blockedDates.js` |
| Holidays (BE checkout) | inline `BLOCKED_MMDD` in `backend/server.js` |
| Legal copy | `frontend/src/components/PrivacyPolicy.jsx` |

### Backend module map

| File | Owns |
|---|---|
| `server.js` | À la carte Checkout Session, Stripe webhook → order + emails, holiday gates, store-credit apply |
| `order.js` | `createOrderWithProducts`, list/get by id/user/session, `picked_up`, item fallbacks (`cart_meta` / Stripe line items) |
| `ordersRoutes.js` | HTTP for orders |
| `deliveryQuote.js` | Geoapify distance → `$15` / `$30` / out of zone |
| `promo_code.js` | Promo lookup, first-time / max-uses rules; `used_count` bump after pay |
| `partner.js` | Referral validate, wallet totals, `recordReferralEarn`, `recordCreditRedeem` |
| `cartRoutes.js` / `queries/cart.js` | **Legacy** Supabase `carts` table API — **not used by live checkout** |
| `emailTemplates.js` | Customer / owner / partner-code-used order emails |
| `recover-order-products-from-stripe.js` | Staging-only rebuild of missing `order_products` |

---

## Product model (one sentence)

Customers browse the menu, build a cart in the browser, choose **pickup or delivery** (24h notice), pay once via **Stripe Checkout**, and the kitchen gets a row in `orders` + `order_products` when the webhook fires — **no recurring billing, no Wednesday lock**.

---

## Cart storage — what is live

### Live: browser `localStorage` (React state)

| Key | Who |
|---|---|
| `cart_guest` | Signed-out shoppers |
| `cart_{supabaseAuthUserId}` | Signed-in shoppers |

Proof:

1. `App.jsx` loads/merges/persists only those keys; login **merges** guest into user cart and clears `cart_guest`.
2. `Cart.jsx` checkout sends `cartItems` from React props (that state), not from any `/cart/:userId` API.
3. Success clears via `sessionStorage` flag `clear_cart_after_order` + empty localStorage keys (`App.jsx` `isALaCarteSuccess`).
4. Menu add flows (`Products.jsx` / `ProductDetail.jsx` / `CartPopup.jsx`) call `addToCart` from `App.jsx`.

`Cart.jsx` does call `GET ${API_BASE}/cart` on mount — that hits the **stub** in `server.js`:

```js
app.get('/cart', (req, res) => {
  res.json({ message: 'Cart route works!', items: [] });
});
```

It only gates the Lottie loading spinner. It does **not** hydrate the cart.

### Not live for checkout: DB `carts` table

| Path | Status |
|---|---|
| `backend/src/routes/cartRoutes.js` mounted at `/cart` (`/cart/:userId`, `/cart/add`, …) | Still mounted; **no frontend caller** for add/update/clear |
| `backend/src/queries/cart.js` | Unused by routes/server checkout |
| `backend/seeds/seed.js` | Seeds `carts` for local DB only |

Treat DB carts as **legacy / dead for production UX**. Do not “fix” checkout by wiring Stripe to `carts`.

### Temporary server stash (not a cart)

`checkout_drafts` holds the full cart + note + delivery fields for one Stripe session (metadata size limit). Created in `createCheckoutSession`; deleted after webhook creates the order. Shared table with subscription signup drafts (`kind` distinguishes subscription paths; à la carte drafts have no `kind` in metadata — webhook treats non-`subscription` / non-`subscription_card` as one-off orders).

There are **no draft rows in `orders`**. Unpaid abandoned Checkouts leave only an orphan `checkout_drafts` row until cleaned up (best-effort delete on success only).

---

## Checkout flow (end-to-end)

```
Menu / ProductDetail / OrderHistory reorder
        ↓ addToCart (App.jsx → localStorage)
CartPopup → /cart (Cart.jsx)
        ↓ POST /api/create-checkout-session
checkout_drafts insert + Stripe Checkout Session
        ↓ customer pays on Stripe
POST /api/webhook  checkout.session.completed
        ↓ (skip if md.kind = subscription | subscription_card)
createOrderWithProducts → orders + order_products
        ↓ promo used_count / referral earn / credit redeem
customer + owner (+ partner) emails
        ↓
/confirmation?session_id=…  polls GET /api/orders/session/:sessionId
```

### Step detail

1. **UI checkout** — `Cart.jsx` `handleCheckout`  
   - Validates pickup/delivery fields, privacy checkbox, re-validates promo if typed.  
   - Payload: `cartItems`, optional `email`/`userId` from Supabase session, fulfillment dates, `special_note`, `promoCode`.  
   - Guest OK: `userId`/`email` may be null; Stripe collects email/phone on Checkout (`phone_number_collection: { enabled: true }`).

2. **Create session** — `createCheckoutSession` in `backend/server.js`  
   - Holiday reject on pickup/delivery date.  
   - Re-validates promo **or** referral (never trusts client math alone).  
   - Line items: **discount pre-tax → × 1.13 HST** per unit; delivery fee line separate (also × 1.13).  
   - Optional **partner store credit** reduces Stripe `unit_amount`s (Stripe forbids negative lines); leaves ≥ `$0.50` (`STRIPE_MIN_CENTS = 50`).  
   - Inserts `checkout_drafts`; metadata keeps `draft_id` + small fields.

3. **Stripe** — `mode: 'payment'`; success → `${FRONTEND_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}`; cancel → `/cart`.

4. **Webhook** — same handler as subscriptions; branches on `metadata.kind`. À la carte has **no** `kind`.  
   - Idempotent: `getOrderByStripeSessionId` → bail if exists.  
   - Loads draft by `draft_id`; falls back to legacy `metadata.cart` JSON if needed.  
   - Holiday safety net: if blocked date slipped through, logs and **returns 200 without creating an order** (money already taken — ops must refund manually).  
   - `createOrderWithProducts(...)`.  
   - Referral earn / credit redeem / promo `used_count++`.  
   - Emails; delete draft.

5. **Confirmation** — `Confirmation.jsx` clears cart, fetches order by session id (webhook race: may 404 briefly; UI surfaces hello@ if missing).

---

## Guest vs logged-in

| | Guest | Logged-in |
|---|---|---|
| Cart key | `cart_guest` | `cart_{id}` (+ guest merged on login) |
| `orders.user_id` | `null` | Auth user id from metadata |
| Stripe `customer_email` | omitted → Stripe form | session email when present |
| Promo (capped / first-time) | Often blocked (“Sign in to use…”) | Allowed per `promo_code.js` |
| Referral codes | **Blocked** — must register + sign in; first-order only; not own code | Allowed if first order + min subtotal env |
| Store credit | N/A | Auto-applied if partner wallet has `available_credit_cents` |
| Order history | Empty / sign-in prompt | `GET /api/orders/user/:authId` |

No separate “guest order draft” entity beyond `checkout_drafts`.

---

## Money rules

Amounts customers see on menu are **integer cents pre-tax**. Stripe charges **tax-inclusive** line amounts.

### Tax
- HST **13%** applied **after** item discount: `Math.round(discountedPreTax * 1.13)`.
- Delivery: `Math.round(fee_cents * 1.13)` as its own line (“Delivery fee (includes tax)”).
- Cart UI mirrors: `(subtotal − promo) + delivery` → tax on that sum → grand total → minus store credit preview.

### Delivery fee (server is source of truth)
`getServerDeliveryQuote` (`deliveryQuote.js`):

| Distance from kitchen (`PICKUP_LAT`/`PICKUP_LON`) | Pre-tax fee |
|---|---|
| ≤ 10 km | `$15` (`1500`) |
| 11–30 km | `$30` (`3000`) |
| > 30 km | `OUT_OF_ZONE` — checkout 400 |

Client quote (`POST /api/delivery/quote`) is UX only; checkout **recomputes** and ignores client `delivery_fee_cents`. Fee stored for emails/admin in `buyer_stripe_payment_info.delivery_meta.fee_cents_server`.

**Promo/referral never discount delivery.**

### Promo codes (`promo_codes`)
- Validate: `POST /promo/validate` or `/api/promo/validate`.
- Checkout re-runs `getActivePromoByCode`.
- Rules: active, not expired, under `max_uses`, optional `first_time_only` (needs login + no prior non-cancelled order).
- `used_count` increments **only in webhook** after order save.
- Stored on order via `buyer_stripe_payment_info.discount_meta` (`kind: promo`, code, percent, amount_off_cents). Regular promos do **not** set `orders.referral_code`.

### Partner referral
- Same input field as promo; **referral checked first** (`getActiveReferralByCode`).
- Defaults: **10%** off items (`discount_percent`), **10%** partner cashback on **pre-discount** `item_subtotal_cents` (`cashback_percent`) — both overridable per partner.
- Requires login, first-time customer, not self-referral; optional `REFERRAL_MIN_SUBTOTAL_CENTS`.
- On success: `orders.referral_partner_id`, `orders.referral_code`, ledger `earn` via `recordReferralEarn`; partner gets `renderPartnerCodeUsedEmail`.

### Store credit / wallet
- Only partners with available credit (from monthly invoice credit payouts).
- Applied at Checkout by shrinking line `unit_amount`s; `metadata.credit_applied_cents`.
- Webhook: `recordCreditRedeem` on buyer’s partner wallet.
- Column: `orders.credit_applied_cents`.
- UI preview on Cart when `GET /api/partners/by-user/:userId` returns a wallet.

### Totals columns
| Column / field | Meaning |
|---|---|
| `orders.total_cents` | Stripe `session.amount_total` (what was charged) |
| `orders.item_subtotal_cents` | Pre-tax item subtotal **before** discount (from checkout metadata) |
| `orders.credit_applied_cents` | Store credit taken off Stripe total |
| `unit_price_cents` on `order_products` | Catalog pre-tax unit at insert time |
| `discount_meta` in payment JSON | Promo/referral display math for emails/admin |

---

## Fulfillment

### Pickup
- Address (copy): **77 Woodstream Blvd, Vaughan, ON L4L 7Y7** (`orderHelpers.PICKUP_ADDRESS`).
- UI: `PickupSelector.jsx`.
- Slots: **`10:00-13:00`**, **`14:00-16:30`**.
- **24h notice**: `min` date = now + 24h; on that earliest day, slots whose **start** is before the 24h cutoff are disabled.
- Stored: `orders.pickup_date`, `orders.pickup_time_slot`; `delivery = false`.

### Delivery
- UI: `DeliverySelector.jsx` + auto quote on Cart (no Calculate button — Subscribe cart uses Calculate).
- Window in copy: **11:00 AM – 6:00 PM** (`DELIVERY_WINDOW`).
- **24h notice** same pattern; if earliest day is past 6 PM relative to cutoff, “No slots left for this date.”
- Requires valid Canadian postal + `special_note` length ≥ 8 (full address) at checkout.
- Stored: `orders.delivery = true`, `orders.delivery_date`; postal/km/fee in `buyer_stripe_payment_info.delivery_meta`.
- Privacy copy says delivery is **Sunday**; the date picker does **not** enforce Sunday-only — any calendar day ≥ 24h is selectable (ops quirk / copy mismatch).

### Blocked holidays
Same set everywhere for one-offs:

**Dec 25, Dec 26, Dec 31, Jan 1** (`MM-DD` repeating).

| Layer | Behavior |
|---|---|
| FE selectors | Error on blur via `isBlockedHoliday` |
| `createCheckoutSession` | `400` with holiday message |
| Webhook | Log + **skip order create** (still 200 to Stripe) |

### Cutoff for one-offs
Only the **24-hour notice** in the selectors. There is **no** Tuesday/Wednesday subscription-style lock for à la carte. After pay: **no changes / no cancel** (Privacy + UI copy).

---

## Emails

Triggered only from the à la carte webhook branch in `server.js` after order save.

| Email | Renderer | To |
|---|---|---|
| Customer confirmation | `renderCustomerOrderEmail` | Stripe/customer email |
| Owner new order | `renderOwnerOrderEmail` | `ownerNotificationEmails()` |
| Partner code used | `renderPartnerCodeUsedEmail` | Partner account email (if referral earn) |

- Reply-To for customer/partner: `hello@earthtableco.ca`.
- Preview samples: `backend/scripts/preview-emails.js`.
- Content: items, totals (promo/credit/delivery), fulfillment block (pickup slot or delivery date + window + note).

---

## Order history + Admin

### Customer — `OrderHistory.jsx` (`/orders/:userId?`)
- Requires auth; loads `GET /api/orders/user/:authUserId`.
- Expand details, print receipt, reorder line / reorder all → `addToCart`.
- Includes **all** orders for that `user_id` (including any with `subscription_cycle_id` if present — admin list is stricter).

### Admin — `OrderAdmin.jsx` (Admin → Orders tab)
- Copy: everyday website orders **not** weekly subscription boxes.
- Data: `GET /api/orders` → `getAllOrders()` filters **`.is('subscription_cycle_id', null)`**.
- Views: **Upcoming** / **Past** by due date (pickup or delivery YMD vs America/Toronto today) — `orderAdminHelpers.js`.
- Search: id, email, name, status, due date.
- Sort: due / fulfilment / note.
- Expand row → `GET /api/orders/:id` for line items + breakdown.
- Toggle **Picked Up / Delivered?** → `PATCH /api/orders/:id/picked-up` (`orders.picked_up`).
- No cancel/refund/edit-items from admin UI.

---

## Key tables / columns (from code usage)

### `orders` (à la carte write path)
| Column | Role |
|---|---|
| `id` | PK; emails / admin |
| `user_id` | Auth uuid or null (guest) |
| `buyer_email`, `buyer_name`, `buyer_phone_number` | From Stripe (+ profile phone if logged in) |
| `buyer_stripe_payment_info` | JSON string: session, PI, address, `draft_id`, `delivery_meta`, `discount_meta`, `cart_meta` |
| `status` | Stripe `payment_status` (e.g. `paid`) |
| `stripe_session_id` | Idempotency + confirmation lookup |
| `total_cents` | Charged total |
| `item_subtotal_cents` | Pre-tax items before discount |
| `credit_applied_cents` | Wallet credit used |
| `pickup_date`, `pickup_time_slot` | Pickup |
| `delivery`, `delivery_date` | Delivery |
| `special_note` | Address / allergies |
| `referral_partner_id`, `referral_code` | Referral only |
| `picked_up` | Admin checkbox |
| `subscription_cycle_id` | **null** for à la carte; set for kitchen boxes from weekly lock |
| `created_at` | Placed at |

### `order_products`
| Column | Role |
|---|---|
| `order_id`, `product_id`, `quantity`, `unit_price_cents` | Line items matched to `products` by id or slug |

If catalog match fails, insert may skip rows but `cart_meta` still lands on the order; reads fall back to `cart_meta` then Stripe line items (`order.js` `resolveOrderItems`).

### `checkout_drafts`
`user_id`, `email`, `cart` (json), `special_note`, `delivery`, `delivery_date`, `delivery_postal_code` — ephemeral.

### `promo_codes`
`code`, `discount_percentage`, `active`, `expires_at`, `max_uses`, `used_count`, `first_time_only`.

### Partner / wallet (referral + credit)
`partners`, `partner_ledger` (`earn` / `redeem`), `partner_invoices` — see `backend/sql/partner_referral.sql`.

### Legacy `carts`
`user_id`, `product_id`, `quantity` — unused by live UX.

### Recovery staging
`order_products_recovery_staging` — `backend/sql/order_products_recovery_staging.sql`; script never writes live `order_products` until a human runs the final SQL.

---

## API endpoints

| Method | Path | Role |
|---|---|---|
| `POST` | `/create-checkout-session`, `/api/create-checkout-session` | Start Stripe Checkout |
| `POST` | `/webhook`, `/api/webhook` | Stripe events (raw body) |
| `POST` | `/delivery/quote`, `/api/delivery/quote` | Distance / fee preview |
| `POST` | `/promo/validate`, `/api/promo/validate` | Promo or referral preview |
| `GET` | `/api/orders` | Admin list (à la carte only) |
| `GET` | `/api/orders/session/:sessionId` | Confirmation |
| `GET` | `/api/orders/user/:id` | Order history |
| `GET` | `/api/orders/:id` | Admin detail |
| `GET` | `/api/orders/:id/products` | Line products |
| `PATCH` | `/api/orders/:id/picked-up` | Admin fulfilled toggle |
| `GET` | `/api/partners/by-user/:userId` | Cart store-credit preview |
| `GET` | `/cart` | **Stub** health JSON |
| `*` | `/cart/:userId`, `/cart/add`, … | **Legacy DB cart** — unused by FE |

Also dual-mounted without `/api` for several routers (`/orders`, `/promo`, …).

---

## File cheat sheet — “I need to change X”

| Change | Open |
|---|---|
| Cart persist / guest merge / clear after pay | `frontend/src/App.jsx` |
| Checkout UI / totals / promo apply | `frontend/src/pages/Cart.jsx` |
| Pickup slots / 24h rules | `frontend/src/components/PickupSelector.jsx` |
| Delivery date / postal UX | `frontend/src/components/DeliverySelector.jsx` |
| Holiday MM-DD (FE) | `frontend/src/helpers/blockedDates.js` |
| Holiday + Stripe session + webhook | `backend/server.js` |
| Zone fees / Geoapify | `backend/src/lib/deliveryQuote.js` |
| Order insert / item fallbacks | `backend/src/queries/order.js` |
| HTTP orders | `backend/src/routes/ordersRoutes.js` |
| Confirmation page | `frontend/src/pages/Confirmation.jsx` |
| History + reorder | `frontend/src/pages/OrderHistory.jsx` + `orderHelpers.js` |
| Admin board | `OrderAdmin.jsx` + `orderAdminHelpers.js` |
| Promo rules | `promo_code.js` + `promoRoutes.js` |
| Referral / wallet | `partner.js` + `partner_referral.sql` |
| Email HTML | `emailTemplates.js` |
| Legal bullets | `PrivacyPolicy.jsx` |
| Menu add-to-cart | `Products.jsx` / `ProductDetail.jsx` / `CartPopup.jsx` |
| Routes shell | `frontend/src/AppRoutes.jsx` |
| Recover missing lines | `backend/scripts/recover-order-products-from-stripe.js` + staging SQL |
| Dead DB cart API | `cartRoutes.js`, `queries/cart.js` |

---

## Known quirks / legacy

1. **DB `carts` + `cartRoutes` / `queries/cart.js` are dead for checkout.** Live cart is localStorage only. Stub `GET /cart` still exists and confuses grepping.
2. **`checkout_drafts` are not orders.** Abandoned Stripe sessions can leave drafts; only successful webhook deletes them.
3. **Webhook holiday skip after payment** returns 200 without an order — customer charged, kitchen has nothing; needs manual Stripe refund + ops.
4. **Privacy says delivery is Sunday; UI allows any day** (≥ 24h). Align copy or constrain the picker if product intent is Sunday-only.
5. **`order_products` insert can soft-fail** (logged); order still created with `cart_meta`. Admin/history use fallbacks; recovery script stages rebuilds from Stripe (`order_products_recovery_staging` — never auto-writes live rows).
6. **Store credit leaves Stripe min $0.50** even if wallet covers more.
7. **Referral vs promo collision** prevented in SQL (`private.prevent_discount_code_collision`); validate tries referral first.
8. **À la carte ↔ subscription mutual exclusion** in browser only (`dropAlaCarteForSub` / `dropSubForAlaCarte`); server does not block both.
9. **Admin list excludes subscription kitchen orders** (`subscription_cycle_id IS NULL`); customer history does not filter that way.
10. **`VITE_CHECKOUT_ENABLED=false`** disables the Proceed button without removing the page.
11. **No post-pay cancel/edit API** — intentional; changes are hello@ only.
12. **Recovery:** `SKIP_ORDER_IDS` hardcodes e.g. `363` in the script; review staging SQL before promoting into `order_products`.

---

## Sandbox / regression checklist

1. Guest: add meals → `/cart` → pickup 24h+ → pay → confirmation + customer/owner email; `user_id` null; cart cleared.
2. Login with guest cart → items merge into `cart_{id}`; guest key empty.
3. Delivery in-zone ≤10 km → $15 + tax line; >30 km blocked at quote and checkout.
4. Promo % off items only; delivery unchanged; `used_count` +1 after webhook.
5. Referral: signed-in first-time only; partner earn + partner email; self-code rejected.
6. Partner with credit → Cart shows store credit; Stripe total reduced; ledger redeem after pay.
7. Holiday date → FE error and checkout 400.
8. Confirmation polls session id; Admin Upcoming shows order; mark picked up.
9. Order history reorder adds available items back to localStorage cart.
10. Starting Subscribe flow empties à la carte cart (and the reverse).

---

## Keeping this doc honest

When you change money, fulfillment windows, or checkout rules:

1. Update the code path (`server.js` and/or selectors).
2. Update Privacy à la carte bullets if customer-visible.
3. Update this wiki in the same PR.
4. Regenerate email previews if totals/fulfillment copy changed (`backend/scripts/preview-emails.js`).

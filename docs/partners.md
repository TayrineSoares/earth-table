# Partner referrals & wallet — internal wiki

Internal map of Earth Table’s partner referral program: codes, customer discount, partner cashback ledger, monthly invoices, and store-credit wallet.

Support email: **hello@earthtableco.ca**.  
Related: [À la carte](./alacarte.md) (checkout earn/redeem), [Promos](./promos.md) (code collision), [Subscriptions](./subscriptions.md) (first-week referral earn).

---

## Quick orientation

| Layer | Start here |
|---|---|
| Schema | `backend/sql/partner_referral.sql`, `partner_rates.sql`, `partner_ledger_subscriptions.sql` |
| Queries | `backend/src/queries/partner.js` |
| HTTP | `backend/src/routes/partnerRoutes.js` (mounted `/partners` + `/api/partners`) |
| Cart validate | `backend/src/routes/promoRoutes.js` — **referral before promo** |
| À la carte pay | `backend/server.js` webhook → earn + redeem |
| Weekly signup earn | `backend/src/queries/subscriptionCheckout.js` (`syncReferralEarnForSubscription`) |
| Cron | `backend/src/routes/cronRoutes.js` → `/api/cron/partner-monthly` |
| PDF | `backend/src/utils/partnerInvoicePdf.js` |
| Admin | `frontend/src/components/PartnerAdmin.jsx` + `PartnerMonthList.jsx` |
| Partner UI | `frontend/src/pages/Profile.jsx` |
| Client helpers | `frontend/src/helpers/partnerHelpers.js` |
| Emails | `emailTemplates.js` (`renderPartnerWelcomeEmail`, `renderPartnerCodeUsedEmail`, monthly invoice renders) |
| Demo seed | `backend/sql/seed_tayrine_partner_demo.sql` |

### Backend module map

| File | Owns |
|---|---|
| `partner.js` | CRUD, wallet totals, referral rules, earn/redeem, month close |
| `partnerRoutes.js` | Admin + partner HTTP |
| `partnerInvoicePdf.js` | Statement PDF |
| `server.js` webhook | Order create → earn + redeem + code-used email |
| `subscriptionCheckout.js` | First-week referral on weekly signup → ledger by `subscription_id` |

---

## Product model (one sentence)

An admin-linked **partner** gets a unique **referral code**; first-time customers who use it get **% off items** (not delivery); the partner earns **% cashback** on the pre-discount item subtotal as **pending**, then at month-end as **cash** (manual pay) and/or **store credit** (wallet, auto-applied on the partner’s own à la carte checkout).

---

## Data model

### `partners`
| Field | Meaning |
|---|---|
| `user_id` | `users.auth_user_id` (unique — one partner per user) |
| `referral_code` | Stored uppercase; unique on `lower(referral_code)` |
| `active` | Inactive → code fails validation |
| `discount_percent` / `cashback_percent` | 0–100 (see `partner_rates.sql`) |
| `payout_type` | `cash` \| `credit` — frozen onto each **earn** at order/signup time |
| `pending_payout_*` | Schema leftovers; live preference switch is **immediate** |

### `partner_ledger`
| Field | Meaning |
|---|---|
| `kind` | `earn` \| `redeem` |
| `status` | earn: `pending` → `available` at month close; redeem: `applied` |
| `payout_type` | Snapshot at earn time |
| `order_id` | À la carte earn/redeem |
| `subscription_id` | Weekly-plan signup earn |
| `item_subtotal_cents` | Base used for cashback % |
| `accrual_month` | Toronto month start (`YYYY-MM-01`) |
| `invoice_id` | Set when month closes |

Uniques: one earn per `order_id`; one redeem per `order_id`; one earn per `subscription_id`.

### `partner_invoices`
Per partner × `(period_year, period_month)`: cash/credit/total cents, `status` (`unpaid` \| `paid` \| `credited`), `paid_at`, `emailed_at`.

### `orders` extras
`referral_partner_id`, `referral_code`, `credit_applied_cents`, `item_subtotal_cents`.

**Wallet is not cached** — recomputed from ledger + unpaid invoice cash (`getWalletTotalsByPartnerIds`).

---

## Flows

### 1. Admin creates partner
`PartnerAdmin.jsx` → `POST /api/partners` → welcome emails to partner + admin notifications.

### 2. Customer applies code (à la carte)
`Cart.jsx` → `POST /api/promo/validate` → if found as referral, stop (no promo fallback). Checkout re-validates. Discount baked into Stripe line unit amounts (pre-tax, then ×1.13 HST). Delivery undiscounted.

### 3. Payment succeeds (à la carte)
Webhook → `createOrderWithProducts` → `recordReferralEarn` (pending) → optional `recordCreditRedeem` → partner “code used” email.

### 4. Partner wallet / payout
`Profile.jsx`: code, rates, cash↔credit switch (`PATCH …/payout-preference`), month list + PDF. Cart auto-applies available store credit (keeps Stripe charge ≥ $0.50).

### 5. Month close
Cron `partner-monthly` → `closePartnerMonth` → invoices + `available` earns → partner + admin statement emails. Admin marks cash invoices paid.

### 6. Weekly plan
Same validate on `SubscribeCart.jsx`. Signup stores first-week promo fields; earn uses **`subscription_id`**. Details: [subscriptions.md](./subscriptions.md).

---

## Money rules

- Amounts: **integer cents**. Discount/cashback: `floor(subtotal * percent / 100)`.
- Discount base: **item subtotal only**; delivery never discounted.
- Cashback base: **pre-discount** `item_subtotal_cents`.
- Tax: discount on pre-tax unit, then **13% HST**.
- Earn starts **`pending`**; becomes **`available`** only after month close.
- Store credit: shrinks Stripe line `unit_amount`s; **not** on subscription checkout.
- Self-referral blocked at validate + webhook.
- First-time referral: any prior row in `orders` blocks (includes cancelled) — stricter than promo first-time.
- Optional floor: `REFERRAL_MIN_SUBTOTAL_CENTS` (default `0`).

---

## APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/partners` | Admin Bearer; list + wallet bags |
| POST | `/api/partners` | Admin Bearer; create + welcome mail |
| GET | `/api/partners/:id` | Admin Bearer; detail + months |
| PATCH | `/api/partners/:id` | Admin Bearer; `active`, code, rates |
| GET | `/api/partners/by-user/:auth_user_id` | Bearer; self or admin; wallet summary |
| GET | `/api/partners/by-user/:auth_user_id/detail` | Bearer; self or admin; Profile months |
| PATCH | `/api/partners/by-user/:auth_user_id/payout-preference` | Bearer; self or admin; `{ payout_type }` |
| GET | `/api/partners/invoices/:invoiceId/pdf` | Bearer; invoice owner or admin; blob download from UI |
| PATCH | `/api/partners/invoices/:invoiceId` | Admin Bearer; `{ paid: boolean }` |
| POST | `/api/promo/validate` | Shared; referral branch first; optional Bearer binds user (rejects forged body `userId`) |

Cron: `GET|POST /api/cron/partner-monthly` (`CRON_SECRET`; optional `period=YYYY-MM`). Schedule: `0 8 1 * *` UTC in `vercel.json`.

---

## Admin

Admin → **Partners** tab: create (user search, code, discount %, cashback %), activate/deactivate, edit code/rates, expand months, download PDF, mark cash paid. Partners table is service-role / API only (RLS revoke on anon/authenticated).

---

## Emails / PDF

| Render | When |
|---|---|
| `renderPartnerWelcomeEmail` / `renderAdminPartnerWelcomeEmail` | Partner create |
| `renderPartnerCodeUsedEmail` | Successful referral earn |
| `renderPartnerMonthlyInvoiceEmail` / `renderAdminMonthlyInvoiceEmail` | Month close |

PDF is on-demand via authenticated API (emails tell partners to download; cron does not attach PDF). UI uses `downloadInvoicePdf` (Bearer → blob), not a bare `<a href>`. Filename: `earth-table-partner-{CODE}-{YYYY-MM}.pdf`.

---

## Cheat sheet

| Want… | Open / do |
|---|---|
| New partner | Admin → Partners |
| Code not working | Check `active`, signed-in, not own code, no prior orders, min subtotal env |
| Switch payout | Profile → cash/credit (**new** earns only) |
| Pay cash | Month-end email + PDF; Admin mark Paid |
| Credit on cart | Auto if `available_credit_cents` > 0 |
| Sub referral earn | Signup path; ledger `subscription_id` — [subscriptions.md](./subscriptions.md) |
| Rates / ledger logic | `partner.js` + SQL under `backend/sql/partner_*.sql` |

---

## Quirks

1. `pending_payout_type` / `pending_payout_effective_on` are leftovers; preference change is immediate.
2. Subscription earns need `partner_ledger_subscriptions.sql` applied for `subscription_id` unique earn.
3. PDF line detail is strongest for `order_id` earns; subscription-only months may look thinner.
4. Referral “first order” = **any** order; promo first-time ignores cancelled-only history.
5. One code field: if the string is a **partner** code, promo rules never run (even if referral fails for that user).
6. Cannot combine referral + promo.

---

## Keeping this doc honest

When you change rates, ledger status rules, or month-close:

1. Update `partner.js` / SQL / cron.
2. Update this wiki (+ [promos.md](./promos.md) if collision/validate order changes).
3. Regenerate partner email previews if copy changed.

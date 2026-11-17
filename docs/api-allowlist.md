# API public allowlist

Source of truth for routes that may be called **without** a signed-in Bearer JWT. Everything else on migrated routers is default-deny (`requireAuth` / `requireAdmin`) or uses a capability secret (cron, Stripe signature, unsubscribe HMAC).

Dual mounts (`/path` and `/api/path`) share the same handler unless noted.

## Intentionally public

| Method | Path | Why |
|---|---|---|
| GET | `/` | Health / hello |
| GET | `/categories/*` (all GETs) | Storefront catalog |
| GET | `/products/*` (all GETs) | Storefront catalog |
| GET | `/tags` | Storefront filters |
| GET | `/orders/session/:sessionId` | Post-checkout confirm poll (capability URL) |
| GET | `/subscriptions/plans?active=1` | Marketing / signup catalog (active only; no `subscriber_count`) |
| GET | `/subscriptions/plans/:id` | Signup plan detail (**active** plans only; inactive → admin) |
| GET | `/subscriptions/dates` | Signup cadence |
| GET | `/subscriptions/signup/:sessionId` | Signup confirm poll |
| GET | `/subscriptions/card-setup/:sessionId` | Card-setup confirm poll |
| POST | `/promo/validate` | Cart discount check (`optionalAuth`; guests OK) |
| POST | `/create-checkout-session` | À la carte Stripe (`optionalAuth`; guests OK) |
| POST | `/delivery/quote` | Geoapify fee quote |
| POST | `/login`, `/login/reset-password` | Auth |
| POST | `/register`, `/register/auth/resend-confirmation` | Auth |
| POST | `/register/confirmation` | Confirm upsert (Bearer from signup session) |
| POST | `/logout` | Client sign-out helper |
| POST | `/contact` | Marketing contact form |
| POST | `/email/unsubscribe` | Email prefs; **HMAC token** required |
| POST | `/webhook` | Stripe; **signature** required |
| GET/POST | `/cron/*` | Jobs; **`CRON_SECRET`** Bearer or `x-cron-secret` |

## Public with optional Bearer

| Method | Path | Behavior |
|---|---|---|
| POST | `/promo/validate` | Guest OK; signed-in → bind `userId` from token (mismatch → 400) |
| POST | `/create-checkout-session` | Same |
| GET | `/subscriptions/plans` (no `active=1`) | **Admin only** (inactive plans + subscriber counts) |
| GET | `/subscriptions/plans/:id` (inactive) | **Admin only** |

## Default-deny routers (Bearer required unless allowlisted above)

| Router | Gate |
|---|---|
| `ordersRoutes` | `unlessPublic` → session GET only |
| `subscriptionRoutes` | `unlessPublic` → plans/dates/signup/card-setup GETs; cron charge/lock via secret |
| `cartRoutes` | `requireAuth` on all |
| `usersRoutes` | `requireAuth`; list/admin fields → `requireAdmin`; `:id` → self-or-admin |
| `partnerRoutes` | `requireAuth`; money/admin → `requireAdmin`; by-user / invoice PDF → owner-or-admin |
| `productsRoutes` / `categoriesRoutes` | GETs public; mutations → `requireAdmin` |
| `promoRoutes` | `POST /validate` public; `GET/POST/PATCH/DELETE /promo` → `requireAdmin` |

## Secrets / capability (not JWT)

| Mechanism | Used by |
|---|---|
| Stripe webhook signature | `POST /webhook` |
| `CRON_SECRET` | `/cron/*`, subscription `admin/run-charge` + `run-lock` |
| Unsubscribe HMAC (`CRON_SECRET`-based) | `POST /email/unsubscribe` |
| Stripe Checkout `sessionId` in path | order / signup / card-setup confirm GETs |

## Residual (not auth bugs)

| Item | Notes |
|---|---|
| Dual `/` and `/api/` mounts | Intentional for FE; same handlers |
| `POST /contact` | No rate limit — ops/spam risk, not privilege |
| `/email-previews` static | Only if `backend/email-previews` exists on the host |
| `POST /logout` | Stub-ish server signOut; real session is client Supabase |
| Catalog GETs return inactive products | Product/marketing choice; admin archive is write-gated |

## Authz rules (reminder)

- Missing/invalid Bearer → **401**
- Body/query `userId` ≠ `req.user.id` → **400**
- Authenticated but not owner (and not admin) → **403**
- Do not use client `userId` for authorization; identity comes from Bearer

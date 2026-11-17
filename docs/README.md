# Earth Table — internal docs

Feature wikis for engineers and ops. Each doc follows the same shape: orientation → product model → data → flows → money/APIs → cheat sheet → quirks.

Support email in customer copy: **hello@earthtableco.ca**.

## Feature index

| Doc | Feature |
|---|---|
| [subscriptions.md](./subscriptions.md) | Weekly Subscribe & Save (cadence, pause/resume, charges, emails) |
| [alacarte.md](./alacarte.md) | One-off menu cart → Stripe → kitchen orders |
| [partners.md](./partners.md) | Referral codes, cashback ledger, wallet, monthly invoices |
| [promos.md](./promos.md) | Percent-off promo codes (vs partner codes) |
| [catalog.md](./catalog.md) | Products, categories, tags, storefront + admin |
| [fulfillment.md](./fulfillment.md) | Pickup/delivery UI + Geoapify fee quotes |
| [auth.md](./auth.md) | Supabase auth, profile, `is_admin` |
| [api-allowlist.md](./api-allowlist.md) | Public API allowlist (no Bearer) + secrets / default-deny map |
| [site-and-admin.md](./site-and-admin.md) | Marketing pages, contact, unsubscribe, Admin shell |

## How features connect

```
Catalog ──► À la carte cart ──► Stripe webhook ──► orders
   │              │                    │
   │              ├── promo / referral validate
   │              └── delivery quote
   │
   └──► Weekly meals / add-ons ──► subscription cycles
              │
              ├── Tue plan+delivery / Wed lock (subscriptions.md)
              └── first-week promo or referral earn (partners.md)
```

## Keeping docs honest

When you change money, cadence, fulfillment, or status rules:

1. Update the code path.
2. Update customer-facing Privacy/cadence copy if visible.
3. Update the matching wiki in the same PR.
4. Regenerate email previews if copy changed (`backend/scripts/preview-emails.js`).

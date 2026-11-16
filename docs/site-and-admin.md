# Marketing, contact, unsubscribe & admin shell — internal wiki

Short map of brand pages, contact form, email unsubscribe, and the Admin board shell. Feature depth lives in the tab docs linked below.

Support email: **hello@earthtableco.ca**.

---

## Quick orientation

| Layer | Start here |
|---|---|
| Home / About / Contact | `frontend/src/pages/Home.jsx`, `About.jsx`, `Contact.jsx` |
| Contact form | `frontend/src/components/ContactForm.jsx` |
| Contact API | `backend/src/routes/contactRoutes.js` (Resend) |
| Privacy / Terms | `frontend/src/components/PrivacyPolicy.jsx` (`/privacy`) |
| Footer / CTA band | `Footer.jsx`, `SubscribeSaveBand.jsx` |
| Unsubscribe | `Unsubscribe.jsx`; `emailRoutes.js`; `emails/unsubscribeToken.js` |
| Admin shell | `frontend/src/pages/Admin.jsx` |
| Shared admin chrome | `frontend/src/components/admin/*`, `styles/Admin*.css` |

---

## Product model

- **Marketing** — brand home, about, privacy; homepage categories via catalog.
- **Contact** — one-shot Resend email to ops (no DB row).
- **Unsubscribe** — HMAC link turns off reminder prefs only (not all mail).
- **Admin** — tabbed board behind `is_admin`.

---

## Contact

- Page fields: `name`, `email`, `message` → `POST /api/contact`.
- Env: `RESEND_API_KEY`, `CONTACT_TO` (csv), `CONTACT_FROM`.
- HTML-escaped body; `reply_to` = customer email.

---

## Unsubscribe

- URL: `/unsubscribe?token=…` (`unsubscribeUrl` / `createUnsubscribeToken`).
- Token: base64url(`userId`) + HMAC-SHA256 with **`CRON_SECRET`**.
- `POST /api/email/unsubscribe` → sets `email_prefs.wednesday_reminder` + `pause_reminder` to `false`.
- Charge receipts and other transactional mail **still send** — see [subscriptions.md](./subscriptions.md).

---

## Admin shell

Gate: session → `fetchUserByAuthId` → `is_admin` else redirect `/`.

Deep-link: `/admin?tab=…`.

| Tab key | Component | Wiki |
|---|---|---|
| `categories` | `CategoryAdmin` | [catalog.md](./catalog.md) |
| `products` | `ProductAdmin` | [catalog.md](./catalog.md) |
| `orders` | `OrderAdmin` | [alacarte.md](./alacarte.md) |
| `weekly-plans` | `SubscriptionAdmin` | [subscriptions.md](./subscriptions.md) |
| `subscriptions` | `SubscriberAdmin` | [subscriptions.md](./subscriptions.md) |
| `promos` | `PromoAdmin` | [promos.md](./promos.md) |
| `partners` | `PartnerAdmin` | [partners.md](./partners.md) |
| `users` | `UserAdmin` | [auth.md](./auth.md) |

Tabs lazy-render by `activeTab`; without `?tab=` the board shows header/tabs until a click.

---

## Cheat sheet

| Change | Open |
|---|---|
| Contact copy/fields | `Contact.jsx` / `ContactForm.jsx` |
| Resend routing | `contactRoutes.js` |
| Unsubscribe crypto | `unsubscribeToken.js` |
| Reminder prefs cleared | `emailRoutes.js` |
| Tab list / gate | `Admin.jsx` |
| Privacy / legal | `PrivacyPolicy.jsx` |
| Homepage shop sections | `Home.jsx` + [catalog.md](./catalog.md) |

---

## Quirks

1. Unsubscribe secret is `CRON_SECRET` (ops coupling).
2. Contact has no DB persistence (email only).
3. Admin write/list APIs for catalog, partners, orders list, users, and subscription admin/settings require admin Bearer (`requireAdmin`). Customer subscription manage / checkout still pending the next auth PR — see [auth.md](./auth.md).
4. `SubscribeSaveBand` is marketing CTA into subscriptions, not a separate product.

---

## Keeping this doc honest

When you add an Admin tab or change contact/unsubscribe behavior, update this page and the feature wiki for that tab.

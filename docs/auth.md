# Auth & customer account — internal wiki

Internal map of Supabase Auth signup/login, email confirmation, password reset, profile, and `is_admin`.

Support email: **hello@earthtableco.ca**.  
Partner wallet on profile: [Partners](./partners.md). Email reminder prefs: [Site & admin](./site-and-admin.md) + [Subscriptions](./subscriptions.md).

---

## Quick orientation

| Layer | Start here |
|---|---|
| Supabase clients | `frontend/src/supabaseClient.js`; backend `supabase/db` |
| Register / confirm | `backend/src/routes/registerRoutes.js`; `Register.jsx`, `AuthCallback.jsx` |
| Login / password | `Login.jsx` (client `signInWithPassword`); `UpdatePassword.jsx`, `ResetPassword.jsx`; `loginRoutes.js` |
| Profile / users API | `Profile.jsx`; `usersRoutes.js`; `queries/user.js` |
| Session host | `frontend/src/App.jsx` (`onAuthStateChange`, carts) |
| Admin flag UI | `UserAdmin.jsx`; gate `Admin.jsx` + `Navbar.jsx` |
| Client helpers | `frontend/src/helpers/userHelpers.js`, `adminHelpers.js` |

### Backend module map

| File | Owns |
|---|---|
| `registerRoutes.js` | Signup, confirmation upsert, resend |
| `loginRoutes.js` | Backend login / reset (UI mostly uses Supabase client for login) |
| `usersRoutes.js` | List/get/patch users |
| `user.js` | Queries + email_prefs helpers |
| `logoutRoutes.js` | Logout endpoint |

---

## Product model (one sentence)

Supabase Auth owns identity; an app `users` row (keyed by `auth_user_id`) holds profile + `is_admin`, created after email confirmation.

---

## Data fields

### Auth signup metadata
`first_name`, `last_name`, `phone_number` → `user_metadata`

### `users` (PATCH allowlist)
`first_name`, `last_name`, `country`, `phone_number`, `is_admin`, `address_line1/2`, `city`, `province`, `postal_code`, `email_prefs`

Decorated on read: `is_partner`, `referral_code` from `partners`.

---

## Flows

1. **Register** — `POST /api/register` → Supabase `signUp`, redirect `/auth/callback`; `202 needs_confirmation` or `409 already_registered`.
2. **Confirm** — `AuthCallback` sets session → `POST /api/register/confirmation` (Bearer) upserts `users` with `is_admin: false`.
3. **Login** — Client Supabase (not backend `/login`); `?next=` return path.
4. **Reset** — `POST /login/reset-password` → `/update-password`.
5. **Profile** — `/profile/:auth_user_id`; patch contact/address (not email). Partner payout block if partner.
6. **Admin** — `users.is_admin`; Navbar Admin link; `/admin` redirects home if false. Toggle in Users tab (cannot demote self).

---

## APIs

| Method | Path | Notes |
|---|---|---|
| POST | `/api/register` | Signup |
| POST | `/api/register/confirmation` | Needs Bearer |
| POST | `/api/register/auth/resend-confirmation` | |
| POST | `/api/login`, `/api/login/reset-password` | Backend login largely unused by UI |
| GET | `/api/users` | Admin Bearer required |
| GET/PATCH | `/api/users/me` | Bearer; self profile |
| GET/PATCH | `/api/users/:auth_user_id` | Bearer; self or admin. Non-admins cannot set `is_admin` |
| POST | `/api/logout` | |

---

## Admin

- Promote/demote via **Users** tab only (`UserAdmin.jsx`); API requires admin Bearer and strips `is_admin` for non-admins.
- Catalog writes, partner admin, orders list/picked-up, and subscription admin/settings use `requireAdmin` (Bearer + `users.is_admin`). Customer subscription manage still trusts client `userId` until the next auth PR.
- Client helpers: `frontend/src/helpers/authFetch.js` (Bearer + 401 refresh-once).

---

## Cheat sheet

| Change | Open |
|---|---|
| Signup / confirm upsert | `registerRoutes.js` |
| Callback / session exchange | `AuthCallback.jsx` |
| Login UX | `Login.jsx` |
| Profile fields | `Profile.jsx` + `userHelpers.js` |
| is_admin toggle | `UserAdmin.jsx` / `adminHelpers.updateUserAdmin` |
| Session + cart keys | `App.jsx` |
| Authenticated fetch | `authFetch.js` |
| API auth middleware | `backend/src/middleware/requireAuth.js` |

---

## Quirks

1. Login is client-side; register is server-side.
2. Duplicate email often detected via empty `identities`.
3. `email_prefs` editable via API/unsubscribe; Profile form does not expose reminder toggles.
4. Users GET/PATCH require Bearer; self-or-admin on `:auth_user_id`. Prefer `/users/me` for profile.
5. Cart keys merge guest → user on login (`cart_guest` → `cart_{id}`).

---

## Keeping this doc honest

When you change confirm/upsert or admin gating, update this wiki and note any impact on [Site & admin](./site-and-admin.md) / subscription manage auth.

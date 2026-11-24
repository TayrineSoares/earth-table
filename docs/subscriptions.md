# Weekly subscriptions — internal wiki

Internal map of Earth Table’s Subscribe & Save feature: how it works, where the code lives, and what to change when something breaks.

Customer-facing terms: [Privacy / Terms weekly section](../frontend/src/components/PrivacyPolicy.jsx).  
Support email in all copy: **hello@earthtableco.ca**.

---

## Quick orientation

| Layer | Start here |
|---|---|
| Schema | `backend/sql/subscriptions.sql` (+ `alter_subscription_notes_history.sql`, `alter_subscription_ops_events.sql`, `alter_stripe_delivery_pi.sql`) |
| Clock / holidays / week math | `backend/src/queries/subscriptionWeek.js` |
| HTTP API | `backend/src/routes/subscriptionRoutes.js` |
| Cron | `backend/src/routes/cronRoutes.js` + `backend/vercel.json` + `backend/vercel.crons.md` |
| Customer copy anchors | `frontend/src/helpers/subscriptionCadence.js` ↔ `backend/src/emails/subscriptionEmailSpec.js` |
| Manage UI | `frontend/src/pages/MySubscriptions.jsx` |
| Signup UI | `frontend/src/pages/SubscribeAndSave.jsx` → `SubscribeMeals` / `SubscribeAddons` / `SubscribeCart` / `SubscribeConfirmation` |
| API client | `frontend/src/helpers/subscriptionHelpers.js` |
| Email HTML | `backend/src/utils/emailTemplates.js` |
| Preview samples | `backend/scripts/preview-emails.js` |

### Backend module map

| File | Owns |
|---|---|
| `subscriptionWeek.js` | America/Toronto clock, holidays, signup first Sunday, charge/lock deadlines, human labels |
| `subscription.js` | Plans list/CRUD helpers, `listMine` / `listAll`, open-cycle edit, meal/addon save, fulfillment + mid-week delivery fee, settings, card-expiry cron helpers, ownership |
| `subscriptionCheckout.js` | First Stripe Checkout, signup webhook fulfill, welcome mail, card setup/complete |
| `subscriptionManage.js` | Pause / resume / cancel(=pause), plan change, discontinue, pause nudges, deadline notice, manage + owner event emails |
| `subscriptionCharge.js` | Tuesday plan+delivery charge, Wednesday add-ons + lock + kitchen order, holiday skip, `payment_failed`, `retryFailedCharge` |
| `requireAdminOrCron.js` | Admin JWT **or** cron secret for force charge/lock |
| `sendSubscriptionMail.js` | Pref check, customer/owner send helpers |
| `mealCountMatch.js` | Exact meal-count gates for plan change / resume review |

---

## Product model (one sentence)

Customers pick a weekly meal plan, meals, optional add-ons, and pickup or delivery. **Plan + delivery** bill every **Tuesday 9:00 AM ET**; **add-ons** bill and the box **locks** every **Wednesday 5:00 PM ET**. The kitchen order is created at lock, not at signup.

---

## Weekly cadence (America/Toronto)

| Event | When | What runs |
|---|---|---|
| Plan + delivery charge | **Tuesday 9:00 AM ET** | `runPlanCharge` |
| Add-ons + meal lock | **Wednesday 5:00 PM ET** | `runMealLock` (charge extras, create order, open next week, apply pending plan/status) |
| Pause nudges | **Monday 9:00 AM ET**, weeks **1** and **4** after pause | Pref-gated |
| Card expiry notices | Monday with pause cron | Within 30 days of expiry; once per card |

**Vercel UTC schedules** live in `backend/vercel.json` (why the UTC hours look odd: `backend/vercel.crons.md`). Charge has two Tuesday slots so DST never charges *before* 9am Toronto; lock is a single Wednesday slot that is never *before* 5pm.

**Test overrides:** Admin → Weekly plans → `test_charge_at` / `test_lock_at` on `subscription_settings` (`id = 1`).

**Holidays** (no charge, no box that Sunday): **Dec 25, 26, 31, Jan 1** — `subscriptionWeek.js` and `frontend/src/helpers/blockedDates.js`.

### Historical job names (do not rename)

`cutoff_runs` job ids stay `wednesday_charge` / `thursday_lock` even though live days are Tue/Wed. Renaming would re-run finished weeks. Pref key `wednesday_reminder` still gates the **Tuesday** meal reminder (not receipts).

---

## Data model (working knowledge)

### `subscription_plans`
Catalog: `name`, `meal_count` (frozen after create), `price_cents` (pre-tax), `is_active`, `discontinued_at`.

### `subscriptions`
One row per customer plan instance.

| Field | Meaning |
|---|---|
| `status` | `active` \| `paused` \| `cancelled` |
| `pause_reason` | `manual` \| `payment_failed` |
| `last_decline_code` / `last_decline_at` | Stripe decline on plan charge (owner/admin). Cleared on successful resume/card recovery. |
| `pending_plan_id` | Deferred size change (applies after this paid/locked Sunday) |
| `pending_status` | Rare. Customer pause after paid/locked → immediate `status=paused` with null pending (Sunday still ships). Legacy `paused` rows are cleared by the charge/lock job. `cancelled` = plan discontinue deferred until lock (this Sunday still ships). |
| Card | `stripe_customer_id`, `stripe_payment_method_id`, `card_updated_at` |
| Defaults | `delivery`, `delivery_postal_code`, `pickup_time_slot`, `special_note` |
| First-week promo | `first_promo_*` |

Customer **Cancel** in the UI calls the same path as **Pause** (keeps meals + card). True `cancelled` is mostly plan discontinue.

### `subscription_cycles`
One row per Sunday box (`unique (subscription_id, delivery_date)`).

| Field | Meaning |
|---|---|
| `status` | `open` → editable; `locked` → kitchen order exists; `skipped` → no box |
| Money | `plan_price_cents`, `delivery_fee_cents`, `plan_paid_cents`, `addon_paid_cents`, `promo_percent` |
| Snapshot | delivery/pickup fields, notes, `cutoff_at`, `order_id`, Stripe PI ids |

### Related
- `subscription_cycle_items` — `kind` `plan` \| `addon`
- `users.email_prefs` — default `{ wednesday_reminder, pause_reminder }` both true
- `checkout_drafts` — signup payload until Stripe webhook
- `subscription_notes_history`, `subscription_ops_events`, `subscription_card_expiry_notices`, `cutoff_runs`
- `orders.subscription_cycle_id` — kitchen link created at Wednesday lock

---

## Money rules

- Amounts are **integer cents pre-tax**; Stripe charges **`× 1.13` HST**.
- **Tuesday:** unpaid plan balance + delivery fee (if delivery). Idempotency: `sub-plan-{cycleId}-{sunday}-{pmId}`.
- **Wednesday:** unpaid add-ons (promo-aware). Idempotency: `sub-addon-{cycleId}-{sunday}`. Fail → strip unpaid add-ons + `addons_dropped` email; plan meals still go.
- **Signup (first box):** plan + delivery charged in Stripe Checkout; add-ons wait for Wednesday. First box **can't be cancelled** — pausing that week still keeps it shipping; later weeks stop. Resume later is **not** a new first box.
- **Resume / card-retry charge:** idempotency key adds a decline/pause suffix so a cached Tuesday decline is not replayed. If two writers race after Stripe succeeds, a sibling that already stored the same PaymentIntent is **not** refunded.
- **Delivery fee**
  - Unpaid week: fee stored on cycle → billed with Tuesday plan charge. Customer can switch back to pickup before Wednesday meal lock.
  - Paid week, pickup → delivery: charge delivery **now** (`idempotencyKey: sub-delivery-{cycleId}`); store `stripe_delivery_payment_intent_id`.
  - Delivery → pickup (paid, before lock): clear `delivery_fee_cents` and **auto-refund** delivery fee + tax from the delivery PI (or plan PI). Abort switch if refund fails.
- **Plan size change:** until Wednesday meal lock on an **open** cycle → apply this Sunday. Paid open weeks take a Stripe **downgrade refund** or **upgrade charge** (HST-aware delta from amounts actually paid). **Locked** → defer to next Sunday (`pending_plan_id`).
- **Pause / cancel (after first box):** until Wednesday meal lock — unpaid open → skip; **paid open → full Stripe refund** of plan (+ mid-week delivery) PIs then skip; **locked → keep** this Sunday (no refund). Cancel = pause.
- **Resume after refunded skip (before lock):** reopen that Sunday and charge again (`retryFailedCharge`).
- **Discontinue:** no refunds (`refunded_cents: 0`); paid/locked Sunday still ships.
- **Charge/pause race:** PI succeeds but cycle already skipped → Stripe refund (`subscription_charge_race_refund`). If another writer already marked the cycle paid with the same PI, do **not** refund.

---

## Customer flows → code

### 1. Signup
1. Marketing: `SubscribeAndSave.jsx`
2. Meals / add-ons / cart: `SubscribeMeals.jsx`, `SubscribeAddons.jsx`, `SubscribeCart.jsx` (+ `subscriptionCart.js`)
3. `POST /api/subscriptions/checkout` (Bearer) → `createSubscriptionCheckout` (user from token)
4. Stripe Checkout (`mode: payment`, save card for later)
5. Webhook `checkout.session.completed` `kind: subscription` in `backend/app.js` → `completeSubscriptionSignup` (no kitchen order yet)
6. Confirm: `SubscribeConfirmation.jsx` polls `GET /subscriptions/signup/:sessionId`

Second active/paused plan: UI **warns** (does not hard-block).

### 2. My Subscriptions
- Page: `MySubscriptions.jsx`
- Load: `GET /subscriptions/mine` (Bearer) → `listMine(req.user.id)`
- Nested edit routes: `…/:id/meals|addons|cart` → `SubscribeEditMeals` / `SubscribeEditAddons` / `SubscribeEditCart`

### 3. Edit meals / add-ons
- Save: `PATCH /subscriptions/:id/items` → `replaceOpenCyclePlanAndAddons`
- After Wednesday cutoff, edits target **next** Sunday (popup + dates in UI)
- Active save → box-updated email; paused resume-review path skips that mail (resume mail covers it)
- Deferred plan: editable next week uses **pending** plan meal count; pause clears deferred prep via `abandonDeferredPlanChange`

### 4. Pause / cancel / resume
- `PATCH /subscriptions/:id/status` `{ action: pause|resume|cancel }` → `subscriptionManage.js`
- **Unpaid** open week: pause **skips** this Sunday (no charge)
- **Paid open (before Wed lock):** full Stripe refund → skip → pause (`subscription_pause_refund`)
- **Locked:** this Sunday still ships; pause starts following week
- **Resume before Tue charge (manual):** reopen meals if needed, set `active` — **do not** charge now (customer may pause again). Tuesday job bills the open week.
- **Resume after Tue charge / before Wed lock (manual unpaid or refunded skip):** **`retryFailedCharge`** bills this cook week now so “resume by Wed” still gets the box.
- **`payment_failed` resume / card-update before Wed lock:** always **`retryFailedCharge`** now. Decline → stay paused (**402**).
- **`payment_failed` + Tuesday job:** paused plans are **not** auto-charged. No weekly retry — customer must update card or resume (for this Sunday before Wed lock, or later when ready).
- Customer copy: resume by **Wednesday 5:00 PM ET** for that Sunday’s box.
- Resume may require meal review (`meals_need_update`); auto-resume after save when flagged
- Recovery mail: resume / card-update success → welcome-back + owner notify (transactional)

### 5. Plan change
- `PATCH /subscriptions/:id/plan` → `changeSubscriptionPlan`
- Exact meal count required (`mealCountMatch.js`)
- Open week (paid or unpaid) until lock → `plan_now` (+ delta refund/charge when paid)
- Locked → `plan_next` / `pending_plan_id`

### 6. Pickup / delivery / notes
- `PATCH /subscriptions/:id/fulfillment` → `updateOpenCycleFulfillment`
- Method switch → customer + owner fulfillment emails
- Notes-only → `notes_updated` email + `subscription_notes_history`

### 7. Card update
- `POST /subscriptions/:id/card-setup` → Stripe Setup Checkout
- Webhook `kind: subscription_card` → `completeCardSetup`
- Confirm poll: `GET /card-setup/:sessionId`

### 8. Email unsubscribe
- Page: `Unsubscribe.jsx`
- `POST /api/email/unsubscribe` + `emails/unsubscribeToken.js`
- Turns off `wednesday_reminder` + `pause_reminder` only — **charge receipts and other transactional mail still send**

---

## API surface

Mounted under `/api/subscriptions` (see `subscriptionRoutes.js`).

| Method | Path | Notes |
|---|---|---|
| GET | `/plans?active=1`, `/plans/:id` (active) | Public catalog (no subscriber counts) |
| GET | `/plans` (no `active=1`) | Admin Bearer; inactive + counts |
| GET | `/dates` | Public signup cadence |
| GET | `/settings` | Admin Bearer; includes `test_charge_at` / `test_lock_at` |
| PATCH | `/settings` | Admin Bearer; test clocks |
| GET | `/mine` | Bearer; manage payload for signed-in user |
| GET | `/admin` | Admin Bearer; kitchen/subscriber board data |
| POST | `/admin/run-charge`, `/admin/run-lock` | **`requireAdminOrCron`** |
| POST | `/checkout` | Bearer; signup (`userId` from token; body mismatch → 400) |
| GET | `/signup/:sessionId` | Public confirm poll |
| POST | `/:id/card-setup` | Bearer + ownership |
| GET | `/card-setup/:sessionId` | Public confirm poll |
| PATCH | `/:id/items`, `/:id/fulfillment`, `/:id/status`, `/:id/plan` | Bearer + `getOwnedSubscription`; body `userId` mismatch → 400 |
| POST | `/plans` | Admin Bearer; create |
| PATCH | `/plans/:id` | Admin Bearer; price gated by `ALLOW_PLAN_PRICE_CHANGE` |
| POST | `/plans/:id/discontinue` | Admin Bearer; gated by `ALLOW_PLAN_DISCONTINUE` |

### Cron (`/api/cron`, `CRON_SECRET`)
- `/subscription-charge` → `runPlanCharge`
- `/subscription-lock` → `runMealLock`
- `/pause-reminder` → `sendPauseReminders`
- `/subscription-card-expiry` → `runCardExpiryNotices`
- `/subscription-deadline-notice` → `sendDeadlineNotice` (one-shot)

### Auth note
Subscription router is default-deny with a public allowlist (active plans, dates, signup/card-setup session GETs). Full plan list (inactive + subscriber counts) is admin-only. Customer manage/checkout use Bearer → `req.user.id`; optional body `userId` must match or returns **400**. Admin list/settings/plan mutations require admin Bearer. See [api-allowlist.md](./api-allowlist.md).

---

## Emails

Templates: `backend/src/utils/emailTemplates.js`.  
Send helpers: `sendSubscriptionMail.js`, `notifyManage` in manage/charge paths.

### Customer (high-signal kinds)

| Kind / render | When |
|---|---|
| Welcome | Signup complete |
| Box updated | Active meal/addon save |
| `notes_updated` | Notes-only save |
| `pause_*` / `resume` / `plan_now` / `plan_next` | Manage actions |
| `fulfillment_delivery` / `fulfillment_pickup` | Method switch (paid pickup copy mentions delivery-fee refund via hello@) |
| `payment_failed` | Tuesday decline |
| `addons_dropped` | Wed add-on charge failed |
| Charge / meal reminder | Tuesday (`wednesday_reminder` gates reminder only; receipts always) |
| Lock | Wednesday after lock |
| Holiday skip | Holiday charge path (active subs) |
| Meal mismatch | Locked qty ≠ plan size |
| Card expiry / price / discontinue / deadline | Matching jobs/admin |

### Owner
New sub; pause/resume/plan (resume subject `Resumed — {name}`; notes if charged); fulfillment switch; payment_failed; lock box list; meal mismatch; holiday; discontinue. Goes to `OWNER_NOTIFICATIONS_TO`.

**Not** emailed to owner on every meal edit (intentional — customer box-updated only).

---

## Admin

| UI | File | Role |
|---|---|---|
| Weekly plans tab | `SubscriptionAdmin.jsx` | Create plans, active flag, test charge/lock times, force Run charge/lock |
| Subscriptions tab | `SubscriberAdmin.jsx` | This/next Sunday boxes, paused, search, print |
| Host | `Admin.jsx` tabs `weekly-plans` / `subscriptions` |

Price change and discontinue are **env-gated** and UI-routed through Tayrine approval messaging. Do not treat live price rewrite as a normal ops path.

---

## Intentional / deferred behavior

| Item | Status |
|---|---|
| Customer Cancel ≡ Pause | Intentional |
| Owner not on every meal edit | Intentional |
| Admin plan price rewrite | Gated off; N/A while env false |
| Holiday email for `payment_failed` paused | Optional polish — they can still be skipped without holiday mail |
| Job names `wednesday_charge` / `thursday_lock` | Keep forever for idempotency |

---

## Cheat sheet — “I need to change X”

| Change | Open |
|---|---|
| Tue/Wed times, holidays, first Sunday | `backend/src/queries/subscriptionWeek.js` |
| Customer how-it-works / banners | `frontend/src/helpers/subscriptionCadence.js` + `subscriptionEmailSpec.js` |
| Cron UTC | `backend/vercel.json` + `vercel.crons.md` |
| Tuesday charge / Wed lock / holiday / payment_failed | `subscriptionCharge.js` |
| Pause / resume / plan / discontinue / nudges | `subscriptionManage.js` |
| Signup + card setup | `subscriptionCheckout.js` + `app.js` webhook |
| Meal save / fulfillment / listMine | `subscription.js` |
| Routes | `subscriptionRoutes.js` |
| Schema | `backend/sql/subscriptions.sql` |
| Manage UI | `MySubscriptions.jsx` |
| Signup UI | `Subscribe*.jsx` under `frontend/src/pages/` |
| Fetch wrappers / save dialogs | `subscriptionHelpers.js` |
| Email copy/HTML | `emailTemplates.js` |
| Pref samples | `backend/scripts/preview-emails.js` |
| Kitchen board | `SubscriberAdmin.jsx` |
| Plan catalog / test clocks | `SubscriptionAdmin.jsx` |
| Unsubscribe | `emailRoutes.js` + `Unsubscribe.jsx` |
| Privacy / legal cadence | `PrivacyPolicy.jsx` |
| Meal-count gates | `mealCountMatch.js` |

---

## Sandbox / regression checklist

1. Signup → confirm first Sunday, card on file, welcome mail; first box can't be cancelled (still ships if you pause that week).
2. Unpaid week: pause → skip; manual resume before Tue charge → activate only (Tue job bills); manual resume after Tue / before Wed lock → charge now; payment_failed resume/card-update before Wed lock → charge now.
3. After Tuesday charge, before Wed lock: pause → refund + skip; resume → re-charge. After lock: pause → this Sunday still ships.
4. Paid open plan change → this Sunday with delta refund/charge; locked → deferred next Sunday.
5. Payment-failed → update card with `wednesday_reminder` off → still get charge/resume confirmation.
6. Pickup → delivery unpaid → fee waits for Tuesday; switch back clears fee.
7. Paid week pickup → delivery → immediate delivery charge (+ stored delivery PI); delivery → pickup → auto-refund delivery fee.
8. Add-on charge fail at lock → extras stripped, plan meals lock, customer emailed.
9. Force charge/lock from Admin requires admin session (or cron secret).
10. Unsubscribe → no Tue meal reminder / pause nudges; receipts still arrive.

---

## Keeping this doc honest

When you change money, cadence, or status rules:

1. Update the code path.
2. Update **both** cadence files + Privacy weekly bullets if customer-visible.
3. Update this wiki in the same PR.
4. Regenerate email previews if copy changed (`backend/scripts/preview-emails.js`).

# Fulfillment quoting (pickup / delivery) — internal wiki

Internal map of shared pickup/delivery UI and Geoapify distance-based delivery fee quotes used by à la carte and subscriptions.

Support email: **hello@earthtableco.ca**.  
Billing of fees: [À la carte](./alacarte.md) (pay at checkout) · [Subscriptions](./subscriptions.md) (Tue plan charge / mid-week paid pickup→delivery).

---

## Quick orientation

| Layer | Start here |
|---|---|
| HTTP handler | `backend/api/delivery/quote.js` (+ mounts in `backend/server.js`) |
| Server reuse | `backend/src/lib/deliveryQuote.js` → `getServerDeliveryQuote` |
| UI | `frontend/src/components/DeliverySelector.jsx`, `PickupSelector.jsx` |
| Holidays | `frontend/src/helpers/blockedDates.js` |
| Callers | `Cart.jsx`, `SubscribeCart.jsx`, `MySubscriptions.jsx`; checkout re-check in `server.js` / `subscriptionCheckout.js` / `subscription.js` |
| Pickup address copy | `frontend/src/helpers/orderHelpers.js` (`PICKUP_ADDRESS`) |

---

## Product model (one sentence)

Pickup uses date + fixed slots; delivery geocodes a Canadian postal code from kitchen coords and bands a fee by Haversine km (or rejects out-of-zone).

---

## Zones / fees

Env: `GEOAPIFY_KEY`, `PICKUP_LAT`, `PICKUP_LON`.

| Distance | Result |
|---|---|
| ≤ 10 km | `fee_cents: 1500` ($15 pre-tax) |
| ≤ 30 km | `fee_cents: 3000` ($30 pre-tax) |
| > 30 km | `{ ok: false, reason: "OUT_OF_ZONE", km }` |
| Bad PC / geocode miss | `INVALID_POSTAL` |
| Missing env | `SERVER_MISCONFIG` |

Logic is **duplicated** in `quote.js` and `deliveryQuote.js` (lib adds 5s abort). Keep both in sync. HST is applied at checkout/charge, not in the quote.

---

## Pickup / delivery UI rules

| Rule | Where |
|---|---|
| ≥ 24h notice | Both selectors (`minDateTime`) |
| Pickup slots | `10:00-13:00`, `14:00-16:30` |
| Delivery window copy | 11:00 AM – 6:00 PM (no slot picker) |
| Holidays | `12-25`, `12-26`, `12-31`, `01-01` |
| iOS date | Validate on blur, not change |
| Full address | Delivery → special instructions / notes |

Subscriptions often lock the Sunday date (`lockedDate` / `showDateField={false}`) and use an explicit **Calculate** button for quotes. À la carte Cart **auto-quotes** when postal is valid.

---

## Flows

1. **One-off cart** — Auto-quote → fee shown → checkout re-quotes with `getServerDeliveryQuote` (client fee not authoritative).
2. **Subscribe signup / manage** — Calculate → store `delivery_fee_cents` on cart/cycle → Tuesday or immediate charge per [subscriptions.md](./subscriptions.md).
3. **Holidays** — FE blocks selection; à la carte checkout also rejects; subscription week math uses the same MM-DD set in `subscriptionWeek.js`.

---

## APIs

`POST /api/delivery/quote` (and `/delivery/quote`)  
Body: `{ postalCode }`  
Success: `{ ok: true, km, fee_cents }`  
Failure: `{ ok: false, reason, km? }`

---

## Cheat sheet

| Change | Open |
|---|---|
| Fee bands / max km | `backend/api/delivery/quote.js` **and** `backend/src/lib/deliveryQuote.js` |
| Pickup slots / 24h | `PickupSelector.jsx` |
| Delivery date UX | `DeliverySelector.jsx` |
| Holidays (FE) | `blockedDates.js` |
| Holidays (sub cadence) | `subscriptionWeek.js` |
| Auto vs Calculate quote | `Cart.jsx` vs `SubscribeCart.jsx` / `MySubscriptions.jsx` |
| Kitchen origin env | `PICKUP_LAT`, `PICKUP_LON`, `GEOAPIFY_KEY` |

---

## Quirks

1. Keep both quote implementations in sync — easy drift source.
2. `Cart.jsx` may use `VITE_API_BASE` + `/api/delivery/quote`; sub pages often use relative `/api/delivery/quote`.
3. Quote CORS allowlist only in the serverless handler file.
4. Privacy/legal may say Sunday delivery for one-offs; the date picker does **not** force Sunday — see [alacarte.md](./alacarte.md) quirks.
5. No admin UI for bands/origin — env + code constants only.

---

## Keeping this doc honest

When you change zones or 24h rules, update **both** quote modules, selectors, Privacy if customer-visible, and the money docs that consume fees.

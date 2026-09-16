# Components

Reuse these. Do not rebuild Navbar, Footer, FeedbackDialog, or cart popup on a new page.

## Chrome (already mounted)

**Navbar** — `frontend/src/components/Navbar.jsx` + `styles/NavBar.css`

- Always rendered from `App.jsx`
- Links: About, Menu (`/products/category`), Subscribe & Save, Contact, Account dropdown, cart icon
- Desktop (≥1280): 123px bar, Encode Sans 15 small-caps, centered 720px link row
- Mid (951–1279): same bar, links right-aligned
- Mobile (≤950): 76px bar, hamburger, full-screen cream drawer, Forum 24 links, taupe separators
- Active/hover: tangerine underline
- Cart dot when `cart.length > 0`
- Account: click-outside + Enter key; close drawer on navigate
- Hamburger is `display: none` only at `min-width: 1280px`

**Footer** — `components/Footer.jsx` + `styles/Footer.css`

- Taupe `#D9C7B0`, padding matches page (120 → 60 @1024 → stacked @768)
- Logo, copyright small-caps, privacy `Link`, phone, address, Instagram (`lucide-react`)
- Stacks to a centered column at 768

Do not put page-specific links in the footer unless asked. Do not duplicate footer inside a page (Home’s “homepage-footer” is in-content, not `<footer>`).

## Feedback and modals

**FeedbackDialog** — `components/FeedbackDialog.jsx` + `styles/FeedbackDialog.css`

Use for auth and blocking messages (Login, Register). API:

```js
setDialog({
  icon: 'alert', // 'mail' | 'login' | 'alert'
  title: 'Login failed',
  body: 'Invalid login credentials.',
  hint: 'Check your email and password…', // optional
  primaryLabel: 'Got it',
  secondaryLabel: 'Forgot password?', // optional
  secondaryTo: '/reset-password',     // optional; renders Link
});
```

Behavior to copy for any new overlay:

- `role="dialog"` + `aria-modal="true"`
- Overlay click closes; inner click `stopPropagation`
- Escape closes
- Lock `document.body.style.overflow` while open
- Cream panel, `4px solid #EDA413`, 18px radius, `z-index: 9999`
- Primary: full-width max 280px, 52px, filled tangerine, black text
- Secondary: underline tangerine, no background

**Product detail modal** — in `pages/ProductCard.jsx` + `Products.css`

- Overlay `overscroll-behavior: contain`
- Card `max-height: calc(100vh - 36px)`, column flex
- Body `overflow-y: auto; -webkit-overflow-scrolling: touch`
- Image `clamp(200px, 35vh, 320px)`

Cart checkout also has a blocking overlay pattern (`.checkout` modal in `Cart.css`): cream, `4px solid #EDA413`. Copy that for cart-adjacent confirms.

## Forms

Canonical public form: `components/ContactForm.jsx` + `styles/ContactForm.css`.

```jsx
<div className="field-block">
  <p className="your-name-header">Email</p>
  <input className="your-name-input" type="email" placeholder="NAME@EXAMPLE.COM" required />
</div>
<button className="contact-submit-button" type="submit">Send Message</button>
```

Rules:

- Labels are Forum 30 small-caps `#BE7200` (`<p>`, not always `<label>` — match the page you copy)
- Placeholders uppercase small-caps
- `font-size: 16px` on text inputs (prevents iOS zoom). Login still uses 15px — new fields should be 16px
- `box-sizing: border-box`; 100% width from 1024/768
- `type="email"` / `type="tel"` / `inputMode` where it helps the mobile keyboard
- Submit: outline tangerine, 311px desktop, **100% from 1024**, 58px height
- Status: `role="status"` `aria-live="polite"` (ContactForm)
- `e.preventDefault()`; POST JSON to `/api/...`

**Do not** use `alert()` for success/error. Wire `FeedbackDialog` like Login/Register.

Register two-column name/email rows collapse to one column at 1366. Copy that for wide forms.

Checkbox + Privacy Policy: Register pattern — required boolean, error via dialog if unchecked, `Link` to `/privacy`.

## Catalog

**ProductCard** — `pages/ProductCard.jsx` (styles in `Products.css`)

- Peach tag chips + lucide icons over the image
- Price then name
- Clamp description; “View details” only if overflowing (resize listener)
- Add to cart / Sold out
- Modal for full description

If you add a card grid, keep `.products` + `.products-container` rather than a new card system.

## Cart widgets

**CartPopup** — `components/CartPopup.jsx`, mounted in `AppRoutes` (not on `/cart`)

- Fixed right, 375px; keep `max-width: 100vw` in mind if you restyle it
- Sage header, cream body, tangerine checkout chip

**PickupSelector** / **DeliverySelector** — `styles/PickupSelector.css`

- Labels Encode Sans 16px small-caps `#757575`
- Inputs 16px+, taupe 1.5px border, 10px radius, tangerine focus ring
- `type="date"`: set value in `onChange`, **validate in `onBlur`** (iOS date spinner fires change while scrolling)
- Parse `YYYY-MM-DD` as local (`new Date(y, m - 1, d)`), never `new Date('YYYY-MM-DD')`
- Errors as text under the field, not `alert`

## Admin pieces

- Tabs and page chrome: `Admin.css`
- Per-entity CSS: `ProductAdmin.css`, `CategoryAdmin.css`, `OrderAdmin.css`, `UsersAdmin.css`, `PromoAdmin.css`, `PartnerAdmin.css`
- Forms: `ProductForm.css`, `CategoryForm.css` — 16px inputs, tangerine borders
- Loading: `components/AdminTabLoading.jsx`

New admin UI should look like an existing tab panel (peach header row, cream table, tangerine controls), not like a marketing page.

## Icons, images, assets

- `lucide-react` for UI icons
- Page photos: `frontend/src/assets/images/` (import, do not hotlink except existing Unsplash custom-meals hero)
- Logo files: `earthLogo.png`, `earthLogoText.png`, `logoNoBackground.png`, `blackLogo.png`
- Header photos: `headerImage.png` (home), `aboutHeaderPhoto.png`, `contactHeader.png`, `accountImage.png`, `checkoutImage.png`

Give `<img>` an `alt`. Decorative heroes may use `alt=""`.

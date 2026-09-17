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

**ProductCard** — `pages/ProductCard.jsx` (shared Menu + subscribe). Live reference: Choose your meals (`SubscribeCatalog` + `SubscribeFlow.css`). Bring **Menu** in line with this chrome; do not copy the old borderless Menu card.

Markup (keep these classes; do not invent a second card):

```
.products
  tags (absolute, top-left) + selected check (absolute, top-right)
  image
  header (.product-header-info-container: name left, optional price right)
  description
  .product-card-actions
    .view-details-slot
    .product-add-button-container   /* Add, compact stepper, or Add to cart */
```

### Chrome

- Cream fill, `border-radius: 15px`, `overflow: hidden`, `box-sizing: border-box`
- Unselected: `2px solid #D9C7B0` (taupe — subtle, not gray invented)
- Selected (`quantity > 0`): `2px solid #EDA413`, peach fill `#FEE8D4`, Lucide `Check` in a 28px tangerine circle, top-right
- Keep 2px on both states so the card does not jump
- Image `object-fit: cover`; tags over the photo (smaller chips on dense grids: ~11px / 12px icons)

### Type and clamp

- Name: Forum 30px small-caps, **2-line** `-webkit-line-clamp`, `flex: 1; min-width: 0; min-height: 2.4em` (2 × title line-height so one- and two-line titles share a row height)
- Description: Encode Sans 20px, **2-line** clamp on catalog grids
- Clamp on **lines**, not characters. `overflow-wrap: break-word`; `word-break: normal`; `hyphens: none` (never `hyphens: auto` / `overflow-wrap: anywhere` — that hyphen-breaks “co-conut”)
- Equal-height rows: title `min-height: 2.4em`; description 2-line min-height; card is `display: flex; flex-direction: column`; `.product-card-actions { margin-top: auto }` so Add buttons line up across a grid row

### Footer row

- **View details** (only if description overflows) and **Add** share one row: details left, Add/stepper right (`justify-content: space-between`)
- At qty 0: compact outlined **Add** (not a full-width gold stepper)
- Qty > 0: compact stepper (`is-compact`), still on the right
- Sold out: same outline button, `disabled`
- Compact Add/stepper ~44px tall, `min-width` not `width: 100%`. iOS `-webkit-text-fill-color: #000`

### Price (catalog cards)

Name and price sit on **one row**, not stacked. Live CSS is `.product-header-info-container` in `Products.css` (Menu). Copy this onto add-ons / any catalog grid that still stacks them:

```css
.product-header-info-container {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.product-header-name {
  flex: 1;
  min-width: 0;
  min-height: 2.4em;
}
.product-header-price {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 24px; /* Encode Sans, brown #BE7200; smaller than the 30px Forum name */
}
```

- Title may wrap to two lines; price stays on the **first-line baseline**, right edge, and must not wrap or shrink
- Do not put a min-height on the header that assumes a stacked name+price (the old 69px / 93px subscribe overrides)
- A-la-carte / add-ons **keep the price**. Plan meals: `hidePrice` (name still uses the same row; it just expands)
- Popup/cart can show a-la-carte price and savings later. **If cents === 0, do not render a price**

### Props (do not split into two card components)

| Prop | Menu | Plan meals | Add-ons |
| --- | --- | --- | --- |
| `addToCart` | yes | no | no |
| `onIncrement` / qty | no | yes | yes |
| `hidePrice` | false | true | false |
| `compactAdd` | false (full ADD TO CART) | true | true |

Grid: `.products-container`. Subscribe meals is 4-col with `gap: 36px 40px` (more column gap than row). Category chips stay peach; drop filler category descriptions under the section title (they push food below the fold).

**Product detail modal** — same file + `Products.css`

- Overlay `overscroll-behavior: contain`
- Card `max-height: calc(100vh - 36px)`, column flex
- Body `overflow-y: auto; -webkit-overflow-scrolling: touch`
- Image `clamp(200px, 35vh, 320px)`

## Cart widgets

**CartPopup** — `components/CartPopup.jsx`, mounted in `AppRoutes` (not on `/cart`)

- Fixed right, 375px; keep `max-width: 100vw` in mind if you restyle it
- Sage header, cream body, tangerine checkout chip

**SubscribeCartPopup** — `components/SubscribeCartPopup.jsx` (signup flow only)

- Title **Your weekly plan** (minimized bar too)
- Rows use full popup width. Name expands; no “Meal” label
- QTY stepper and Lucide `Trash2` on one row; trash far right (`aria-label` Remove)
- Continue on the **right** of the footer; meal count on the left
- Hide `$0.00`. When extras add a charge, label it **Add-ons $X.XX**

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

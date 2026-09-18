# Page patterns

Copy the closest live page. Navbar + Footer are already in `App.jsx` — pages only render the main column.

Routes live in `frontend/src/AppRoutes.jsx`. New pages must also be exported from `frontend/src/pages/index.js`.

## Which shell to copy

| New page kind | Copy | Hero | Wrapper |
| --- | --- | --- | --- |
| Marketing / editorial | `Contact.jsx` + `SubscribeAndSave.jsx` | `contactHeader.png` (234px) | `.page-wrapper` |
| About-style story + photo | `About.jsx` | `aboutHeaderPhoto.png` (234px) | `.page-wrapper` + optional dark `.sub-footer` |
| Home-style landing | `Home.jsx` | Tall `.header-images` (663px) | `.page-wrapper` under the hero |
| Menu / catalog | `Products.jsx` | None (optional in-content hero) | `.page-wrapper` only |
| Auth / account | `Login.jsx` | `accountImage.png` via `.contact-header-image-container` | `.page-wrapper` |
| Checkout / orders | `SubscribeCart.jsx` (layout) + `Cart.css` / `OrderHistory.jsx` | `checkoutImage.png` (234px) | `.page-wrapper` |
| Admin | `Admin.jsx` | None | `.admin-page` card, max-width 1000px |
| Legal | `components/PrivacyPolicy.jsx` | None | `.et-terms` (this page is visually distinct — do not reuse for marketing) |

## Shared markup

```jsx
<div className="your-page">
  {/* hero: omit on Menu + Admin */}
  <div className="contact-header-image-container">
    <img className="contact-header-image" src={header} alt="" />
  </div>

  <div className="page-wrapper">
    {/* Forum 62 or 38 title */}
    {/* content */}
  </div>
</div>
```

Reuse `.contact-header-image-container` from `Contact.css` (Subscribe already imports it) instead of duplicating hero CSS.

## Marketing pages

**Home** — `frontend/src/pages/Home.jsx` + `styles/Home.css`

- Full-bleed hero, logo + Forum 62 overlay
- Zigzag rows: text + image, `.zigzag-content.reverse` on odd items
- Section title: Forum 38 + tangerine underline
- CTA: filled `.shop-button` (389px desktop, 100% from 1024)
- At 1024, zigzag stacks; `reverse` also becomes column (image after text)
- Loading: Lottie inside `.page-wrapper`

**Contact** — `pages/Contact.jsx` + `styles/Contact.css` + `ContactForm`

- 234px hero, Forum 62 title, Forum 38 subtitle
- Form in the wrapper (see [components.md](components.md))

**Subscribe & Save** — `pages/SubscribeAndSave.jsx` + `styles/SubscribeAndSave.css`

- Same Contact hero classes
- Forum 62 marketing title; plan picker is a later section (38px)
- Peach how-it-works / plan cards; see Subscribe flow under Menu below

**About** — `pages/About.jsx` + `styles/About.css`

- 234px hero
- Title + body + side image row; stacks at 1024
- Full-bleed dark olive `.sub-footer` with Forum quote (outside `.page-wrapper`)

## Account pages

**Login / Register / Reset / Update / Profile** share:

- `accountImage.png` in `.contact-header-image-container`
- Forum 62 “Account” (Login/Register) or page title
- Login/Register tab pair: Forum 38, active underline tangerine (`text-underline-offset: 10px`)
- Field label Forum 30 small-caps `#BE7200`
- Inputs 15px radius, padding `19px 51px`, small-caps placeholders
- Outline submit button (cream + tangerine border)
- iOS `-webkit-text-fill-color: #000` on submit
- At 768: inputs/buttons `width: 100%`; Login hides `.see-password`

Copy **Login** for simple forms, **Register** for multi-field + validation banner + `FeedbackDialog`, **Profile** for labeled read/edit grid (`profile-grid`).

Profile phone fields: `type="tel"`, `inputMode="numeric"`, store digits only, display `(XXX) XXX-XXXX`.

## Menu

**Products** — `pages/Products.jsx` + `ProductCard.jsx` + `styles/Products.css`

When restyling Menu, match the **item card chrome** in [components.md](components.md) (Choose your meals is the live example). Do not keep the old borderless card.

- No top hero
- Forum 62 “Menu”
- Peach `.categories` chips (wrap, `white-space: normal`)
- Section title 38px; **no filler category description** under the header
- Search input 16px font, tangerine border, `#fff8f0`
- Grid `.products-container`; prefer 4-col on wide screens with extra **column** gap
- Cards: taupe unselected border, 15px radius, 2-line name + 2-line description, no hyphen-break
- Footer: View details + Add to cart on **one row** (details left, Add right)
- A-la-carte **keeps the price on the same row as the name** (right, 24px); sold out uses the same outline button `disabled`
- Load 6 at a time; `.load-more-button` is the brown exception
- Custom-meals category uses in-page 234px hero + prose, not the grid
- Loading: Lottie, `minHeight: 80vh`

## Subscribe flow (meals)

**SubscribeMeals** / **SubscribeEditMeals** — `SubscribeFlow.css` + `SubscribeCatalog`

- Flow pages use Forum **38px** section title (`.subscribe-choose-title`), not 62px marketing display
- Order: title → plan line (`10 meals · $180.00/week · Change plan`) → mix/cutoff helper → live tracker + muted count
- Plan meals: `hidePrice` + `compactAdd`. Selected gold border / peach tint / check
- Sticky bar at the bottom: `X of Y meals selected` + Continue

**SubscribeAddons** / **SubscribeEditAddons** — same catalog chrome as meals

- 38px title (`.subscribe-choose-title`): **Add extras**
- Plan line then selling helper (“Top off this week…”). Muted line: extras won’t repeat. Back to meals is the muted plan-line link
- Cards: `compactAdd`, **price on the same row as the name** (right, 24px Encode Sans). Selected marker same as meals
- Sticky: hide `$0.00`; show subtotal only when extras add a charge

**SubscribeAndSave** — `pages/SubscribeAndSave.jsx` + `styles/SubscribeAndSave.css`

- Contact-style hero classes; Forum 62 marketing title
- Plan cards: number + `meals / week`; filled Select only on Most Popular; others ghost with black text

## Checkout / orders

**Live checkout to copy: SubscribeCart** — `pages/SubscribeCart.jsx` + `styles/SubscribeFlow.css` + `styles/Cart.css`.

When restyling à-la-carte `Cart.jsx`, match this page. Do not keep the old stacked radios / auto-quote / single grand HST as the visual source.

Shell: `checkoutImage.png` (234px) + `.page-wrapper` + two columns (summary left, items right). Columns stack at **849px**. Left summary max-width **640px**.

### Left column order

1. **Review & Confirm** (Forum 62) + optional peach savings pill. Taupe `1px solid #D9C7B0` divider under the hero.
2. **Summary sections** — Forum **24** `.subscribe-summary-heading` with tangerine underline. Label and price on **one row** (`display: flex; justify-content: space-between`). Reset `<p>` margin on those rows (default paragraph margin is why the old summary looked huge).
   - Plan / items first. Delivery fee sits with the plan, not with extras.
   - **hst** is a line **inside each section** (plan+delivery, then add-ons). No muted `+ hst` beside prices. No single grand HST row.
   - Promo discount (if applied) lives in the plan section, above that section’s hst.
   - Taupe divider, then **Total**. Split “Due today” / “billed later” only when extras exist.
3. **How you'll get it** — taupe divider, then heading, then Pickup / Delivery **radios with visible dots** (`.subscribe-fulfill-option`): 20px circle, taupe ring, tangerine fill when selected, Encode Sans 15 small-caps labels, 44px tap. Not peach chips.
4. Pickup or delivery fields (see [components.md](components.md)).
5. Special instructions (extra space above the box).
6. Locked delivery date **after** the notes box: `First Delivery - Sunday, September 27th, 11:00 AM- 6:00 PM`.
7. **Promo code** heading (same 24px underline), 16px before the input, taupe divider above the block.
8. Taupe divider, privacy checkbox, then Confirm CTA. Button stays clickable; missing fields open **FeedbackDialog** (`asList` when more than one).

### Right column

- Compact 64px thumbs. Name + cream/tangerine outlined qty stepper (`.subscribe-cart-qty`) on one row, stepper far right.
- Edit meals / Edit add-ons as muted brown links.

### Copy that is subscribe-only (do not copy onto à-la-carte)

- Title **Review & Confirm**; savings pill; Subscription terms dialog; First Pickup / First Delivery locked Sunday; Calculate on delivery (do not auto-quote); hide empty add-ons in the summary.

À-la-carte still picks its own date. Reuse the **layout, dividers, radios, per-section hst, promo heading, and missing-field dialog**.

**Confirmation / OrderHistory** — same hero + `Cart.css`. Confirmation card: cream, `2px solid #EDA413`, 15px radius.

## Admin

**Admin** — `pages/Admin.jsx` + `styles/Admin.css`

- Guard with supabase session + `fetchUserByAuthId` → redirect `/` if not admin
- Centered card, no hero, no `.page-wrapper`
- Forum 62 title, brown welcome line
- Peach tabs, active `#EDA413` (white text on active is existing — keep it here only)
- Tab panels are components (`CategoryAdmin`, `ProductAdmin`, …) with their own CSS
- While a tab fetches: `AdminTabLoading`

Admin tables already have 768 stacked-card patterns in `PartnerAdmin.css`. Copy that if a new admin list would overflow a table.

## Loading, empty, error

| State | Pattern |
| --- | --- |
| Page fetch | `lottie-react` + `loading.json` in `.loading-container` |
| Admin tab fetch | `AdminTabLoading` |
| Form/auth error | `FeedbackDialog` (`icon`, `title`, `body`, `hint`, labels) |
| Inline field error | Register: red border + `#fff6f4`; Pickup: `.pickup-error` under the field |
| Empty list | Order History empty copy + outline/filled CTA |

Do not add `alert()` (Reset Password still has it — that is legacy; new work uses FeedbackDialog).

## Routing extras

- Cart popup (`CartPopup`) is rendered by `AppRoutes`, hidden on `/cart`. Subscribe signup uses `SubscribeCartPopup` instead. Do not mount another one.
- `Link` / `NavLink` for in-app navigation. External: `target="_blank"` + `rel="noopener noreferrer"` (Footer Instagram).
- Keep `fetch('/api/...')` relative; Vite proxies to the backend.

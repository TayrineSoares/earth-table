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
| Checkout / orders | `Cart.jsx` / `OrderHistory.jsx` / `Confirmation.jsx` | `checkoutImage.png` (234px) | `.page-wrapper` |
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
- Centered column, tangerine-underlined 38px title
- Peach pill subhead, 20px body, peach/tangerine meal counts

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

- No top hero
- Forum 62 “Menu”
- Peach `.categories` chips (wrap, `white-space: normal`)
- Section title 38px + description
- Search input 16px font, tangerine border, `#fff8f0`
- Grid `.products-container` `gap: 36px`; card 372px → 47% @1024 → 100% @768
- Card image `object-fit: cover` (477px desktop, 372 @768)
- Name 2-line clamp, description 3-line clamp (`-webkit-box`)
- Outline add-to-cart; sold out uses same button `disabled`
- Load 6 at a time; `.load-more-button` is the brown exception
- Custom-meals category uses in-page 234px hero + prose, not the grid
- Loading: Lottie, `minHeight: 80vh`

## Checkout / orders

**Cart / Confirmation / OrderHistory** use `checkoutImage.png` and `styles/Cart.css`.

- Forum 62 summary title
- Two-column layout stacks at 849–1024
- Line items: image + Forum 38 name + brown price + taupe bottom border
- Qty stepper: tangerine 16px type
- Checkout CTA: filled tangerine, 100% width from 1024
- Promo row stacks at 480
- Confirmation card: cream, `2px solid #EDA413`, 15px radius
- Empty/error states stay inside `.page-wrapper` with the same CTA class

Pickup/delivery widgets: [components.md](components.md). Date validation on **blur**, never inside `onChange`.

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

- Cart popup (`CartPopup`) is rendered by `AppRoutes`, hidden on `/cart`. Do not mount another one.
- `Link` / `NavLink` for in-app navigation. External: `target="_blank"` + `rel="noopener noreferrer"` (Footer Instagram).
- Keep `fetch('/api/...')` relative; Vite proxies to the backend.

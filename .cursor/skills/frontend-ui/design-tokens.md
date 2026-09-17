# Design tokens

Source of truth: `frontend/src/index.css`, `frontend/index.html`, and existing page CSS. Do not invent new colors, fonts, or radii.

## Fonts

Loaded in `frontend/index.html`:

- Headings: **Forum** (`var(--heading-font)`, `'Forum', serif`) — weight 400 only
- Body / UI: **Encode Sans** (`var(--body-font)`, `'Encode Sans', sans-serif`) — 400 body, 500 buttons/chips/nav

Use the CSS variables, not hardcoded family names, except where an existing file already uses `'Forum'` / `"Encode Sans"` — match that file if you are editing it.

Light color scheme only (`color-scheme: light` in `:root` and `index.html`).

## Type scale

Copy these sizes. Shrink them in media queries; do not invent a parallel scale.

| Role | Font | Size | Notes | Examples |
| --- | --- | --- | --- | --- |
| Display / page title | Forum | 62px | line-height 100% | `.account-text`, `.contact-text`, `.product-title-text`, `.checkout-summary-text`, `.admin-header h1` |
| Section title | Forum | 38px | underline `2px solid #EDA413`, `display: inline-block` | `.category-title`, `.about-title`, `.subscribe-title`, `.category-title-2`, `.confirmation-title` |
| Field label | Forum | 30px | `small-caps`, color `#BE7200` | `.login-detail-header-text`, `.your-name-header`, `.register-text` |
| Product name | Forum | 30px | `small-caps`, 2-line clamp, **left** of price on catalog cards | `.product-header-name` |
| Body / description | Encode Sans 400 | 20px | line-height ~1.3 | `.category-description`, `.about-description`, `.subscribe-body` |
| Catalog price | Encode Sans 400 | 24px | color `#BE7200`, **same row** as the name (right, nowrap) | `.product-header-price` |
| Cart / checkout price | Encode Sans 400 | 20px | color `#BE7200` | `.checkout-item-price` |
| UI / button / chip / nav | Encode Sans 500 | 15px | `small-caps`, letter-spacing 0.6px or 4% | `.shop-button`, `.categories`, `.nav-link` |
| Muted helper | Encode Sans 400 | 15px | `small-caps`, `#525448` or `#757575` | `.forgot-password-text`, `.pickup-label`, `.general-text` |
| Dialog title | Forum | 32px | | `.feedback-dialog-title` |
| Dialog body | Encode Sans 400 | 16px | | `.feedback-dialog-body` |

At 768px drop display to ~36px, section to ~28px, body to 16px. At 480px display ~28px, section ~24px, body 14px. See Home/About/Contact CSS.

`.general-text` in `index.css` is the shared muted small-caps helper (15px Encode Sans).

## Color palette

| Token | Hex | Use |
| --- | --- | --- |
| Cream (page) | `#FFFBF3` | `html, body` background; outlined buttons; cards |
| Tangerine | `#EDA413` | Primary accent: underlines, borders, filled CTAs, focus rings, active chips |
| Peach | `#FEE8D4` | Category chips, tags, inactive admin tabs, banners |
| Brown | `#BE7200` | Field labels, prices, links-in-copy, admin welcome text |
| Taupe | `#D9C7B0` / `#D8C7B0` | Footer bg, cart dividers, pickup input borders, **unselected product-card border**, mobile nav separators |
| Sage | `#ABC586` | Cart popup header / qty buttons |
| Leaf underline | `#709E30` | Home “plenty more to discover” underline only |
| Dark olive | `#202211` | About page sub-footer bar |
| Black | `#000` | Headings, body, button text |
| White | `#FFF` | Home hero overlay text; rare filled-on-dark |
| Muted | `#757575` | Qty labels, pickup hints |
| Account muted | `#525448` | Login footer links |
| Input wash | `#fff8f0` | Focused/search/profile inputs |
| Error | `#c0392b` | Register validation (`#fff6f4` wash) |
| Overlay | `rgba(0,0,0,0.45)`–`0.55` | Modals / FeedbackDialog |
| Focus ring | `rgba(237, 164, 19, 0.25)` | `box-shadow: 0 0 0 2px` on inputs |

Do not introduce new brand colors. Gray admin badges (`#f3f4f6`, `#dbeafe`, etc.) already exist on Profile/Partner admin — copy those files if you need status pills.

## Layout

`.page-wrapper` (`frontend/src/index.css`):

- `max-width: 1440px`
- `margin: 0 auto`
- `width: 100%`
- `box-sizing: border-box`
- Padding: **120px** → **40px** at 1024 → **20px** at 768 → **16px** at 480

`html, body`: `margin: 0`, `overflow-x: hidden`, background `#FFFBF3`.

Hero heights:

| Shell | Height | Class |
| --- | --- | --- |
| Home banner | 663px (500 @1024, 350 @480) | `.header-images` |
| Inner marketing / account / checkout | 234px (200 @1024, 180 @768, 160 @480) | `.contact-header-image-container`, `.about-images`, `.checkout-page-header-image`, `.custom-meals-hero` |

Images inside heroes: `width/height 100%`, `object-fit: cover`.

## Shape and controls

- Primary buttons and text fields: `border-radius: 15px`
- **Product cards:** 15px radius + `2px solid #D9C7B0`; selected `2px solid #EDA413` + peach fill (see [components.md](components.md))
- Compact search / load-more: `8px`
- Pickup/select: `10px`
- Pills (subscribe subhead, modal tags): `999px`
- Dialogs: `18px` radius, often `4px solid #EDA413` border
- Admin card: `15px` + light `box-shadow: 0 0 10px rgba(0,0,0,0.05)`

**Primary CTA** (Shop Now, Login, Send Message, Add to Cart):

- Height **58px** (52–50px on small screens)
- Encode Sans 15px / 500 / small-caps
- Either filled `#EDA413` / text `#000` / no border, or outline `1–2px solid #EDA413` on `#FFFBF3`
- `:active { transform: scale(0.98); background: #EDA413; }`
- iOS: `-webkit-appearance: none; -webkit-text-fill-color: #000 !important;` — copy Login/Contact/Register

**Chip / tab:** peach `#FEE8D4`, 15px radius, padding `8px 11px`, active `#EDA413`.

**Load more** is the exception: `#BE7200` fill, white text, 8px radius. Do not use it as a general CTA.

## Spacing rhythm (from live pages)

- Section padding top ~55px (40 @1024, 20 @480)
- Zigzag / about bottom padding ~76–118px
- Form field label → input: 15px
- Input padding: `19px 51px` desktop → `20px` @768 → `12px 16px` @480
- Flex gaps: 1–2rem content, 10px chips, product grid `36px` rows / **`40px` columns** on the 4-col meals catalog
- In-copy secondary actions (Change plan): muted `#757575`, 15px — do not compete with brown prices

## Links and icons

- Global `a { color: inherit; text-decoration: none; }`
- Active nav / account tabs: underline `#EDA413`, offset ~10px (page tabs) or 3px (nav)
- In-copy action links: color `#BE7200`
- Icons: `lucide-react` (16px in tags, 25px Instagram in footer, 40px dialog)
- Loading: `lottie-react` + `frontend/src/assets/loading.json` in `.loading-container` (300px, centered, often `minHeight: 80vh`)

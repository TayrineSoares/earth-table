# Responsive and mobile browsers

New and edited UI must work in **desktop Chrome**, **iOS Safari**, and **Android Chrome**. Match existing breakpoints; add iOS/Android fixes on every control that needs them.

`frontend/index.html` already sets:

- `width=device-width, initial-scale=1.0`
- `format-detection: telephone=no, date=no, email=no, address=no` (do not rely on auto-link styling)
- `color-scheme: light`
- `apple-mobile-web-app-capable` + default status bar
- `apple-touch-icon`

Do not remove those. Do not add a user-scalable=no viewport.

## Breakpoints (page CSS)

Use **max-width**, same four steps as Home/About/Contact/Products/Footer:

| Max width | Intent |
| --- | --- |
| 1366px | Laptop: smaller type, narrower fixed images |
| 1024px | Tablet: stack rows, CTAs `width: 100%`, heroes shorter |
| 768px | Large phone: single column, 16px body, inputs full width |
| 480px | Small phone: smallest type, tighter padding, full-bleed cards |

Navbar is separate: hamburger at **950px**, mid nav 951–1279, full desktop **1280+**. Do not restyle `<nav>` from a page stylesheet.

Extra breakpoints already used (only add if you are extending that page):

- Cart: 1224, 849
- Footer padding: 1024 → 60px

At 768 and 480, always set:

```css
.your-input,
.your-button,
.your-text-block {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
```

Replace desktop fixed widths (`width: 550px`, `width: 389px`, `width: 588px`) in those queries. Never leave a 1098px form field on a phone (ContactForm already fluid from 1366).

## Layout rules

- `overflow-x: hidden` on `html, body` — still avoid children wider than the viewport (`100vw` + padding is a common bug).
- Flex rows that are side-by-side on desktop become `flex-direction: column` at 1024 (Home zigzag, About, Cart items).
- Grids wrap: category chips, admin tabs, product cards (372px → 47% → 100%).
- Heroes: `overflow: hidden` + `object-fit: cover`. Height shrinks at 1024/768/480; do not use a huge fixed height on small screens.
- Footer and checkout summaries stack; right-aligned footer content centers at 768.
- Tap targets: primary buttons 58px (min ~44px). Chips keep comfortable padding (`8px 11px`). Cart qty circles are 16px font, large hit area.

## iOS Safari (required)

Copy these from Login/Contact/Register/Products — they exist because Safari overrides native controls.

### 1. Buttons stay black

Safari can force white/gray text on `<button>` / `input[type=submit]`.

```css
.your-submit,
.your-submit * {
  -webkit-appearance: none;
  appearance: none;
  color: #000 !important;
  -webkit-text-fill-color: #000 !important;
}
.your-submit:focus,
.your-submit:hover,
.your-submit:active,
.your-submit:disabled {
  color: #000 !important;
  -webkit-text-fill-color: #000 !important;
}
```

### 2. Inputs do not zoom

If `font-size` is under 16px, iOS zooms the page on focus. Use **16px** on `input`, `select`, `textarea` (ContactForm, search, pickup, admin forms). New fields must not use 15px.

### 3. Date / time pickers

iOS fires `onChange` while the spinner is still moving. **Do not validate or `alert` in `onChange`.**

Pattern from `PickupSelector.jsx` / `DeliverySelector.jsx`:

- `onChange`: store the string, clear errors
- `onBlur`: validate, holidays, 24h cutoff
- Parse `YYYY-MM-DD` as local date, not UTC

### 4. Overflow and 100vh

- Prefer `min-height` + flex for page loading, not `height: 100vh` for layout (address bar shrinks/grows).
- Overlays: `position: fixed; inset: 0; padding: 18px;`
- Scrollable sheets: `max-height: calc(100vh - 36px); overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;`
- Lock body scroll while a dialog is open; restore on close (FeedbackDialog, ProductCard).

### 5. Text clamp

Use the existing `-webkit-box` / `-webkit-line-clamp` / `-webkit-box-orient: vertical` pattern for product titles and descriptions.

### 6. Hover-only UI

Login password eye is mouse-down to reveal and **`display: none` under 768**. Do not ship features that only work on hover. Provide tap (button, dialog, toggle) or hide on touch widths.

### 7. Safe areas (new work)

Existing CSS does not pad `env(safe-area-inset-*)`. For new fixed UI (sticky bars, full-bleed footers, bottom sheets), add:

```css
padding-bottom: max(12px, env(safe-area-inset-bottom));
```

Do not let fixed controls sit under the home indicator.

### 8. Keyboard and autofill

- Correct `type`, `inputMode`, `autoComplete` (see Profile phone).
- `enterKeyHint` on long textareas (ContactForm uses `"enter"`).
- Autofill may restyle fields; keep cream/peach backgrounds explicit.

## Android Chrome

- Use `appearance: none` with `-webkit-appearance: none` so Chrome and Safari match.
- `input[type=date]` / `select` native pickers differ — keep validation on blur and never assume desktop calendar UI.
- Ripple/highlight: if a tap flash looks wrong, `tap-highlight-color` is allowed; do not disable all touch feedback.
- `overflow-x: hidden` on body + `box-sizing: border-box` prevents Chrome’s overscroll showing white gutters.
- 1px borders: prefer 1.5px on pickup-style inputs (already used) so they do not disappear on density buckets.

## Touch and pointer

- Click-outside menus: Navbar uses `mousedown` — fine for account dropdown; on new overlays also close on tap outside.
- Do not rely on `:hover` for essential state (underline-on-hover is ok as extra).
- Disabled controls: `cursor: not-allowed` plus visual wash (`#F4F1EA` pickup select).
- `user-select: none` only on steppers (cart qty), not on body copy.

## Images and media

- Always `max-width: 100%` or explicit fluid width at 1024+
- `object-fit: cover` for heroes, cards, subscribe circle
- Give images height so layout does not jump; Lottie sits in a fixed `.loading-container` (300px)

## Accessibility that this UI already uses

- Dialog: `role="dialog"`, `aria-modal`, labelled title
- Icon-only buttons: `aria-label` (password eye, modal close, Instagram)
- Status text: `aria-live="polite"`
- Keyboard: Escape closes dialogs; Account is `tabIndex={0}` + Enter
- Prefer this over adding a parallel a11y system

## Verification matrix

Before finishing a UI change, exercise the flow (not just a screenshot):

1. Desktop ~1440 — wrapper padding 120px, no clipped Forum titles
2. Tablet ~768–1024 — stacked columns, hamburger at ≤950, full-width CTAs
3. Phone ~390 — 480px rules, no horizontal scroll, 16px inputs, black submit text
4. Open a modal/dialog — scroll the sheet, close via overlay + Escape, page behind does not scroll
5. If the screen has `type="date"`, change the date in a WebKit-like flow and confirm validation runs after blur

If you cannot open a browser, say so. Do not claim iOS/Android support from desktop CSS alone.

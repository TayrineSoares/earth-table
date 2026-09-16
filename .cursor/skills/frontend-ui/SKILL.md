---
name: frontend-ui
description: Builds and restyles Earth Table frontend pages so they match existing CSS, layout, and mobile patterns. Use when adding or editing React pages, components, styles, routing, forms, dialogs, or files under frontend/src; when making UI responsive for iOS Safari or Android Chrome; or when matching fonts, colors, buttons, and page shells.
---

# Earth Table frontend UI

Match **existing pages**. Do not introduce Tailwind, CSS modules, styled-components, or a new design system.

Stack: React 19 + Vite + `react-router-dom` + plain CSS. Navbar and Footer already wrap every route in `frontend/src/App.jsx`.

## Always do this first

1. Read [design-tokens.md](design-tokens.md).
2. Pick the closest existing page from [page-patterns.md](page-patterns.md) and copy its shell.
3. Reuse components from [components.md](components.md).
4. Apply breakpoints and mobile-browser rules from [responsive.md](responsive.md).
5. Register the route if this is a new page.

## New page workflow

Copy this checklist:

```
- [ ] Closest existing page identified and copied
- [ ] Page JSX in frontend/src/pages/
- [ ] CSS in frontend/src/styles/ (one file, imported by the page)
- [ ] Exported from frontend/src/pages/index.js
- [ ] Route added in frontend/src/AppRoutes.jsx
- [ ] Content sits in .page-wrapper (unless Admin/legal exception)
- [ ] Hero/header matches the chosen shell
- [ ] Forum headings, Encode Sans body, tangerine accent
- [ ] Media queries at 1366 / 1024 / 768 / 480
- [ ] Inputs >= 16px; buttons use iOS text-fill fix
- [ ] Works without hover; tap targets >= 44px
- [ ] No horizontal scroll; images object-fit: cover
- [ ] Loading = Lottie; errors = FeedbackDialog (not alert)
```

### File layout

```
frontend/src/pages/YourPage.jsx
frontend/src/styles/YourPage.css
frontend/src/pages/index.js          # add named export
frontend/src/AppRoutes.jsx           # add <Route>
```

Keep presentational CSS in `frontend/src/styles/`. Put shared tokens only in `frontend/src/index.css`. Import images from `frontend/src/assets/images/`. Fetch via `/api/...` (Vite proxy).

### Page shell (default)

```jsx
import "../styles/YourPage.css";
import headerImage from "../assets/images/contactHeader.png";

const YourPage = () => (
  <div className="your-page">
    <div className="contact-header-image-container">
      <img src={headerImage} className="contact-header-image" alt="" />
    </div>
    <div className="page-wrapper">
      <h1 className="your-title">Title</h1>
      {/* content */}
    </div>
  </div>
);

export default YourPage;
```

Copy the header class from Contact (`contact-header-image-container`, 234px) unless the page is Home, Menu, Admin, or checkout — see [page-patterns.md](page-patterns.md).

## Hard rules

- **CSS only** as sibling stylesheets. Reuse class names from the closest page when the look is the same.
- **Typography:** `var(--heading-font)` (Forum) for titles; `var(--body-font)` (Encode Sans) for body, buttons, nav, chips. Buttons and chips use `font-variant: small-caps`.
- **Color:** page bg `#FFFBF3`, accent `#EDA413`, peach chips `#FEE8D4`, labels/prices `#BE7200`. Full palette in [design-tokens.md](design-tokens.md).
- **Width:** do not invent a new max-width. Public pages use `.page-wrapper` from `frontend/src/index.css`.
- **Radius:** 15px on primary buttons, text fields, and **product cards**; 8–10px on compact controls. Card border: taupe unselected, tangerine selected — [components.md](components.md).
- **Primary CTA:** 58px tall, 15px radius, Encode Sans 15px / 500 / small-caps. Filled `#EDA413` or outline `#EDA413` on `#FFFBF3`.
- **iOS/Android is required**, not optional. Follow [responsive.md](responsive.md) on every new or edited screen.
- **No `alert()`** for user feedback. Use `FeedbackDialog`.
- **No hover-only actions.** If desktop uses hover, provide a tap equivalent (or hide the control below 768px, as Login does with the password eye).
- **Do not re-render Navbar/Footer** inside a page.
- **Do not change** `index.html` viewport/PWA meta unless asked.

## Responsive minimum

Every new stylesheet must include:

```css
@media (max-width: 1366px) { /* tighten type and fixed widths */ }
@media (max-width: 1024px) { /* stack flex rows; CTAs width 100% */ }
@media (max-width: 768px)  { /* single column; inputs width 100%; type 16px */ }
@media (max-width: 480px)  { /* smallest type/spacing; full-bleed cards */ }
```

At 768px and below: `width: 100%`, `max-width: 100%`, `box-sizing: border-box` on forms, buttons, and text blocks. Navbar hamburger is already at 950px — do not duplicate nav.

## Verify before finishing

Exercise the screen the way a user would (click, type, submit, open/close dialogs). Then check:

| Width | What to confirm |
| --- | --- |
| ~1440 | `.page-wrapper` padding 120px; no stretched type |
| ~768 | stacked layout; hamburger nav; no overflow-x |
| ~390 | 480px styles; full-width CTAs; inputs do not zoom on iOS |

Also confirm: overlay/modals fit in the visual viewport, date pickers validate on **blur** not `onChange`, and submit button text stays **black** on iOS Safari.

If browser tools are unavailable, say so and use the closest substitute (existing CSS media queries + `curl` will not catch layout).

## Additional resources

- Tokens, type scale, buttons: [design-tokens.md](design-tokens.md)
- Page shells and which file to copy: [page-patterns.md](page-patterns.md)
- Navbar, forms, dialogs, **product cards**: [components.md](components.md)
- Breakpoints, iOS Safari, Android Chrome: [responsive.md](responsive.md)

# Menu catalog & browsing — internal wiki

Internal map of Earth Table’s products, categories, tags, storefront browsing, and admin CRUD.

Support email: **hello@earthtableco.ca**.  
Orders that sell these items: [À la carte](./alacarte.md). Weekly meals also pull from the same catalog: [Subscriptions](./subscriptions.md).

---

## Quick orientation

| Layer | Start here |
|---|---|
| HTTP | `backend/src/routes/productsRoutes.js`, `categoriesRoutes.js`, `tagsRoutes.js` |
| Queries | `backend/src/queries/product.js`, `category.js`, `tags.js` |
| Storefront | `frontend/src/pages/Home.jsx`, `Products.jsx`, `ProductCard.jsx`, `ProductDetail.jsx` |
| Admin UI | `ProductAdmin.jsx`, `ProductForm.jsx`, `CategoryAdmin.jsx`, `CategoryForm.jsx` |
| Client helpers | `frontend/src/helpers/adminHelpers.js`, `imageHelpers.js` |
| Storage | Supabase buckets `products-images`, `category-images` |
| Routes | `/` home; `/products/category/:categoryId?`; `/products/:id` |

### Backend module map

| File | Owns |
|---|---|
| `product.js` | List/get/create/update/archive, image upload, tag set |
| `category.js` | CRUD + homepage flag + image upload |
| `tags.js` | Read-only tag list |
| `productsRoutes.js` / `categoriesRoutes.js` / `tagsRoutes.js` | HTTP surface |

---

## Product model (one sentence)

Categories group products; products have price, availability, and archive flags plus optional dietary tags; the homepage shows categories flagged `show_on_homepage`.

---

## Data fields (from code)

### `categories`
`name`, `image_url`, `description`, `show_on_homepage`

### `products`
| Field | Meaning |
|---|---|
| `slug` | Display name (not a URL slug) |
| `description` | Body copy |
| `price_cents` | Pre-tax cents (> 0) |
| `image_url` | Public CDN URL |
| `category_id` | Parent category |
| `is_available` | Sold-out gate (`false` → listed but cannot add) |
| `is_active` | Archive (`false` → hidden from menu) |
| `created_at` | Ordering |

### `tags` / `product_tags`
`tags`: `id`, `name` (read-only API). Junction: `product_id`, `tag_id`. List responses expose `tags` as tag id arrays.

**Two flags:** `is_active=false` → archived (hidden on `Products.jsx`). `is_available=false` → still listed, cannot add to cart/sub (sold out).

No product/category create scripts under `backend/sql` — tables live in Supabase.

---

## Flows

1. **Home** — `GET /api/categories`, client-filter `show_on_homepage`; zigzag shop links to `/products/category/:id`. Non-homepage cats used as footer teasers.
2. **Menu** — `GET /api/products` + categories + tags; filter `is_active`; optional category + slug search; paginate.
3. **Detail** — `GET /api/products/:id` → add to cart / subscribe pickers.
4. **Admin Menu** — CRUD via form; image upload; tags multi-select; archive `PATCH …/archive`; sold-out toggles `is_available`.
5. **Admin Categories** — create/update/delete + image; `show_on_homepage` checkbox.

---

## APIs

Local Vite rewrites `/api/*` → backend `/*`; production mounts Express under `/api`. Prefer paths the frontend calls (`/api/...`).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/products`, `/api/products/:id` | Catalog |
| GET | `/api/products/category/:categoryId` | Exists; UI often client-filters all |
| POST | `/api/products` | Body includes `tag_ids` |
| PATCH | `/api/products/:id`, `/api/products/:id/archive` | Archive body `{ active }` |
| POST | `/api/products/upload` | multer → public URL |
| GET/POST | `/api/products/:id/tags` | Replace-all tag set |
| GET | `/api/categories`, `/api/categories/homepage` | Home uses full list + client filter |
| POST/PATCH/DELETE | `/api/categories`, `/api/categories/:id` | Hard delete |
| POST | `/api/categories/upload` | |
| GET | `/api/tags` | No write API |

---

## Admin

| Tab | Component |
|---|---|
| **Menu** | `ProductAdmin.jsx` |
| **Categories** | `CategoryAdmin.jsx` |

- Tags: assign only; no tag admin UI.
- Price stored cents; form edits dollars.
- No route hard-deletes products (`deleteProductById` unused by routes).
- Write routes require admin Bearer (`requireAdmin`). Public GETs stay open.

---

## Cheat sheet

| Change | Open |
|---|---|
| List/create/update/archive | `product.js` + `productsRoutes.js` |
| Category homepage flag | `category.js` / `CategoryForm.jsx` |
| Storefront filters/icons | `Products.jsx` (`tagIcons`) |
| Admin list UX | `ProductAdmin.jsx` |
| Image CDN sizing | `frontend/src/helpers/imageHelpers.js` |
| Add-to-cart from menu | `ProductCard.jsx` / `ProductDetail.jsx` / `CartPopup.jsx` |

---

## Quirks

1. Display name field is `slug`, not a URL slug; detail route is numeric id.
2. `GET /categories/homepage` exists; Home does not call it.
3. Tag icon map is hardcoded lowercase names in `Products.jsx`.
4. Sold-out (`is_available`) vs archived (`is_active`) are easy to mix up in support tickets.

---

## Keeping this doc honest

When you change availability rules or homepage selection, update the storefront filters + this wiki. Price/tax display changes usually also touch [À la carte](./alacarte.md) checkout.

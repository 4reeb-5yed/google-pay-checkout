# Phase 2 Implementation Plan — Store Frontend Pages (Catalog, Product Detail, Cart)

This plan covers Phase 2 of the V2 Master Plan (`docs/v2_master_plan.md`). It implements the client-side store experience (Catalog, Product Detail, Cart pages) using plain Vanilla JS and CSS, connecting to the Express REST API built in Phase 1.

The existing v1 Google Pay integration code in `src/*.js` remains completely untouched during Phase 2.

---

## User Review Required

> [!NOTE]
> **Visual Design System**: Replaces the v1 dark glass-panel theme entirely with a light neutral palette (`--bg-page: #fafafa`, `--bg-surface: #ffffff`, `--accent: #2563eb`, system typography stack) matching `docs/v2_ux_design_spec.md`.
> **Inert Buy with G Pay Placeholder**: Per instructions, the "Buy with G Pay" express guest checkout button on the product detail page will be rendered as a disabled/inert placeholder. The actual Google Pay SDK integration will be wired up in Phase 3 (Codelab Section 8).
> **Routing**: Uses real path-based client-side routing via HTML5 History API (`window.history.pushState`, `popstate` listener, `location.pathname`: `/`, `/product/:id`, `/cart`). Supported by Phase 1's `server.js` fallback `app.get('*', ...)` route.

---

## Open Questions

None. All Phase 2 requirements are explicitly detailed in `docs/v2_master_plan.md` and `docs/v2_ux_design_spec.md`.

---

## Proposed Changes

### Frontend Design System & Assets

#### [MODIFY] [style.css](file:///e:/google-pay-antigravity-checkout/style.css)
- Implement light neutral visual design system tokens per UX spec Section 2.
- Layout rules for Header, Catalog Grid, Product Detail Split, Cart Table/List, Sticky Rail, Toast Notifications, and Empty States.

#### [NEW] [public/js/svg-assets.js](file:///e:/google-pay-antigravity-checkout/public/js/svg-assets.js)
- Clean, crisp SVG product illustrations for catalog items (Smart Hub, Mic Kit, AI Camera, Charging Dock, Carry Case, Cable Set, Desk Mount, Pro/Starter Plans).

---

### Client Application & Store Pages

#### [MODIFY] [index.html](file:///e:/google-pay-antigravity-checkout/index.html)
- Replace v1 single-page demo markup with a clean header (Logo, category nav tabs, cart badge icon), main container view (`#app`), toast container, and footer.

#### [NEW] [public/js/app.js](file:///e:/google-pay-antigravity-checkout/public/js/app.js)
- Session manager (`X-Session-ID` persistence via localStorage).
- Client API fetch wrapper (`apiFetch`).
- History API router (`/`, `/product/:id`, `/cart` via `pushState` and `popstate` event listener). Intercepts internal link clicks (`<a href="...">`).
- View components:
  1. **Catalog View (`/`)**: Filter tabs (All, Devices, Accessories, Plans), 10-product responsive grid, category filter without reload.
  2. **Product Detail View (`/product/:id`)**: Split layout, price, quantity selector, subscription term disclosures, estimated price total (`Est. $X–$Y`), "Add to Cart" button with toast, inert "Buy with G Pay" placeholder button.
  3. **Cart View (`/cart`)**: Itemized list, thumbnail, quantity stepper, line totals, text-link "Remove" with toast undo, sticky summary rail with estimated fee range, "Proceed to Checkout" CTA button (placeholder link to `/checkout`), empty cart state.
- Cart count badge listener updating header cart count on any cart modification.

---

### Documentation & Permanent Record

#### [NEW] [docs/implementation-plans/phase-2-store-pages.md](file:///e:/google-pay-antigravity-checkout/docs/implementation-plans/phase-2-store-pages.md)
- Permanent repo copy of the Phase 2 implementation plan, saved at phase completion before git commit.

---

## Verification Plan

### Manual & Automated Verification
1. Start Express server (`node server.js`).
2. Run automated test suite (`scratch/test_phase2.js`) verifying:
   - **Path Fallback Routes**: `GET /`, `GET /product/smart-hub`, `GET /cart` return `200` with `index.html`.
   - **Catalog API**: `GET /api/products` returns 10 products.
   - **Category Filtering**: `GET /api/products?category=Devices`, `Accessories`, `Plans` filter correctly.
   - **Product Detail API**: `GET /api/products/smart-hub` returns product attributes.
   - **Cart API**: `POST /api/cart`, `PATCH /api/cart/items/:itemId`, `DELETE /api/cart/items/:itemId` add, update, and remove items correctly.
   - **Price Estimate API**: `POST /api/checkout/estimate` computes subtotal and surcharge fee ranges (`Est. total: $165.14–$165.80`).

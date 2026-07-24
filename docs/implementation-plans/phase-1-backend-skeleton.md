# Phase 1 Implementation Plan — Backend Skeleton & Data Infrastructure

This plan covers Phase 1 of the V2 Master Plan (`docs/v2_master_plan.md`). It establishes the Node + Express backend infrastructure, SQLite database schema, 10-product seed catalog, cart REST API endpoints, and server-side subtotal calculation.

No Google Pay integration code in `src/` will be modified in Phase 1.

---

## User Review Required

> [!NOTE]
> **Node Version & `node:sqlite`**: The environment is running Node.js **`v24.15.0`**. Native `node:sqlite` (`DatabaseSync`) is available out of the box without flags or external dependencies.
> **Session Handling**: Guest cart sessions will be identified using a client-generated UUID passed in the `X-Session-ID` HTTP header, stored in `carts.session_id` (`UNIQUE`).
> **Repo Documentation Standing Instruction**: At the end of every phase before committing, the finalized `implementation_plan.md` will be saved into the repo at `docs/implementation-plans/phase-N-<short-name>.md` (e.g., `docs/implementation-plans/phase-1-backend-skeleton.md`).

---

## Open Questions

None. All Phase 1 requirements are explicitly specified in `docs/v2_master_plan.md`.

---

## Proposed Changes

### Backend Infrastructure

#### [MODIFY] [.gitignore](file:///e:/google-pay-antigravity-checkout/.gitignore)
- Add `node_modules/` and `store.db` (and `store.db-journal`/`store.db-wal`) to ignore untracked runtime artifacts.

#### [NEW] [package.json](file:///e:/google-pay-antigravity-checkout/package.json)
- Define Node project dependencies (`express`).
- Define scripts: `"start": "node server.js"`, `"dev": "node --watch server.js"`.

#### [NEW] [db/schema.sql](file:///e:/google-pay-antigravity-checkout/db/schema.sql)
- SQL DDL for SQLite database:
  - `products` (id TEXT PRIMARY KEY, name TEXT, category TEXT, price_cents INTEGER, description TEXT, image TEXT, type TEXT, recurrence_period TEXT, recurrence_period_count INTEGER)
  - `carts` (id TEXT PRIMARY KEY, session_id TEXT UNIQUE NOT NULL, created_at DATETIME, updated_at DATETIME)
  - `cart_items` (id TEXT PRIMARY KEY, cart_id TEXT, product_id TEXT, quantity INTEGER, UNIQUE(cart_id, product_id))
  - `orders` (id TEXT PRIMARY KEY, session_id TEXT, subtotal_cents INTEGER, surcharge_cents INTEGER, total_cents INTEGER, status TEXT, created_at DATETIME)
  - `order_items` (id TEXT PRIMARY KEY, order_id TEXT, product_id TEXT, name TEXT, quantity INTEGER, unit_price_cents INTEGER)

#### [NEW] [db/database.js](file:///e:/google-pay-antigravity-checkout/db/database.js)
- Initializes SQLite database (`store.db`) using `node:sqlite`.
- Auto-runs schema migration and seeds 10 products if the catalog is empty:
  - **Devices**: Smart Hub ($149.99), Wireless Mic Kit ($89.99), AI Dev Camera ($199.99)
  - **Accessories**: Charging Dock ($29.99), Carry Case ($19.99), USB-C Cable Set ($14.99), Desk Mount ($34.99)
  - **Plans**: Pro Monthly ($14.99/mo), Pro Annual ($149.99/yr), Starter ($0.00)

#### [NEW] [server.js](file:///e:/google-pay-antigravity-checkout/server.js)
- Express server configuration listening on port 3000.
- Serves static files (`index.html`, `src/`, `style.css`, assets).
- Mounts REST API routes under `/api`:
  - `GET /api/products`: List products (optional `?category=` query filter).
  - `GET /api/products/:id`: Get single product details.
  - `GET /api/cart`: Get cart items and computed subtotal for current session (`X-Session-ID`).
  - `POST /api/cart`: Add item to cart (`{ productId, quantity }`).
  - `PATCH /api/cart/items/:itemId`: Update cart item quantity (`{ quantity }`).
  - `DELETE /api/cart/items/:itemId`: Remove item from cart.
  - `POST /api/checkout/estimate`: Compute server-side subtotal and estimated fee range ($0.1\%\text{–}0.5\%$).

#### [NEW] [docs/implementation-plans/phase-1-backend-skeleton.md](file:///e:/google-pay-antigravity-checkout/docs/implementation-plans/phase-1-backend-skeleton.md)
- Permanent repo copy of the Phase 1 implementation plan, created at phase completion before git commit.

---

## Verification Plan

### Automated Verification
1. Run `npm install` to install Express.
2. Run `node server.js` and verify database initialization and seed data insertion.
3. Test API endpoints using Node fetch scripts / `curl`:
   - Verify `GET /api/products` returns 10 products.
   - Verify `GET /api/products?category=Devices` returns 3 devices.
   - Test adding an item to cart via `POST /api/cart` and retrieving it via `GET /api/cart`.
   - Test updating quantity (`PATCH /api/cart/items/:itemId`) and removing item (`DELETE /api/cart/items/:itemId`).
   - Test `POST /api/checkout/estimate` to ensure correct server-side pricing.

### Manual Verification
- Start server and open `http://localhost:3000` in browser to confirm static files continue serving cleanly.

# V2 Master Plan — Real Store + Faithful Codelab Implementation

This plan governs the evolution of `google-pay-checkout` from a single static
demo page into a real mixed-marketplace store, while keeping the Google Pay
integration itself a literal, faithful implementation of the codelab
(*"Google Pay API: Vibe-code checkout page with MCP servers and Antigravity"*).

Branch: `v2-real-store`. `main` is untouched — it remains the complete, working
v1 record.

---

## 1. The scope boundary (the core principle everything else follows)

The codelab's own language is explicit: *"integrate the Google Pay API into
**a checkout page**"* and *"directly on **the product details page**."*
Singular, pre-existing pages. The codelab never describes building a store —
it assumes one exists and is only responsible for what happens once Google
Pay gets wired into two specific pages.

This gives a clean, non-negotiable boundary:

| | Governed by | Constraint |
|---|---|---|
| **Store** (catalog, cart, browsing, categories) | Our own design judgment | None — real backend, real routes, whatever makes sense |
| **Checkout integration** (product page's Buy Now + cart's Checkout page) | The codelab, literally | Vanilla JS at the payment-integration layer, MCP-grounded, every scaffolding instruction followed exactly |

Vanilla JS applies to the *payment integration code* specifically — not to
whether the frontend fetches from a real backend API. A `fetch('/api/cart')`
call is not a framework; the DOM manipulation and Google Pay wiring stay
plain JS either way.

---

## 2. Store concept

**Positioning:** a mixed tech/creator-gear marketplace — physical devices and
accessories, plus a "Plans" category of cloud/software subscriptions that
extend the hardware. This gives the subscription category a real reason to
sit next to physical goods, rather than two unrelated sections sharing a nav
bar for no reason.

**Catalog — 10 products across 3 categories:**

| Category | Products | Type |
|---|---|---|
| Devices | Smart Hub, Wireless Mic Kit, AI Dev Camera | physical |
| Accessories | Charging Dock, Carry Case, USB-C Cable Set, Desk Mount | physical |
| Plans | Pro Monthly ($14.99/mo), Pro Annual, Starter (free) | subscription |

**Product data model:**
```
Product {
  id, name, category, price, description, image, type: 'physical'|'subscription',
  // subscription-only:
  recurrencePeriod, recurrencePeriodCount
}
```

**Pricing disclosure improvement:** since exact surcharge only resolves after
a card is chosen inside Google's sheet, the product/cart pages show an
honest estimate range up front — *"Est. total: $84.99–$85.42 · final price
depends on card type"* — resolved to an exact number on the review screen
before authorization, per the codelab's own stated pattern in Section 5.

---

## 3. Site architecture — real pages, real flow

| Page | Route | Purpose | Codelab scope? |
|---|---|---|---|
| Catalog | `/` | Browse, filter by category | No — our design |
| Product Detail | `/product/:id` | Full product view **+ express guest checkout ("Buy Now")** | **Yes — Section 8** |
| Cart | `/cart` | Add/remove/adjust quantity, running total | No — our design |
| Checkout | `/checkout` | Full Google Pay scaffold, dynamic pricing, MIT recurring | **Yes — Sections 4, 5, 6** |

Two real, distinct checkout entry points — matching how the codelab actually
splits its own examples, which v1 collapsed into one page:
- **Buy Now** (product page) → guest checkout, single item, minimal friction
- **Cart → Checkout** → full cart, potentially mixed physical + subscription
  items, full review screen

---

## 4. Backend architecture

**Stack:** Node + Express + SQLite (single file, zero external service
dependency — matches the project's existing "no infrastructure you don't
need" discipline).

```
GET    /products                 catalog list, ?category= filter
GET    /products/:id             single product
GET    /cart                     current cart (session/client-token based)
POST   /cart                     add item
PATCH  /cart/:itemId             update quantity
DELETE /cart/:itemId             remove item
POST   /checkout/estimate        server-computed subtotal (source of truth)
POST   /checkout/confirm         after loadPaymentData() resolves — persists
                                  order, applies surcharge, simulates TEST
                                  settlement
GET    /account/subscriptions    real endpoint behind managementUrl
POST   /token/update              real endpoint behind tokenUpdateUrl
```

**Two placeholders in the codelab's own reference code become real:**
the recurring payload's `tokenUpdateUrl` and `managementUrl` are dead
strings in v1. In v2 they point to real Express routes — the codelab's own
example code (`https://api.acmestore.com/token/update`) implies this
infrastructure should exist; the codelab just never walks you through
building it. Doing so completes the picture rather than inventing new scope.

**What "real business logic" concretely means here**, vs. v1's simulation:
- Cart total computed server-side, not trusted from the client
- Orders persisted (id, items, total, status) — not discarded after a modal closes
- Subscription state has somewhere real to live (`/account/subscriptions`)
- Settlement is still TEST-mode / no real money — but a real function call,
  clearly logged as TEST, not just a displayed JSON blob

---

## 5. Dev-time vs. runtime architecture (v2)

Matches the existing project's diagram convention in `architecture.md`, extended:

**Runtime (what a shopper's browser does):**
```
Browser → Catalog/Cart/Product pages (vanilla JS, fetch → Express API)
        → Checkout page → Google Pay JS SDK (pay.google.com) → Google's
          payment sheet → loadPaymentData() response
        → POST /checkout/confirm → Express → SQLite (order persisted,
          TEST settlement simulated)
```

**Dev-time (how the code gets written):**
```
Developer prompts Antigravity → Google Pay MCP server (search_documentation,
  list_google_pay_integrations) → grounded code generation → developer
  verifies against real docs before accepting (same discipline as v1's
  mcp-log.md catches)
```

Both diagrams get documented the same way v1's are — this doesn't change
structurally, it just now has a real backend node in the runtime diagram
where v1 had none.

---

## 6. The SKILL.md / long-horizon monitoring section — re-examined

Checked Section 7 of the codelab directly. Two things worth being precise
about, since this changes what's honestly achievable:

**Where the SKILL.md actually lives:** `~/.agents/skills/gpay-monitor-fix/SKILL.md`
— a path in the *developer's own machine's home directory*, read by
Antigravity globally. It is **not part of the project repo** — same category
as the `mcp_config.json` OAuth setup, not application code. This matters:
it should be documented in `SETUP_WALKTHROUGH.md` (screenshots of creating
it, running `/schedule`) but never committed into `src/` or treated as a
repo deliverable.

**What can honestly be demonstrated vs. what can't:**
- ✅ **Can do, and should document with screenshots:** creating the
  `SKILL.md` file itself, running `/schedule` or `/goal` in an Antigravity
  session, showing Antigravity's confirmation UI that the scheduled task
  was registered. This demonstrates real understanding of the mechanism.
- ❌ **Cannot honestly demonstrate:** the actual nightly loop producing a
  real diagnosis and PR — because `query_merchant_error_metrics` needs a
  **verified PRODUCTION merchant ID with live traffic** from the Google Pay
  Business Console, which this project doesn't have and structurally
  shouldn't fabricate (fake error data would defeat the entire point, as
  already reasoned through earlier in this project).

**Plan:** implement the setup steps only, with real screenshots, and add an
explicit note (same honest-exclusion pattern already used for
`assuranceDetails`) stating clearly: *"the skill and schedule were created
and verified to register correctly in Antigravity; the autonomous
diagnostic loop itself was not exercised end-to-end, since it requires live
production merchant traffic this project does not have."* This is more
honest — and more impressive to a careful reader — than either skipping it
entirely or faking a result.

---

## 7. Build order (phased, same verification discipline as v1)

1. **Branch + backend skeleton** — Express server, SQLite schema, product
   seed data, cart API. No Google Pay code touched yet.
2. **Catalog + Product Detail + Cart pages** — real data flowing, no payment
   integration yet. Confirms the store itself works before payment code
   touches it.
3. **Re-integrate Google Pay, faithfully, against real data:**
   - Product page: guest checkout (Section 8), single-item Buy Now
   - Checkout page: full scaffold (Section 4) + dynamic pricing (Section 5)
     + MIT recurring (Section 6), now operating on a real cart subtotal and
     real subscription product instead of hardcoded values
   - Re-verify every one of the 8 scaffolding requirements against the new
     code, the same line-by-line pass already done for v1
4. **`/checkout/confirm` backend route** — order persistence, TEST-mode
   settlement simulation, real `tokenUpdateUrl`/`managementUrl` routes
5. **SKILL.md + `/schedule` setup** (Section 7) — setup only, documented
   with screenshots, explicitly marked as not end-to-end exercised
6. **Documentation pass** — `EVOLUTION.md`, `SETUP_WALKTHROUGH.md`
   (screenshots: GCP project creation, API enablement, OAuth client, MCP
   config panel, Google Pay Business Console), `BUILD_STORY.md` continued
   from Phase 8 onward, `architecture.md` updated with the new runtime
   diagram

Each phase gets prompted to Antigravity individually, output reviewed and
verified against source docs before moving to the next phase — not one giant
prompt for everything at once.

---

## 8. What does NOT belong in this plan

Explicitly out of scope, to avoid scope creep re-entering:
- The reusable "drop-in plugin for other sites" idea — a genuinely separate
  packaging/distribution project, revisit only after v2 is stable
- Real payment gateway integration beyond TEST/Sabre sandbox — no real money,
  ever, in this project
- Framework rewrite (React/Vue) — the codelab's vanilla JS constraint stays
  literal for the payment-integration layer specifically

---

## 9. Definition of done for "implements the codelab in the real sense"

Not just this plan existing — verified, line by line, once built:
- [ ] `isReadyToPay()` gates button render
- [ ] `checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE'` on checkout page
- [ ] `allowedAuthMethods` has both `PAN_ONLY` and `CRYPTOGRAM_3DS`
- [ ] `allowedCardNetworks` includes VISA, MASTERCARD, AMEX
- [ ] Surcharge logic (0.1% DEBIT/PREPAID, 0.5% CREDIT) operates on real cart total
- [ ] Review screen shows final price before authorization
- [ ] `recurringTransactionInfo` correctly built from a real subscription product
- [ ] Guest checkout (`emailRequired`, `shippingAddressRequired`,
      `billingAddressRequired`) lives on the product page, not the cart checkout
- [ ] `assuranceDetails`/3DS step-up remains a documented, reasoned exclusion
      (unchanged from v1's reasoning — still no parallel non-Google-Pay flow)
- [ ] SKILL.md + `/schedule` setup documented with screenshots, honestly
      scoped as setup-only

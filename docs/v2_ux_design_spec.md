# V2 UI/UX & Visual Design Specification

Companion to `v2_master_plan.md`. This replaces the current dark
glass-panel theme entirely — that theme reads as an "AI demo dashboard,"
not a checkout experience someone would trust with a real card. Everything
here is built from how real, trusted checkout flows (Stripe Checkout,
Shopify, Apple Store) actually behave, not from how a tech-demo looks.

---

## 1. Design philosophy

A checkout page's only real job is to make the shopper feel **certain** —
certain what they're buying, certain what it costs, certain nothing sketchy
is happening. Every professional checkout pattern optimizes for that one
feeling over visual flair:

- **High whitespace, low noise.** No gradients, no glow effects, no glass
  panels. Trust reads as *quiet*, not decorated.
- **One accent color, used sparingly.** Reserved for primary actions and
  price emphasis only — not badges, not borders, not backgrounds.
- **Predictable hierarchy.** Price is always the same size and weight
  everywhere it appears. Product names are always the same weight. Nothing
  competes with the two things a shopper actually needs: *what* and *how much*.
- **Explicit state, always.** Every action (added to cart, processing,
  confirmed, failed) gets an unambiguous visual and textual response —
  never a silent state change.

---

## 2. Visual design system

**Palette — light, neutral, one accent:**
```css
--bg-page: #fafafa;          /* page background, near-white, not stark */
--bg-surface: #ffffff;       /* cards, panels */
--border-subtle: #e5e7eb;    /* hairline borders, not shadows-as-borders */
--text-primary: #111827;     /* near-black, not pure black */
--text-secondary: #6b7280;   /* muted, for metadata/labels */
--accent: #2563eb;           /* single blue accent — links, primary CTA, price emphasis */
--accent-hover: #1d4ed8;
--success: #059669;          /* confirmation states only */
--warning: #d97706;          /* surcharge/estimate disclosures only */
--error: #dc2626;
--radius: 8px;                /* consistent, modest — not the 16px glass-panel rounding */
```

Shadows: one subtle elevation only (`0 1px 2px rgba(0,0,0,0.05)`), used for
cards resting on the page background — never a glow, never colored.

**Typography:** system font stack (`-apple-system, "Segoe UI", Inter,
sans-serif`) — no display fonts, no letter-spacing tricks. Hierarchy is
carried entirely by size and weight:
- Page title: 24px / 600
- Section header: 16px / 600
- Body: 14px / 400
- Price (in context): 16px / 600, always `--text-primary`, never accent
  color except on the final checkout total
- Metadata/labels: 13px / 400, `--text-secondary`

**Buttons:**
- Primary (Add to Cart, Continue, Confirm): solid `--accent`, white text,
  `--radius`, no gradient
- Google Pay button: per the codelab's own contrast requirement, this now
  needs re-evaluating against a **light** background — `buttonColor: 'black'`
  still works correctly here (black button on white/light card has strong
  contrast); this is actually a place where switching to a light theme makes
  the button *more* legible, not less
- Secondary (Remove, Cancel): text-only or outline, no fill

---

## 3. Page-by-page UX

### Catalog (`/`)
- Simple top nav: logo/wordmark, category tabs (Devices / Accessories /
  Plans), cart icon with item-count badge
- Grid of product cards: image, name, price, one-line description — no
  decorative elements on the card itself
- Category tabs filter in place, no page reload

### Product Detail (`/product/:id`)
- Image left, details right (standard split layout)
- Price shown large and clear, directly under the name
- For physical products: quantity selector, two actions side by side —
  **"Add to Cart"** (secondary) and **"Buy with G Pay"** (primary,
  Google's button) — this is where Section 8's guest checkout lives,
  exactly per the codelab
- For subscription products: no quantity selector, plan terms shown
  plainly ("Billed monthly, cancel anytime"), single Buy button
- Estimated total shown near the price for card-present context: *"Est.
  $84.99–$85.42 · final price depends on card type"* — small, muted text,
  not alarming, just honest

### Cart (`/cart`)
- Simple list, one row per item: thumbnail, name, quantity stepper, price,
  remove (small text link, not an icon-only trash button — reduces
  accidental removal)
- Running subtotal, sticky at the bottom or right rail
- Single clear CTA: **"Proceed to Checkout"**
- Empty state: plain message + link back to catalog — never a blank page

### Checkout (`/checkout`)
- Single column, top to bottom, no side-by-side competing sections
  (this is deliberate — checkout pages should read like a form, not a dashboard)
- Order summary (collapsed by default if cart has 3+ items, expandable)
- Google Pay button, prominent, alone in its own section — Section 4's
  full scaffold lives here
- On click → Google's sheet → returns → **review screen appears in place**
  (not a modal overlay — a full section replacing the button area), showing:
  - Itemized list
  - Base subtotal
  - Surcharge line, explicitly labeled: *"Card processing fee (0.5% — Credit): $0.43"*
  - Final total, in accent color, only place accent touches a number
  - "Confirm Purchase" as the final explicit action — nothing auto-submits

### Order Confirmation / Receipt (`/order/:id`)
This page doesn't exist at all in v1 and is one of the biggest legitimacy
gaps — real stores never end a purchase in a modal that just closes.
- Large checkmark + **"Order Confirmed"**, order number shown prominently
  (e.g. `#ORD-20260724-0417`)
- Full itemized receipt: product, quantity, unit price, surcharge line,
  total — formatted like an actual receipt, not a debug JSON dump
- Shipping address (if physical items present)
- For subscriptions: next billing date, link to **"Manage Subscription"**
  (real route, per the backend plan's `/account/subscriptions`)
- "A confirmation has been sent to [email]" — simulated, clearly not a real
  email send, but the *page* itself is the real, persistent confirmation
  (this is genuinely more honest than v1's approach, since the record
  actually exists in the database afterward, not just displayed and discarded)

---

## 4. Messaging & micro-interaction states

Every action gets an explicit, human-readable response — never a silent
DOM change:

| Action | Feedback |
|---|---|
| Add to cart | Small toast, bottom-right: *"Added to cart"* + item thumbnail, auto-dismiss ~3s |
| Update quantity | Inline, no toast — total updates visibly in place |
| Remove item | Toast: *"Removed [item name]"* with an **Undo** link (real UX pattern, reduces anxiety around accidental deletion) |
| Google Pay processing | Button shows a spinner state, label changes to *"Processing…"*, disabled to prevent double-clicks |
| Payment succeeded | Redirect to `/order/:id` — never a modal that can be accidentally dismissed |
| Payment failed/cancelled | Inline message on checkout page: *"Payment wasn't completed. No charge was made — you can try again."* — explicitly reassuring, since "wasn't completed" reads very differently from a scary red error |
| Missing response field (simulated fallback) | Small, muted inline note next to the specific field only — e.g. next to the address: *"(estimated — not provided by test card)"* — softer language than v1's `(simulated)` tag, same honesty, less alarming to a first-time viewer |

---

## 5. Trust signals (small, real, not decorative)

Professional checkout pages include a few small, specific trust markers —
never generic "100% Secure!" banners, which read as *less* trustworthy:
- A small lock icon + *"Payments processed by Google Pay"* near the button
- Footer line: *"Test environment — no real charges will be made"* — since
  this is genuinely TEST mode, saying so plainly is more professional than
  hiding it, not less
- Order confirmation includes the actual order ID format a real system
  would generate, not a placeholder-looking string

---

## 6. What this changes about the codelab-scoped code

Nothing structural — the Google Pay integration logic is unaffected. Two
concrete adjustments only:
- `buttonColor` stays `'black'` (still correct contrast on the new light
  background — re-verify visually once built, per the codelab's own
  Section 4 contrast requirement)
- The review screen moves from a modal (v1) to an inline page section (v2)
  — a UX change, not a data/API change; `buildPaymentDataRequest()` and
  all surcharge/recurring logic stay identical, only where the result gets
  *rendered* changes

---

## 7. Definition of done for this spec

- [ ] No dark glass-panel theme anywhere — light, neutral, one accent
- [ ] Order confirmation is a real, persistent page — never only a modal
- [ ] Every user action has explicit, human-readable feedback
- [ ] Google Pay button contrast re-verified against the new background
- [ ] Surcharge and simulated-field language stays honest but not alarming
- [ ] Receipt page reads like an actual receipt, not a debug payload dump

# Build Story

A real, unedited account of how this was built — including everything that went wrong. Nothing here is smoothed over; if you're evaluating this project, this document is the honest version, not a highlight reel.

---

## Phase 0 — Setup

Reused an existing Google Cloud project, OAuth client, and Antigravity MCP connection from a prior attempt at this codelab, then started a clean repository specifically scoped to just following the codelab well — no extra scaffolding tooling, just Antigravity + the Google Pay MCP server.

### The MCP auth failure

First real prompt to Antigravity — scaffold the core checkout button — immediately hit:
```
Encountered error in step execution: calling "tools/call": sending "tools/call": Unauthorized
```

Diagnosis process:
1. Checked Antigravity's internal permission registry — `mcp(google-pay-wallet-dev/*): allowed`. Not an IDE-level block.
2. Traced it to the MCP server's own OAuth session never being established.
3. Attempted to authenticate via Antigravity's "Authenticate" button → landed on `accounts.google.com/signin/oauth/error` with:
   > *"Access blocked: antigravity.google has not completed the Google verification process... Error 403: access_denied"*

Root cause: the OAuth client used for the `google-pay-wallet-dev` MCP server connection had never been **published to production** in Google Cloud Console — it was sitting in "Testing" mode, which restricts sign-in to explicitly allowlisted test users.

**Fix:** Google Cloud Console → Google Auth Platform → Audience → **Publish app** → Confirm. Re-authenticated successfully afterward.

This is worth calling out because it's an easy trap: the error message you get downstream ("Unauthorized" from the MCP tool call) gives no hint that the actual cause is an OAuth consent screen configuration two layers removed from where the error surfaces.

---

## Phase 1 — Core checkout button

**Prompt given to Antigravity:**
> Read `docs/PROJECT_BRIEF.md` first — it explains what this project is, the codelab it's based on, the scope, and how I want you to work (MCP-grounded, telling me what you looked up before each implementation). Confirm you've read it, then implement the core checkout button following the codelab's scaffolding requirements: `isReadyToPay()` gating, button placement/styling, allowed card networks (VISA, MASTERCARD, AMEX, DISCOVER) and auth methods (PAN_ONLY, CRYPTOGRAM_3DS), TEST environment.

**What happened:** the first attempt tried `search_documentation` and it *also* returned `Unauthorized` — because this was run before the OAuth fix above landed. Antigravity fell back to a plain web search of `developers.google.com` instead, and was transparent about doing so.

**A subtle grounding quirk, caught on review:** once MCP access was fixed and re-queried, the returned example snippet showed `allowedAuthMethods: ['PANONLY', 'CRYPTOGRAM3DS']` — **without underscores**. The real, required values are `PAN_ONLY` and `CRYPTOGRAM_3DS`. The code that had already been written used the correct underscored values (verified independently against the official spec), but this was a genuine discrepancy between what MCP returned and what the real API needs — logged explicitly in `mcp-log.md` rather than ignored.

**Also fixed in this phase:** an SDK load race condition — `main.js` was calling `checkIsReadyToPay()` before `https://pay.google.com/gp/p/js/pay.js` had finished loading, throwing `"Google Pay JavaScript SDK is not loaded."` Fixed with a `waitForGooglePaySdk()` poller in `googlePayClient.js` that waits (up to a timeout) for `window.google.payments.api` to exist before proceeding.

**Result:** verified end-to-end in browser — real Google Pay TEST sheet, real test card, button rendering correctly.

---

## Phase 2 — Dynamic pricing

**Prompt given (from the codelab directly):**
> Enhance the Google Pay integrations according to business specification:
> - Use "sabre" as the gateway for the TEST environment.
> - Calculate a 0.1% extra fee for DEBIT and PREPAID cards, and a 0.5% extra fee for CREDIT cards.
> - After the surcharge is calculated, update the checkout confirmation screen so the user reviews the final price before acquirer authorization.
> Use `search_documentation` to look up the technical specification for consuming `cardFundingSource` signal of Google Pay API.

**First draft problem:** the surcharge calculation landed inside `main.js` instead of its own module, and there was a silent fallback — if `cardFundingSource` was missing from the payload, it defaulted to `'CREDIT'` with no indication anywhere that it was a guess.

**Follow-up fix requested:**
> Extract `calculateSurcharge()` and the `cardFundingSource` parsing logic out of `main.js` into a new `src/pricing.js` module... add a visible console warning plus a "(simulated)" label in the review modal whenever that fallback fires.

**Result after fix:** `pricing.js` module created, `isSimulated` flag added, `(simulated)` label wired into the UI. This established the fallback-transparency pattern that later got reused for guest checkout.

**Verified end-to-end:** real Google Pay sheet, `cardFundingSource: "CREDIT"` returned from a real test card, surcharge math confirmed (`$29.99 × 0.5% = $0.15` → `$30.14` total).

---

## Phase 3 — Recurring payments (MIT)

**Prompt given (from the codelab directly):**
> Enhance the Google Pay integrations to support new recurring business requirement:
> - Update Google Pay integrations to support a monthly recurring subscription of $14.99.
> - Use `search_documentation` to look up the technical specification for `RecurringTransactionInfo` and MIT in Google Pay API.

**The most significant bug of the whole project:** the first implementation plan proposed a `recurringTransactionInfo` structure nested inside `totalPriceStatus`/`totalPrice` fields, using field names like `recurringPaymentInterval` and `billingFrequency`. **None of these field names exist in the real Google Pay API.**

Checked whether this was actually MCP-grounded — it wasn't. When explicitly asked to re-query MCP for the specific field names, Antigravity ran six `search_documentation` calls and got back **empty results (`{}`)** for the precise terms needed. The schema had been invented to fill the gap, not retrieved.

**Fix:** rebuilt the plan against the codelab's own confirmed-correct reference structure — a flat object (not nested) with `currencyCode`, `countryCode`, `transactionId`, `tokenUpdateUrl`, `managementUrl`, `billingAgreement`, `immediateTotalPrice`, and a `recurrenceItems` array with `label`, `price`, `priceStatus`, `recurrencePeriod: 'MONTH'`, `recurrencePeriodCount`. Logged in `mcp-log.md` explicitly as **not MCP-grounded** — sourced from a verified reference instead, and stated as such rather than claimed otherwise.

**A second real structural catch, this time by Antigravity itself:** it correctly identified that `recurringTransactionInfo` and `transactionInfo` are **mutually exclusive** at the top level of a `PaymentDataRequest` — passing both is exactly what produces the codelab's documented error:
```
Payment failed to initialize: Exactly one of transactionInfo, automaticReloadTransactionInfo,
deferredTransactionInfo, or recurringTransactionInfo must be set!
```
`googlePayClient.js`'s `buildPaymentDataRequest()` was built to branch on this correctly, and — importantly — to still support the *original* one-time $29.99 flow alongside the new recurring one, via a plan toggle, rather than replacing it.

**Verified end-to-end:** Google's own real payment sheet displayed *"AI Agent Developer Monthly Subscription — US$14.99/month"* with a recurring-payment icon — direct confirmation the structure was accepted by Google's servers, not just internally consistent. Math confirmed (`$14.99 × 0.5% = $0.07` → `$15.06/mo`).

---

## Phase 4 — Express guest checkout

**Prompt given (from the codelab directly, adapted with modularity instruction):**
> Implement Google Pay for express guest checkout directly on the product details page. Ensure users select product attributes before clicking Google Pay (or checkout button). Collect: email, shipping address (with phone), billing address inside card parameters. Use `search_documentation` for API specs. Put this logic in a new `src/guestCheckout.js` module.

**MCP result:** the single `search_documentation` call returned high-level developer guides but not the raw field definitions needed. Logged honestly rather than claimed as grounded — the actual field names (`emailRequired`, `shippingAddressRequired`, `billingAddressParameters.format`) were sourced from the verified reference spec.

**A real bug that shipped initially and was caught on later code review (not during the original build):** `parseGuestContactData()` silently fell back to fabricated placeholder data — `'guest.developer@example.com'`, `'John Doe (Guest)'`, `'123 Innovation Way'` — with zero indication anywhere that it was fake, if a field was missing from the payload. This is the exact anti-pattern already fixed once in `pricing.js`, except it had reappeared here without the same treatment.

**Fix, mirroring the earlier pattern exactly:**
- Per-field `isEmailSimulated` / `isShippingSimulated` / `isBillingSimulated` flags (not one blanket flag — a real email with a fake address needed to be distinguishable)
- Visible `console.warn` per missing field
- `(simulated)` label rendered per field in both the review modal and the final result payload

**Verified end-to-end, twice** — once where Google's TEST sheet returned its own real stock address (`1600 Amphitheatre Parkway, Mountain View, CA`) with `isSimulated: false` correctly reported, confirming the flag works in both directions, not just the fallback direction.

---

## Phase 5 — Code review pass

A deliberate, separate pass through every file, independent of feature-building, to catch anything that slipped through. Found:

- **A duplicate-looking key in a test screenshot** that turned out, after checking full git history of every commit, to have never actually existed in the source — JavaScript object literals can't produce duplicate keys in `JSON.stringify` output at runtime (the second silently overwrites the first). Concluded this was a stale cached browser module from a test run before a hard reload, not a real bug. Worth recording as a reminder that a suspicious screenshot still needs verifying against source before acting on it.
- **A real regression:** the SDK script tag's `async defer` attributes had been silently dropped during a later `index.html` edit (Feature 3 or 4). Not currently breaking anything, thanks to the readiness poller, but a real mismatch between what earlier docs claimed and what shipped. Restored.
- **Dead code:** `getCardPaymentMethod()` in `config.js` was fully superseded by `guestCheckout.js`'s `getGuestCardPaymentMethod()` in the actual request path, but was still exported and unused. Documented in place rather than deleted, in case a non-guest-checkout path is needed later.

---

## Phase 6 — Responsive layout

**Problem found manually, not by code review:** the page required scrolling to see all content even on a normal laptop screen, and `style.css` had **zero media queries**.

**Root cause:** `body` used `align-items: center` with `min-height: 100vh` — when content is taller than the viewport, centered content gets pushed above the visible area rather than starting from the top.

**Fix:**
- Switched to a top-aligned layout (`align-items: flex-start`) so nothing renders above the fold
- Reduced vertical spacing throughout so the full flow fits a typical 1366×768 laptop screen without scrolling
- Added three real breakpoints: mobile (≤480px), tablet (481–1024px), desktop (>1024px)
- Added `max-height: 90vh` + `overflow-y: auto` to modal cards so long content (the review breakdown, the JSON result payload) scrolls within the modal instead of overflowing the screen on small devices

**Verified:** desktop layout confirmed fitting without scroll, both checkout flows re-tested successfully after the CSS change to confirm nothing broke.

---

## What this process actually demonstrated

Not "MCP makes AI coding reliable" — that's not what happened. What actually happened: MCP grounding worked correctly most of the time, failed silently or returned nothing useful a few real times, and in every one of those cases, **the thing that caught it was a human specifically checking**, not the tool itself. The repeatable pattern that mattered wasn't "trust MCP" — it was "prompt, ground, generate, then verify before accepting," applied consistently, including to the AI's own claims about what it had grounded.

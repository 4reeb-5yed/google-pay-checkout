# Architecture

Two architectures matter here, and they're not the same thing — conflating them is a common mistake in projects like this. **Runtime** is what a shopper's browser actually does. **Dev-time** is how the code got written in the first place.

---

## 1. Runtime architecture — what ships to the browser

Pure client-side. No backend, no database, by deliberate design — Google Pay hands back an already-tokenized payment credential, so there's genuinely nothing for a server to do at this stage.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Shopper's Browser                        │
│                                                                   │
│   index.html  →  style.css                                      │
│   src/main.js  (orchestrator)                                   │
│        │                                                          │
│        ├── src/config.js          (TEST env, sabre gateway,     │
│        │                            card networks/auth methods)  │
│        ├── src/googlePayClient.js (isReadyToPay, loadPaymentData│
│        │                            SDK readiness poller)        │
│        ├── src/pricing.js         (cardFundingSource surcharge) │
│        ├── src/recurring.js       (MIT / recurringTransactionInfo)│
│        └── src/guestCheckout.js   (email/shipping/billing)      │
│                                                                   │
└──────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                   ┌─────────────────────────────┐
                   │  Google Pay Web API (JS SDK) │
                   │  pay.google.com/gp/p/js/pay.js│
                   │                               │
                   │   isReadyToPay()              │
                   │   createButton()               │
                   │   loadPaymentData()            │
                   └───────────────┬───────────────┘
                                    │
                                    ▼
                   ┌─────────────────────────────┐
                   │   Google Pay Payment Sheet    │
                   │   (TEST environment)          │
                   │                                │
                   │  Returns tokenized payment     │
                   │  credential + optional         │
                   │  cardFundingSource, shipping,  │
                   │  billing, email signals        │
                   └───────────────────────────────┘
```

**Why no backend:** the codelab's own reference design is client-only for this stage of the flow — Google Pay's `loadPaymentData()` response is already an opaque, gateway-tokenized credential (`[OPAQUE_SABRE_TOKEN_RECEIVED]` in this project's sanitized output). A real production merchant would forward that token to their payment processor server-side to actually settle the charge — but building that settlement backend is out of scope here; the checkout *integration* is the thing being demonstrated, not a full payments backend.

**Security property this gives for free:** no card data — raw or tokenized — ever touches this project's own code beyond receiving and immediately displaying/discarding it. `main.js` explicitly redacts the token before showing the final payload to the user (`token: '[OPAQUE_SABRE_TOKEN_RECEIVED]'`), even though it already came pre-tokenized from Google.

---

## 2. Dev-time architecture — how the code got written

This is the part the codelab is actually about. Every feature in this repo was built by prompting Antigravity, which is connected to a live MCP server rather than relying purely on the model's training data.

```
┌──────────────┐        prompts         ┌─────────────────────┐
│   Developer   │ ─────────────────────▶ │     Antigravity      │
│  (Areeb Syed) │ ◀───────────────────── │  (AI-native IDE)     │
└──────────────┘      generated code     └──────────┬───────────┘
                                                       │
                                          OAuth 2.0    │  search_documentation(query)
                                          (published   │  list_google_pay_integrations(...)
                                           production   │
                                           client)      ▼
                                          ┌─────────────────────────────┐
                                          │  Google Pay & Wallet          │
                                          │  Developer MCP Server         │
                                          │  paydeveloper.googleapis.com  │
                                          └──────────────┬────────────────┘
                                                           │
                                                           ▼
                                          ┌─────────────────────────────┐
                                          │  Live Google Pay API docs     │
                                          │  (RAG-indexed, current spec)  │
                                          └───────────────────────────────┘
```

Each feature followed the same loop:

1. **Prompt** — a natural-language description of the feature and business requirements (e.g. "0.1% extra fee for DEBIT and PREPAID cards, 0.5% for CREDIT")
2. **MCP lookup** — Antigravity calls `search_documentation` with a targeted query before writing any code
3. **Grounded generation** — code is written against whatever the MCP server actually returned
4. **Human review** — every generated diff was checked before being accepted, and in two real cases (documented in [`BUILD_STORY.md`](BUILD_STORY.md)), this step caught genuine problems that grounding alone didn't prevent

The full, unedited record of every MCP query, what it returned, and what happened when it returned nothing useful, is in [`mcp-log.md`](mcp-log.md).

### Why this diagram has to stay separate from the runtime one

The dev-time architecture involves Google Cloud IAM, an OAuth client, and a documentation-retrieval server — none of which the shopper's browser ever touches or knows about. The runtime architecture involves the Google Pay JS SDK and payment sheet — neither of which Antigravity or MCP is involved with at all once the code is written. They're two different systems operating at two different times, connected only by the fact that one produced the source code the other executes.

---

## 3. Data flow — a single checkout, end to end

```
1. Page loads → main.js calls checkIsReadyToPay()
2. SDK readiness poller waits for window.google.payments.api to exist
3. isReadyToPay() returns true → Google Pay button renders
4. Shopper selects Size + Color (validated before checkout proceeds)
5. Shopper selects plan: One-Time ($29.99) or Monthly Subscription ($14.99/mo)
6. Shopper clicks "Buy with G Pay"
7. buildPaymentDataRequest() assembles the request:
   - guest checkout params (email/shipping/billing) always included
   - EITHER transactionInfo (one-time) OR recurringTransactionInfo (subscription)
     — these are mutually exclusive at the top level of the request
8. loadPaymentData() opens Google's real payment sheet (TEST environment)
9. Shopper picks a test card, confirms
10. Response returned to the browser, containing:
    - tokenized payment credential
    - cardFundingSource (if the network reports it)
    - shipping/billing/email (if requested and available)
11. pricing.js parses cardFundingSource, computes surcharge
    (flags isSimulated: true if the signal was missing and a fallback fired)
12. guestCheckout.js parses contact/address data
    (flags isEmailSimulated / isShippingSimulated / isBillingSimulated per field)
13. Review modal shows itemized breakdown — every simulated field visibly labeled
14. Shopper clicks "Confirm & Authorize with Acquirer"
15. Result modal shows the final sanitized payload (raw token redacted)
```

---

## 4. Module responsibility map

| Module | Owns | Does not own |
|---|---|---|
| `config.js` | Static Google Pay configuration (env, networks, gateway) | Any request-building logic |
| `googlePayClient.js` | SDK lifecycle, readiness, `loadPaymentData()` invocation | Business logic (pricing, recurring, guest data) |
| `pricing.js` | Surcharge calculation, funding-source parsing + simulation flagging | DOM, UI rendering |
| `recurring.js` | `recurringTransactionInfo` construction, MIT mandate metadata | DOM, UI rendering, pricing |
| `guestCheckout.js` | Product attribute validation, guest contact parsing + simulation flagging | Pricing, recurring logic |
| `main.js` | DOM wiring, event listeners, orchestration, modal state | Any Google Pay API calls directly — always goes through `googlePayClient.js` |

This separation is what makes it possible to, for example, fix the guest-checkout fallback-transparency bug without touching pricing logic at all, or add a new card network without touching the UI layer.

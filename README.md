# Google Pay API Checkout — Built with Antigravity + MCP

A working Google Pay checkout — one-time purchase, subscription billing, dynamic surcharge pricing, and express guest checkout — built almost entirely by *prompting* an AI coding agent connected to a live documentation server, instead of hand-writing the integration from memory or copy-pasted tutorials.

**Live reference:** Google's official codelab this project follows:
[*Google Pay API: Vibe-code checkout page with MCP servers and Antigravity*](https://codelabs.developers.google.com/codelabs/gpay-api-vibe-code-mcp-servers)

---

## Why this exists

Setting aside the fact that this started as an internship exercise — the actual reason to build this is what the codelab is demonstrating: **a different way of writing code against an API.**

Normally, an AI coding assistant answers API questions from its training data — which is frozen at some point in the past and can be subtly wrong, outdated, or just invented when the model is unsure. For something like a payments API, where field names, required parameters, and response shapes matter exactly, that's a real risk: code that *looks* right but silently fails or does the wrong thing.

The codelab's answer to this is the **Model Context Protocol (MCP)** — an open standard that lets an AI tool call out to a live server and pull the *current*, authoritative documentation before it writes a single line of code. Instead of the model guessing what `RecurringTransactionInfo` looks like, it asks Google's own Pay & Wallet Developer MCP server, gets back the real spec, and writes code against that.

This project is a real, hands-on test of that idea: build a non-trivial payments integration — four distinct features, each with genuine edge cases — using **Antigravity** (Google's AI-native IDE) wired up to that MCP server, and see what actually happens. Including the parts that didn't go smoothly, which turned out to be the most instructive part.

---

## What's actually built

| Feature | What it does | Status |
|---|---|---|
| Core checkout button | `isReadyToPay()` gating, official Google Pay button, TEST-mode `loadPaymentData()` | ✅ Working, tested |
| Dynamic pricing | Surcharge/discount computed from the card's `cardFundingSource` signal (0.5% credit, 0.1% debit/prepaid), shown on a pre-authorization review screen | ✅ Working, tested |
| Recurring payments (MIT) | `$14.99/mo` subscription via `recurringTransactionInfo`, selectable alongside a one-time `$29.99` purchase | ✅ Working, tested |
| Express guest checkout | Email, shipping address + phone, and billing address collected directly through the Pay API — no account creation | ✅ Working, tested |
| Responsive layout | Mobile / tablet / desktop breakpoints, no vertical overflow | ✅ Fixed and verified on desktop |

**Deliberately not built** (see [Concepts](#concepts-demonstrated) below for why):
- A backend server or database — this is intentionally 100% client-side; Google Pay hands back an already-tokenized credential, so there's nothing for a backend to do at this stage of the flow
- The codelab's optional long-horizon monitoring agent (Section 7) — it needs live production merchant traffic to mean anything, which a training project doesn't have

---

## Concepts demonstrated

### 1. Model Context Protocol (MCP)
An open standard letting an AI tool call structured tools on a remote server instead of relying only on what it learned during training. Here, Antigravity calls `google-pay-wallet-dev/search_documentation` on Google's Pay & Wallet Developer MCP server to pull live API specs mid-conversation.

### 2. Spec-driven development
Instead of "vibe coding" purely off a natural-language prompt, every feature followed the same loop: *prompt → MCP lookup → grounded code generation → human review*. The prompts used for each feature are documented in [`docs/BUILD_STORY.md`](docs/BUILD_STORY.md).

### 3. Grounding isn't automatic — it has to be checked
The most important thing this project actually demonstrated: MCP doesn't guarantee correctness by itself. Three real cases came up where the returned "grounded" information was still wrong or missing (see the bugs section below and the full record in [`docs/mcp-log.md`](docs/mcp-log.md)). The discipline that matters isn't "use MCP," it's "use MCP, and still verify the result."

### 4. Dev-time vs. runtime architecture
Two entirely separate diagrams matter here, and conflating them is a common mistake: *how the code got written* (Antigravity ↔ OAuth ↔ MCP server ↔ live docs) is completely different from *what the shopper's browser actually does at checkout* (Browser ↔ Google Pay JS SDK ↔ Google's payment sheet). See [`docs/architecture.md`](docs/architecture.md) for both.

### 5. Merchant Initiated Transactions (MIT)
The mechanism that lets a merchant charge a saved payment method on a recurring schedule without the shopper re-authenticating every cycle — the basis of subscription billing on Google Pay.

### 6. `cardFundingSource` signal
Google Pay optionally reports whether a card is credit, debit, or prepaid. Real-world merchants use this to apply different interchange-based fees. This project treats a *missing* signal as a first-class case, not an afterthought — see the fallback-transparency fix below.

---

## The real build story (bugs included)

Full blow-by-blow is in [`docs/BUILD_STORY.md`](docs/BUILD_STORY.md). Short version:

- **MCP auth failure on day one.** The `google-pay-wallet-dev` MCP server returned `Unauthorized` — not an Antigravity permissions issue, but an unpublished OAuth consent screen in Google Cloud Console (stuck in "Testing" mode). Fixed by publishing the OAuth client to production.
- **A fabricated schema.** When asked to build the recurring-payments feature, the first draft used field names (`recurringPaymentInterval`, `billingFrequency`) that don't exist in the real API — MCP had returned nothing for that specific query, and the agent filled the gap with a plausible-looking but wrong guess. Caught in review before it became working code, then rebuilt against the codelab's own verified reference structure.
- **A silent fake-data fallback.** The guest-checkout module quietly substituted placeholder contact/address data (`guest.developer@example.com`, `123 Innovation Way`) whenever a field was missing from the test payload — with no indication anywhere that it was fake. Fixed to log a visible warning and show a `(simulated)` label per field.
- **An SDK load race condition.** The Google Pay button silently failed to render because the app's own code ran before the Google Pay JS SDK had finished loading. Fixed with an explicit readiness poller.
- **No responsive design at all, initially.** The page used `align-items: center` with no media queries, which pushed content above the visible viewport on normal laptop screens. Fixed with a top-aligned layout and three real breakpoints.
- **A misleading MCP documentation snippet.** One MCP response returned example code using `PANONLY`/`CRYPTOGRAM3DS` (no underscores) — subtly different from the real required values `PAN_ONLY`/`CRYPTOGRAM_3DS`. The generated code used the correct values anyway (verified against the real spec), but it's a good example of why blindly trusting a retrieved snippet is still a mistake.
- **A fabricated enum in the first draft.** When implementing `checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE'`, the initial plan asserted `'DEFAULT_FOR_BUY_BUTTON'` as the default enum string. The actual standard default is `'DEFAULT'` (alongside `'CONTINUE_TO_REVIEW'`). Caught during grounding review, corrected in the plan, and explicitly logged in [`docs/mcp-log.md`](docs/mcp-log.md) as sourced from official API docs rather than MCP snippets.

None of these are hidden — they're the actual record of what happened, kept in the docs on purpose.

---

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for full diagrams. Summary:

- **Runtime**: pure client-side. Browser talks directly to Google's Pay API. No backend, no database — deliberately.
- **Dev-time**: Antigravity, authenticated via OAuth 2.0, calls the Google Pay MCP server to look up live specs before generating each feature's code.

---

## Project structure

```
├── docs/
│   ├── PROJECT_BRIEF.md   ← context given to Antigravity before implementation began
│   ├── mcp-log.md         ← real, unedited record of every MCP lookup and outcome
│   ├── architecture.md    ← runtime + dev-time architecture diagrams
│   └── BUILD_STORY.md     ← full step-by-step account, prompts used, bugs found & fixed
├── src/
│   ├── config.js          ← Google Pay config constants (TEST env, sabre gateway, card networks)
│   ├── googlePayClient.js ← isReadyToPay/loadPaymentData wrapper, SDK readiness poller
│   ├── pricing.js         ← cardFundingSource surcharge calculation, fallback transparency
│   ├── recurring.js       ← MIT / recurringTransactionInfo builder
│   ├── guestCheckout.js   ← express guest checkout, fallback transparency
│   └── main.js            ← orchestrator — wires everything together, owns UI state
├── index.html
├── style.css
├── Dockerfile
└── .dockerignore
```

---

## Setup & running it

### Requirements
- A Google Cloud project with the **Google Pay & Wallet Developer API** enabled
- An OAuth 2.0 client (Web application type) **published to production** — see [`docs/BUILD_STORY.md`](docs/BUILD_STORY.md#the-mcp-auth-failure) if you hit an `Unauthorized`/`access_denied` error here, it's a common gotcha
- [Antigravity](https://antigravity.google) configured with the `google-pay-wallet-dev` MCP server, if you want to extend this project the same way it was built

None of the above is needed just to **run** the checkout page — only to develop it further using the same MCP-grounded workflow.

### Clone the repository

```bash
git clone https://github.com/4reeb-5yed/google-pay-antigravity-checkout.git
cd google-pay-antigravity-checkout
```

### Run locally — plain Python

No build step, no dependencies:
```bash
python3 -m http.server 8000
```
Open **http://localhost:8000**.

### Run locally — Docker

```bash
docker build -t google-pay-checkout .
docker run -p 8000:80 google-pay-checkout
```
Open **http://localhost:8000**.

### Run locally — Node (alternative)
```bash
npx serve .
```

---

## Testing

No automated test suite — everything was verified manually against the real Google Pay TEST environment:
- Attribute validation gate (blocks checkout until Size/Color selected)
- One-time purchase flow, full authorization
- Recurring subscription flow, full authorization, confirmed Google's own payment sheet displays subscription terms
- Guest contact data collection, with per-field simulated/real verification via the `isSimulated` flags
- Console checked for errors on every run

---

## References

- [Codelab — Google Pay API: Vibe-code checkout page with MCP servers and Antigravity](https://codelabs.developers.google.com/codelabs/gpay-api-vibe-code-mcp-servers)
- [Google Pay Web API developer guide](https://developers.google.com/pay/api/web/overview)
- [`isReadyToPay()` reference](https://developers.google.com/pay/api/web/reference/client#isReadyToPay)
- [`loadPaymentData()` request/response objects](https://developers.google.com/pay/api/web/reference/response-objects)
- [`cardFundingSource` signal](https://developers.google.com/pay/api/web/reference/response-objects#CardInfo)
- [Merchant Initiated Transactions (MIT)](https://developers.google.com/pay/api/web/guides/resources/merchant-initiated-transactions)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

**Areeb Syed** 

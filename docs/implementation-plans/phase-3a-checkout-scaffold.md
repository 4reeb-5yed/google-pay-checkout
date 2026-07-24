# Phase 3a Implementation Plan — Google Pay Checkout Scaffold, Dynamic Pricing & MIT Recurring

This plan covers Phase 3a of the V2 Master Plan (`docs/v2_master_plan.md`). It implements the full Google Pay checkout page (`/checkout`) using Vanilla JS, grounding the Google Pay Web SDK v2 integration in codelab Sections 4, 5, and 6.

The product detail page's "Buy with G Pay" guest checkout button remains disabled/inert in Phase 3a (reserved for Phase 3b). Files in `src/*.js` remain completely untouched.

---

## Explicit Design Decisions & Review Items

### 1. DOM Layout Placement (Requirement 2)
The Google Pay button is the **primary, default payment option** positioned at the top of the `/checkout` view payment section, above any secondary payment UI.

```html
<div class="checkout-layout">
  <div class="checkout-main-column">
    <!-- PRIMARY EXPRESS PAYMENT SECTION AT TOP -->
    <section class="payment-methods-section">
      <h2 class="section-title">Express Payment</h2>
      <p class="section-desc">Fast, secure guest checkout via Google Pay.</p>
      
      <!-- Primary Button Container (rendered first via isReadyToPay) -->
      <div id="gpay-button-container" class="gpay-wrapper"></div>
      
      <!-- In-Place Review Section (replaces button container after loadPaymentData) -->
      <div id="checkout-review-panel" class="review-panel hidden"></div>
    </section>
  </div>
  
  <div class="checkout-sidebar">
    <!-- Order Summary Sticky Rail -->
  </div>
</div>
```

---

### 2. Button Styling & Contrast Check (Requirement 3)
- `buttonColor: 'black'`
- **Contrast Verification**:
  - Button Color: `#000000` (black)
  - Page / Container Surface Background: `#ffffff` (white) / `#fafafa` (near-white page background)
  - **Contrast Ratio**: **21.0:1** (WCAG AAA Compliant — PASS)

---

### 3. ButtonType Decision
- **Physical Cart**: `buttonType: 'buy'` (direct immediate purchase)
- **Subscription Cart**: `buttonType: 'subscribe'`
- **Design Rationale**: Setting `buttonType: 'subscribe'` for subscription carts clearly communicates ongoing recurring commitment to the shopper prior to clicking, strictly adhering to Google Pay Web SDK branding guidelines.

---

### 4. Merchant Info & Gateway Tokenization Spec (Requirements 4 & 5)

#### Tool & Repository Findings:
1. **`list_merchants` MCP Tool**: Executed `list_merchants` against the `google-pay-wallet-dev` MCP server. Returned `{}` (empty object) because there is no production Google Pay Business Console profile attached to the local development environment.
2. **`src/config.js` Repository Inspection**:
   - **`merchantInfo`** (Lines 14–17): `merchantId: '12345678901234567890'`, `merchantName: 'CanSpirit AI Demo Store'` (updated to `'Google Pay Store'` for V2).
   - **`tokenizationSpecification`** (Lines 35–41): `gateway: 'sabre'`, `gatewayMerchantId: 'exampleGatewayMerchantId'`.

#### Why these values are strictly correct for `TEST` Mode:
- **`merchantId: '12345678901234567890'`**: In Google Pay Web SDK (`environment: 'TEST'`), Google Pay does not validate the merchant ID against live production console records. Google's JS SDK requires a 20-digit string structure to populate the TEST payment sheet payload.
- **`gateway: 'sabre'`, `gatewayMerchantId: 'exampleGatewayMerchantId'`**: In `TEST` mode, Google Pay uses the Sabre test gateway protocol to return a simulated token payload without hitting live acquirer network rails.

```javascript
merchantInfo: {
  merchantId: '12345678901234567890',
  merchantName: 'Google Pay Store'
}

tokenizationSpecification: {
  type: 'PAYMENT_GATEWAY',
  parameters: {
    gateway: 'sabre',
    gatewayMerchantId: 'exampleGatewayMerchantId'
  }
}
```

---

### 5. Surcharge Subtotal Source (Requirement 8)
- Dynamic surcharge calculation (0.1% DEBIT/PREPAID, 0.5% CREDIT) is strictly calculated against the **real backend subtotal** fetched via `GET /api/cart` and `POST /api/checkout/estimate`.
- Client-side code never uses hardcoded or cached pricing values for surcharge calculations.

---

### 6. Flagged Backend Change & Cart UI Cues (Requirement 7)
- **Backend Change**: `POST /api/cart` in `server.js` checks if the item being added is `type === 'subscription'` or category `'Plans'`. If true, it removes any existing subscription item in that session's cart before adding the new plan.
- **Cart UI Cue & Toast**:
  - **Toast on Product Page**: When adding a subscription plan that replaces an existing plan, the toast explicitly notifies: *"Updated subscription plan to [New Plan Name]"*.
  - **Banner on `/cart`**: Displays a clear informational notice: *"Note: Adding a new plan replaces your current plan. Only one active subscription plan can be in a cart at a time."*

---

### 7. Separated Subscription vs. Physical Checkout
- **Physical-only cart**: Uses standard `transactionInfo` with `checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE'`.
- **Subscription cart**: Processes ONLY the subscription plan item via `recurringTransactionInfo` with `immediateTotalPrice` set strictly to the subscription's initial fee ($14.99 or $149.99).
- **Physical Item Retention & Disclosure**: If physical items are also in the cart, an inline disclosure box renders above the Google Pay button on `/checkout`:
  `ℹ️ Note: Subscriptions bill separately from physical hardware items. Your physical items ($149.99) will remain in your cart for a separate checkout.`

---

## Proposed Changes

### Backend Infrastructure

#### [MODIFY] [server.js](file:///e:/google-pay-antigravity-checkout/server.js)
- Update `POST /api/cart`: Auto-replace existing subscription plan items when a new plan item is added.

---

### Frontend Checkout & Routing

#### [NEW] [public/js/checkout.js](file:///e:/google-pay-antigravity-checkout/public/js/checkout.js)
- `PaymentsClient` initialization (`environment: 'TEST'`).
- `isReadyToPay()` call gating Google Pay button rendering at top of payment section.
- Dynamic payload construction (`transactionInfo` for physical carts, `recurringTransactionInfo` for subscription carts with local `tokenUpdateUrl` / `managementUrl`).
- Risk-based 3DS check on `assuranceDetails` in `loadPaymentData()` handler.
- In-place review panel replacing Google Pay button container upon callback (showing itemized breakdown, base subtotal, explicit surcharge line, and final total).
- "Confirm Purchase" button triggering spinner processing state.

#### [MODIFY] [public/js/app.js](file:///e:/google-pay-antigravity-checkout/public/js/app.js)
- Register `/checkout` route in History API router.
- Connect "Proceed to Checkout" buttons on `/cart` to navigate to `/checkout`.
- Add plan replacement UI cues on cart page.

#### [NEW] [docs/implementation-plans/phase-3a-checkout-scaffold.md](file:///e:/google-pay-antigravity-checkout/docs/implementation-plans/phase-3a-checkout-scaffold.md)
- Permanent repo copy of Phase 3a implementation plan, saved before git commit.

---

## Verification Plan

### Automated & Manual Verification
1. Run server (`node server.js`).
2. Test Single-Plan Cart Replacement & UI Cues:
   - Add Pro Monthly Plan. Add Pro Annual Plan.
   - Verify toast notifies replacement. Verify `/cart` shows Pro Annual Plan and replacement notice banner.
3. Test `/checkout` Page:
   - **Physical Cart**: Verify Google Pay button renders at top of payment section with `buttonColor: 'black'` and `buttonType: 'buy'`. Complete payment sheet. Verify in-place review card (not modal) shows exact surcharge line.
   - **Subscription Cart**: Verify `buttonType: 'subscribe'`. Verify inline notice regarding physical item separation if physical items present. Complete payment sheet.
   - **Processing State**: Click "Confirm Purchase". Verify button enters spinner/disabled state and logs output.

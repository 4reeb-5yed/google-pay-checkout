# Google Pay Enhancement: Sabre Gateway, Surcharge Engine & Review Step

Enhance the Google Pay checkout flow to use the `sabre` gateway in TEST mode, detect card funding source from payment payload (`CREDIT` vs `DEBIT`/`PREPAID`), calculate exact card surcharges, and present a pre-authorization review UI to the user before acquirer authorization.

## User Review Required

> [!IMPORTANT]
> **Acquirer Authorization Review Step**: After the Google Pay sheet returns payment payload, the app calculates surcharges dynamically (`0.1%` for `DEBIT`/`PREPAID`, `0.5%` for `CREDIT`) and displays an itemized breakdown on a checkout review modal. Final payment token submission to the acquirer takes place when the user clicks **"Confirm & Authorize with Acquirer"**.

## Open Questions

None. The business specifications and rate requirements are clear:
- Gateway: `sabre`
- Surcharge: `0.1%` for `DEBIT`/`PREPAID`, `0.5%` for `CREDIT`
- UI: Post-sheet review screen before acquirer authorization

---

## Proposed Changes

### Configuration Layer

#### [MODIFY] [config.js](file:///e:/google-pay-antigravity-checkout/src/config.js)
- Update `GPAY_CONFIG.tokenizationSpecification.parameters.gateway` from `'example'` to `'sabre'`.

---

### Google Pay Client & Logic Layer

#### [MODIFY] [googlePayClient.js](file:///e:/google-pay-antigravity-checkout/src/googlePayClient.js)
- Ensure `cardFundingSource` signal handling and helper utilities for surcharge calculations are cleanly exposed.

#### [MODIFY] [main.js](file:///e:/google-pay-antigravity-checkout/src/main.js)
- Implement `calculateSurcharge(basePrice, fundingSource)` logic:
  - `DEBIT` or `PREPAID`: `0.1%` surcharge (`basePrice * 0.001`)
  - `CREDIT`: `0.5%` surcharge (`basePrice * 0.005`)
  - `UNKNOWN` / default: `0.0%`
- Intercept the `loadPaymentData` result in `handlePaymentClick`.
- Parse `paymentData.paymentMethodData.info.cardFundingSource` (fallback to simulated funding source if undefined in test payload).
- Display an itemized post-sheet confirmation modal showing:
  - Base Amount ($29.99)
  - Card Network & Funding Source (`CREDIT`, `DEBIT`, `PREPAID`)
  - Calculated Surcharge Fee (e.g. +$0.15 for Credit, +$0.03 for Debit/Prepaid)
  - Updated Final Total
  - Action Button: **"Confirm & Authorize with Acquirer"**
- Complete authorization and display final success status upon user confirmation.

---

### UI & Styling Layer

#### [MODIFY] [index.html](file:///e:/google-pay-antigravity-checkout/index.html)
- Add the Order Confirmation Review modal structure with itemized breakdown table/list and authorization confirmation buttons.

#### [MODIFY] [style.css](file:///e:/google-pay-antigravity-checkout/style.css)
- Style the authorization review modal, price badge breakdowns, and acquirer authorization status indicators.

---

## Verification Plan

### Manual Verification
1. **Gateway Check**: Inspect payment request object to verify `gateway` parameter is set to `'sabre'`.
2. **Surcharge Calculation & Review Step**:
   - Trigger Google Pay payment flow.
   - Verify the review screen pops up with the extracted `cardFundingSource`.
   - Verify surcharge rates:
     - `DEBIT` / `PREPAID`: 0.1% extra fee calculated correctly.
     - `CREDIT`: 0.5% extra fee calculated correctly.
   - Click "Confirm & Authorize with Acquirer" and verify authorization state updates successfully.

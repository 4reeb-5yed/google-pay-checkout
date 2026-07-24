// Google Pay Store V2 — Checkout Page Module (Phase 3a)
// Codelab Sections 4, 5, 6 faithful implementation grounded in official Google Pay Web API v2

(function () {
  'use strict';

  const GPAY_CONFIG = {
    apiVersion: 2,
    apiVersionMinor: 0,
    environment: 'TEST',
    merchantInfo: {
      merchantId: '12345678901234567890',
      merchantName: 'Google Pay Store'
    },
    allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
    allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX'],
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway: 'sabre',
        gatewayMerchantId: 'exampleGatewayMerchantId'
      }
    }
  };

  let paymentsClient = null;

  function getPaymentsClient() {
    if (!paymentsClient && typeof google !== 'undefined' && google.payments && google.payments.api) {
      paymentsClient = new google.payments.api.PaymentsClient({
        environment: GPAY_CONFIG.environment
      });
    }
    return paymentsClient;
  }

  function getBaseCardPaymentMethod() {
    return {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: GPAY_CONFIG.allowedAuthMethods,
        allowedCardNetworks: GPAY_CONFIG.allowedCardNetworks
      }
    };
  }

  function getCardPaymentMethod() {
    return {
      ...getBaseCardPaymentMethod(),
      tokenizationSpecification: GPAY_CONFIG.tokenizationSpecification
    };
  }

  function getIsReadyToPayRequest() {
    return {
      apiVersion: GPAY_CONFIG.apiVersion,
      apiVersionMinor: GPAY_CONFIG.apiVersionMinor,
      allowedPaymentMethods: [getBaseCardPaymentMethod()]
    };
  }

  function buildPaymentDataRequest(cart, isSubscriptionCheckout, activeSubtotalCents, origin = 'http://localhost:3000') {
    const activeSubtotalPrice = (activeSubtotalCents / 100).toFixed(2);

    let paymentDataRequest = {
      apiVersion: GPAY_CONFIG.apiVersion,
      apiVersionMinor: GPAY_CONFIG.apiVersionMinor,
      allowedPaymentMethods: [getCardPaymentMethod()],
      merchantInfo: GPAY_CONFIG.merchantInfo
    };

    if (isSubscriptionCheckout) {
      const subscriptionItem = cart.items.find(i => i.type === 'subscription');
      paymentDataRequest.recurringTransactionInfo = {
        currencyCode: 'USD',
        countryCode: 'US',
        transactionId: 'sub-test-id',
        tokenUpdateUrl: origin + '/token/update',
        managementUrl: origin + '/account/subscriptions',
        billingAgreement: `Recurring subscription of $${subscriptionItem.unitPriceFormatted} for ${subscriptionItem.name}. Cancel anytime in account settings.`,
        immediateTotalPrice: activeSubtotalPrice,
        recurrenceItems: [
          {
            label: subscriptionItem.name,
            price: (subscriptionItem.unitPriceCents / 100).toFixed(2),
            priceStatus: 'FINAL',
            recurrencePeriod: subscriptionItem.recurrencePeriod || 'MONTH',
            recurrencePeriodCount: subscriptionItem.recurrencePeriodCount || 1
          }
        ]
      };
    } else {
      paymentDataRequest.transactionInfo = {
        totalPriceStatus: 'FINAL',
        totalPrice: activeSubtotalPrice,
        currencyCode: 'USD',
        countryCode: 'US',
        checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE'
      };
    }

    return paymentDataRequest;
  }

  function calculateSurcharge(subtotalCents, cardFundingSource) {
    const isCredit = (cardFundingSource === 'CREDIT');
    const rate = isCredit ? 0.005 : 0.001; // 0.5% Credit, 0.1% Debit/Prepaid
    const rateText = isCredit ? '0.5% — Credit' : '0.1% — Debit/Prepaid';
    const surchargeCents = Math.round(subtotalCents * rate);
    return {
      rateText,
      cardFundingSource: cardFundingSource || 'CREDIT',
      surchargeCents,
      surchargeFormatted: '$' + (surchargeCents / 100).toFixed(2),
      finalTotalCents: subtotalCents + surchargeCents,
      finalTotalFormatted: '$' + ((subtotalCents + surchargeCents) / 100).toFixed(2)
    };
  }

  // Export helpers for unit testing & window
  const helpers = {
    GPAY_CONFIG,
    getIsReadyToPayRequest,
    getCardPaymentMethod,
    buildPaymentDataRequest,
    calculateSurcharge
  };

  if (typeof window !== 'undefined') {
    window.checkoutHelpers = helpers;
    window.renderCheckoutPage = renderCheckoutPage;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = helpers;
  }

  // Render Checkout Page View
  async function renderCheckoutPage(container) {
    container.innerHTML = `
      <div style="padding: 2rem 0; text-align: center; color: var(--text-secondary);">
        Preparing checkout...
      </div>
    `;

    try {
      const cart = await window.appApiFetch('/api/cart');

      if (!cart.items || cart.items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🛒</div>
            <h2 class="empty-title">Your cart is empty</h2>
            <p class="empty-desc">Add items to your cart before proceeding to checkout.</p>
            <a href="/" class="btn-primary">Browse Catalog</a>
          </div>
        `;
        return;
      }

      // Check if cart contains subscription plan
      const subscriptionItem = cart.items.find(i => i.type === 'subscription');
      const physicalItems = cart.items.filter(i => i.type !== 'subscription');
      const isSubscriptionCheckout = !!subscriptionItem;

      // Active transaction subtotal (subscription only if subscription checkout, else full cart subtotal)
      const activeSubtotalCents = isSubscriptionCheckout ? subscriptionItem.lineTotalCents : cart.subtotalCents;
      const activeSubtotalFormatted = '$' + (activeSubtotalCents / 100).toFixed(2);

      const physicalItemsTotalCents = physicalItems.reduce((sum, i) => sum + i.lineTotalCents, 0);
      const physicalItemsTotalFormatted = '$' + (physicalItemsTotalCents / 100).toFixed(2);

      container.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">Checkout</h1>
          <p class="page-subtitle">Review items and complete payment securely.</p>
        </div>

        <div class="cart-layout">
          <div class="cart-items-card" style="display: flex; flex-direction: column; gap: 1.5rem;">
            
            <!-- SECTION 4: EXPRESS PAYMENT SECTION POSITIONED AT TOP -->
            <section class="payment-methods-section">
              <h2 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.25rem;">Express Payment</h2>
              <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
                Authorized fast guest checkout with Google Pay.
              </p>

              ${isSubscriptionCheckout && physicalItems.length > 0 ? `
                <div style="background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 0.85rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500; margin-bottom: 1.25rem; display: flex; align-items: flex-start; gap: 0.5rem;">
                  <span style="font-size: 1.1rem;">ℹ️</span>
                  <div>
                    <strong>Subscription Billing Notice:</strong> Subscriptions bill separately from physical hardware items. Your physical items (${physicalItemsTotalFormatted}) will remain in your cart for a separate checkout.
                  </div>
                </div>
              ` : ''}

              <!-- Google Pay Button Container (Top-most payment UI) -->
              <div id="gpay-button-container" class="gpay-wrapper" style="min-height: 48px;"></div>

              <!-- In-Place Review Panel (replaces button container after loadPaymentData) -->
              <div id="checkout-review-panel" class="review-panel" style="display: none; background-color: #ffffff; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1.5rem;"></div>
            </section>

          </div>

          <!-- Checkout Summary Sidebar -->
          <div class="cart-summary-rail">
            <h3 class="summary-title">Order Summary</h3>

            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle);">
              ${isSubscriptionCheckout ? `
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="font-weight: 500;">${subscriptionItem.name}</span>
                  <span style="font-weight: 600;">${subscriptionItem.lineTotalFormatted}/mo</span>
                </div>
              ` : cart.items.map(item => `
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span>${item.name} (x${item.quantity})</span>
                  <span style="font-weight: 600;">${item.lineTotalFormatted}</span>
                </div>
              `).join('')}
            </div>

            <div class="summary-row">
              <span>Checkout Subtotal</span>
              <span style="font-weight: 600;">${activeSubtotalFormatted}</span>
            </div>

            <div class="summary-estimate-disclosure">
              💳 <strong>Estimated Surcharge:</strong><br/>
              0.1% for Debit / Prepaid · 0.5% for Credit cards (resolved upon card selection).
            </div>

            <div class="summary-row total">
              <span>Est. Total Range</span>
              <span style="color: var(--accent); font-size: 1.1rem;">
                $${((activeSubtotalCents * 1.001) / 100).toFixed(2)} – $${((activeSubtotalCents * 1.005) / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      `;

      // Initialize Google Pay SDK Client & ReadyCheck
      const client = getPaymentsClient();
      if (!client) {
        document.getElementById('gpay-button-container').innerHTML = `
          <div style="color: var(--error); font-size: 0.9rem;">
            Google Pay JS SDK failed to load. Please check internet connection.
          </div>
        `;
        return;
      }

      const isReadyReq = getIsReadyToPayRequest();
      const readyRes = await client.isReadyToPay(isReadyReq);

      if (!readyRes.result) {
        document.getElementById('gpay-button-container').innerHTML = `
          <div style="color: var(--text-secondary); font-size: 0.9rem; padding: 1rem; background-color: #f9fafb; border-radius: 6px;">
            Google Pay is not available on this device or browser environment.
          </div>
        `;
        return;
      }

      // Create Google Pay Button (buttonColor: 'black', buttonType: 'buy' or 'subscribe')
      const btnType = isSubscriptionCheckout ? 'subscribe' : 'buy';
      const button = client.createButton({
        buttonColor: 'black',
        buttonType: btnType,
        onClick: () => handleGooglePayClick(cart, isSubscriptionCheckout, activeSubtotalCents)
      });

      const btnContainer = document.getElementById('gpay-button-container');
      btnContainer.innerHTML = '';
      btnContainer.appendChild(button);

    } catch (err) {
      console.error('Failed to render checkout page:', err);
      container.innerHTML = `<div style="color: var(--error); padding: 2rem;">Failed to initialize checkout. Please refresh.</div>`;
    }
  };

  async function handleGooglePayClick(cart, isSubscriptionCheckout, activeSubtotalCents) {
    const client = getPaymentsClient();
    if (!client) return;

    const paymentDataRequest = buildPaymentDataRequest(cart, isSubscriptionCheckout, activeSubtotalCents, window.location.origin);

    try {
      const paymentData = await client.loadPaymentData(paymentDataRequest);
      renderInPlaceReview(paymentData, cart, isSubscriptionCheckout, activeSubtotalCents);
    } catch (err) {
      if (err.statusCode === 'CANCELED') {
        console.log('User closed Google Pay sheet.');
      } else {
        console.error('loadPaymentData error:', err);
        window.showToast?.('Google Pay payment sheet error: ' + (err.statusMessage || err.statusCode || 'Payment cancelled'));
      }
    }
  }

  // Render In-Place Review Panel (Replaces button container in place, NOT a modal)
  function renderInPlaceReview(paymentData, cart, isSubscriptionCheckout, activeSubtotalCents) {
    const btnContainer = document.getElementById('gpay-button-container');
    const reviewPanel = document.getElementById('checkout-review-panel');
    if (!btnContainer || !reviewPanel) return;

    btnContainer.style.display = 'none';
    reviewPanel.style.display = 'block';

    const cardInfo = paymentData.paymentMethodData?.info || {};
    const cardFundingSource = cardInfo.cardFundingSource || 'CREDIT';
    const cardDetails = cardInfo.cardNetwork ? `${cardInfo.cardNetwork} (••• ${cardInfo.cardDetails || '1234'})` : 'Card Payment';
    
    // Risk-based 3DS Check (Assurance Details signal inspection)
    const assuranceDetails = cardInfo.assuranceDetails || {};
    console.log('[Risk-based 3DS Check] assuranceDetails signal:', assuranceDetails);

    const surcharge = calculateSurcharge(activeSubtotalCents, cardFundingSource);
    const activeSubtotalFormatted = '$' + (activeSubtotalCents / 100).toFixed(2);

    const subscriptionItem = isSubscriptionCheckout ? cart.items.find(i => i.type === 'subscription') : null;

    reviewPanel.innerHTML = `
      <h3 style="font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">
        Review & Confirm Purchase
      </h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
        Verify order details and card surcharge rate before final payment authorization.
      </p>

      <div style="background-color: #f9fafb; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.5rem;">
          <span style="color: var(--text-secondary);">Payment Method:</span>
          <span style="font-weight: 600;">${cardDetails} — <span style="color: var(--accent);">${cardFundingSource}</span></span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.5rem;">
          <span style="color: var(--text-secondary);">Base Subtotal:</span>
          <span style="font-weight: 600;">${activeSubtotalFormatted}</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--warning);">
          <span>Card Processing Fee (${surcharge.rateText}):</span>
          <span style="font-weight: 600;">+${surcharge.surchargeFormatted}</span>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; margin-top: 0.75rem; display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 600;">
          <span>Final Authorized Total:</span>
          <span style="color: var(--accent);">${surcharge.finalTotalFormatted}${isSubscriptionCheckout ? '/mo' : ''}</span>
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem;">
        <button type="button" id="confirm-purchase-btn" class="btn-primary" style="flex: 1; padding: 0.85rem; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
          Confirm Purchase (${surcharge.finalTotalFormatted})
        </button>
        <button type="button" id="cancel-review-btn" style="background: none; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.85rem 1.25rem; font-weight: 500; color: var(--text-secondary); cursor: pointer;">
          Cancel
        </button>
      </div>
    `;

    // Cancel Review listener
    document.getElementById('cancel-review-btn').addEventListener('click', () => {
      reviewPanel.style.display = 'none';
      btnContainer.style.display = 'block';
    });

    // Confirm Purchase listener (Processing state simulation)
    document.getElementById('confirm-purchase-btn').addEventListener('click', async (e) => {
      const confirmBtn = e.target.closest('button');
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.7';
      confirmBtn.style.cursor = 'wait';
      confirmBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        <span>Processing…</span>
      `;

      console.log('--- Google Pay Authorization Confirmed ---');
      console.log('Payment Method Token Payload:', paymentData.paymentMethodData?.tokenizationData?.token);
      console.log('Final Charged Amount:', surcharge.finalTotalFormatted);

      // Simulate network confirmation processing
      await new Promise(r => setTimeout(r, 1200));

      window.showToast?.(`Order confirmed! Final total: ${surcharge.finalTotalFormatted}`);
      
      // In Phase 4, this redirects to /order/:id. For Phase 3a, notify user.
      reviewPanel.innerHTML = `
        <div style="text-align: center; padding: 1.5rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✅</div>
          <h3 style="font-size: 1.25rem; font-weight: 600; color: var(--success); margin-bottom: 0.3rem;">Payment Authorized</h3>
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
            TEST settlement simulated successfully for ${surcharge.finalTotalFormatted}.
          </p>
          <a href="/" class="btn-primary">Return to Store</a>
        </div>
      `;
    });
  }

  // Keyframe spinner rule for button
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

})();

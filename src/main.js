/**
 * Main Application Orchestrator
 * Integrates Google Pay client with the UI for Feature 1 (Core Checkout Button),
 * Sabre Gateway, Card Funding Surcharge Engine, and Post-Sheet Review Flow.
 */

import { checkIsReadyToPay, renderGooglePayButton, triggerGooglePay } from './googlePayClient.js';
import { parseCardFundingSource, calculateSurcharge } from './pricing.js';

// Initial base transaction info
const currentCart = {
  totalPrice: '29.99',
  currencyCode: 'USD',
  totalPriceStatus: 'FINAL'
};

// Store transient state between Google Pay sheet completion & acquirer authorization
let pendingAuthorization = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupModalListeners();
});

async function initApp() {
  const container = document.getElementById('gpay-button-container');
  const statusEl = document.getElementById('checkout-status');

  if (!container) return;

  try {
    statusEl.innerHTML = '<span class="status-info">Checking Google Pay availability...</span>';

    // 1. isReadyToPay() Gating
    const isReady = await checkIsReadyToPay();

    if (isReady) {
      statusEl.innerHTML = '<span class="status-success">Google Pay is ready. Rendered official checkout button.</span>';
      
      // 2. Render Google Pay Button
      renderGooglePayButton(container, handlePaymentClick);
    } else {
      statusEl.innerHTML = '<span class="status-warning">Google Pay is not available on this device/browser.</span>';
      container.style.display = 'none';
    }
  } catch (error) {
    console.error('Initialization error:', error);
    statusEl.innerHTML = `<span class="status-error">Initialization error: ${error.message}</span>`;
  }
}

/**
 * Click handler for the Google Pay checkout button
 */
async function handlePaymentClick() {
  const statusEl = document.getElementById('checkout-status');

  try {
    statusEl.innerHTML = '<span class="status-info">Opening Google Pay payment sheet...</span>';

    const transactionInfo = {
      totalPrice: currentCart.totalPrice,
      currencyCode: currentCart.currencyCode,
      totalPriceStatus: currentCart.totalPriceStatus
    };

    // 3. Trigger loadPaymentData
    const paymentData = await triggerGooglePay(transactionInfo);

    // Extract payment method details and cardFundingSource signal via pricing module
    const { fundingSource, isSimulated, cardNetwork } = parseCardFundingSource(paymentData);

    // Calculate dynamic surcharge based on card funding source via pricing module
    const basePriceNum = parseFloat(currentCart.totalPrice);
    const { rateLabel, surchargeAmount, finalTotal } = calculateSurcharge(basePriceNum, fundingSource);

    // Store pending authorization state
    pendingAuthorization = {
      paymentData,
      basePrice: basePriceNum,
      cardFundingSource: fundingSource,
      isSimulated,
      cardNetwork,
      surchargeRate: rateLabel,
      surchargeAmount,
      finalTotal,
      gateway: 'sabre'
    };

    // Build display card label with explicit (simulated) marker if fallback fired
    const cardDisplayLabel = `${cardNetwork} (${fundingSource})${isSimulated ? ' (simulated)' : ''}`;

    // Populate review modal
    document.getElementById('review-base-price').textContent = `$${basePriceNum.toFixed(2)}`;
    document.getElementById('review-card-info').textContent = cardDisplayLabel;
    document.getElementById('review-surcharge-rate').textContent = rateLabel;
    document.getElementById('review-surcharge-amount').textContent = `+$${surchargeAmount.toFixed(2)}`;
    document.getElementById('review-final-total').textContent = `$${finalTotal.toFixed(2)}`;

    // Show review modal for user review before acquirer authorization
    statusEl.innerHTML = '<span class="status-warning">Google Pay sheet completed. Awaiting user final authorization on review screen...</span>';
    document.getElementById('review-modal').classList.add('visible');

  } catch (err) {
    if (err.statusCode === 'CANCELED') {
      statusEl.innerHTML = '<span class="status-warning">Payment sheet dismissed by user.</span>';
    } else {
      console.error('Payment error:', err);
      statusEl.innerHTML = `<span class="status-error">Payment Error: ${err.statusMessage || err.statusCode || 'Unknown error'}</span>`;
    }
  }
}

/**
 * Setup modal action event listeners
 */
function setupModalListeners() {
  const reviewModal = document.getElementById('review-modal');
  const resultModal = document.getElementById('result-modal');
  const authorizeBtn = document.getElementById('authorize-btn');
  const cancelReviewBtn = document.getElementById('cancel-review-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const statusEl = document.getElementById('checkout-status');
  const modalContent = document.getElementById('modal-payload-content');

  // Handle final acquirer authorization confirmation
  if (authorizeBtn) {
    authorizeBtn.addEventListener('click', async () => {
      if (!pendingAuthorization) return;

      reviewModal.classList.remove('visible');
      statusEl.innerHTML = `<span class="status-info">Authorizing $${pendingAuthorization.finalTotal.toFixed(2)} with Sabre gateway acquirer...</span>`;

      // Simulate acquirer authorization network request delay
      await new Promise(resolve => setTimeout(resolve, 600));

      statusEl.innerHTML = '<span class="status-success">Payment authorized successfully with Sabre acquirer!</span>';

      const paymentData = pendingAuthorization.paymentData;
      const sanitizedData = {
        apiVersion: paymentData.apiVersion,
        apiVersionMinor: paymentData.apiVersionMinor,
        gateway: pendingAuthorization.gateway,
        cardFundingSource: pendingAuthorization.cardFundingSource,
        isFundingSourceSimulated: pendingAuthorization.isSimulated,
        cardNetwork: pendingAuthorization.cardNetwork,
        basePrice: `$${pendingAuthorization.basePrice.toFixed(2)}`,
        surchargeRate: pendingAuthorization.surchargeRate,
        surchargeFee: `$${pendingAuthorization.surchargeAmount.toFixed(2)}`,
        finalAmountAuthorized: `$${pendingAuthorization.finalTotal.toFixed(2)}`,
        paymentMethodData: {
          type: paymentData.paymentMethodData?.type,
          description: paymentData.paymentMethodData?.description,
          tokenizationData: {
            type: paymentData.paymentMethodData?.tokenizationData?.type,
            token: '[OPAQUE_SABRE_TOKEN_RECEIVED]'
          }
        }
      };

      if (modalContent) {
        modalContent.textContent = JSON.stringify(sanitizedData, null, 2);
      }
      if (resultModal) {
        resultModal.classList.add('visible');
      }

      pendingAuthorization = null;
    });
  }

  // Handle cancel on review modal
  if (cancelReviewBtn) {
    cancelReviewBtn.addEventListener('click', () => {
      reviewModal.classList.remove('visible');
      statusEl.innerHTML = '<span class="status-warning">Acquirer authorization cancelled by user.</span>';
      pendingAuthorization = null;
    });
  }

  // Handle result modal close
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      resultModal.classList.remove('visible');
    });
  }

  // Dismiss on clicking overlay background
  document.addEventListener('click', (e) => {
    if (e.target === reviewModal) {
      reviewModal.classList.remove('visible');
      statusEl.innerHTML = '<span class="status-warning">Acquirer authorization cancelled by user.</span>';
      pendingAuthorization = null;
    } else if (e.target === resultModal) {
      resultModal.classList.remove('visible');
    }
  });
}


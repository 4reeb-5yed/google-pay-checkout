import { checkIsReadyToPay, renderGooglePayButton, triggerGooglePay } from './googlePayClient.js';
import { parseCardFundingSource, calculateSurcharge } from './pricing.js';
import { buildRecurringTransactionInfo, parseRecurringMitDetails } from './recurring.js';

// Active cart transaction state (defaults to Monthly Subscription)
const currentCart = {
  totalPrice: '14.99',
  currencyCode: 'USD',
  totalPriceStatus: 'FINAL',
  isRecurring: true
};

// Store transient state between Google Pay sheet completion & acquirer authorization
let pendingAuthorization = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupPlanSwitcher();
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
      const isBlocked = typeof google === 'undefined' || !google?.payments?.api;
      if (isBlocked) {
        statusEl.innerHTML = '<span class="status-warning">⚠️ Google Pay SDK is blocked by your browser (e.g. Brave Shields / AdBlocker). Turn off Shields or AdBlocker for <code>localhost</code> to enable Google Pay.</span>';
      } else {
        statusEl.innerHTML = '<span class="status-warning">Google Pay is not available on this device/browser.</span>';
      }
      container.style.display = 'none';
    }
  } catch (error) {
    console.error('Initialization error:', error);
    statusEl.innerHTML = '<span class="status-warning">⚠️ Google Pay SDK failed to load. If using Brave Browser or an AdBlocker, please disable Shields/AdBlocker for <code>localhost</code> and refresh.</span>';
  }
}

/**
 * Attaches plan selection switchers (One-Time $29.99 vs Monthly $14.99/mo)
 */
function setupPlanSwitcher() {
  const recurringOpt = document.getElementById('plan-option-recurring');
  const onetimeOpt = document.getElementById('plan-option-onetime');
  const totalLabel = document.getElementById('total-label');
  const cartTotal = document.getElementById('cart-total');
  const totalPeriod = document.getElementById('total-period');
  const radios = document.getElementsByName('checkout-plan');

  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (mode === 'recurring') {
        currentCart.totalPrice = '14.99';
        currentCart.isRecurring = true;
        recurringOpt.classList.add('active');
        onetimeOpt.classList.remove('active');
        if (totalLabel) totalLabel.textContent = 'Monthly Total';
        if (cartTotal) cartTotal.childNodes[0].textContent = '$14.99';
        if (totalPeriod) totalPeriod.style.display = 'inline';
      } else {
        currentCart.totalPrice = '29.99';
        currentCart.isRecurring = false;
        onetimeOpt.classList.add('active');
        recurringOpt.classList.remove('active');
        if (totalLabel) totalLabel.textContent = 'Total Amount';
        if (cartTotal) cartTotal.childNodes[0].textContent = '$29.99';
        if (totalPeriod) totalPeriod.style.display = 'none';
      }
    });
  });
}

/**
 * Click handler for the Google Pay checkout button
 */
async function handlePaymentClick() {
  const statusEl = document.getElementById('checkout-status');

  try {
    statusEl.innerHTML = `<span class="status-info">Opening Google Pay payment sheet (${currentCart.isRecurring ? 'Recurring Subscription' : 'One-Time Purchase'})...</span>`;

    // 3. Build appropriate payload based on selected plan (recurring vs one-time)
    let transactionData;
    if (currentCart.isRecurring) {
      transactionData = buildRecurringTransactionInfo(currentCart.totalPrice, currentCart.currencyCode);
    } else {
      transactionData = {
        totalPrice: currentCart.totalPrice,
        currencyCode: currentCart.currencyCode,
        totalPriceStatus: currentCart.totalPriceStatus
      };
    }

    // Trigger loadPaymentData (googlePayClient handles dual-path execution)
    const paymentData = await triggerGooglePay(transactionData);

    // Extract payment method details and cardFundingSource signal via pricing module
    const { fundingSource, isSimulated, cardNetwork } = parseCardFundingSource(paymentData);

    // Extract MIT details if recurring
    const mitDetails = currentCart.isRecurring ? parseRecurringMitDetails(paymentData) : null;

    // Calculate dynamic surcharge based on card funding source via pricing module
    const basePriceNum = parseFloat(currentCart.totalPrice);
    const { rateLabel, surchargeAmount, finalTotal } = calculateSurcharge(basePriceNum, fundingSource);

    const unitSuffix = currentCart.isRecurring ? '/mo' : '';

    // Store pending authorization state
    pendingAuthorization = {
      paymentData,
      isRecurring: currentCart.isRecurring,
      basePrice: basePriceNum,
      cardFundingSource: fundingSource,
      isSimulated,
      cardNetwork,
      surchargeRate: rateLabel,
      surchargeAmount,
      finalTotal,
      gateway: 'sabre',
      mitDetails,
      unitSuffix
    };

    // Build display card label with explicit (simulated) marker if fallback fired
    const cardDisplayLabel = `${cardNetwork} (${fundingSource})${isSimulated ? ' (simulated)' : ''}`;

    // Populate review modal
    document.getElementById('review-base-price').textContent = `$${basePriceNum.toFixed(2)}${unitSuffix}`;
    document.getElementById('review-card-info').textContent = cardDisplayLabel;
    document.getElementById('review-surcharge-rate').textContent = rateLabel;
    document.getElementById('review-surcharge-amount').textContent = `+$${surchargeAmount.toFixed(2)}`;
    document.getElementById('review-final-total').textContent = `$${finalTotal.toFixed(2)}${unitSuffix}`;

    // Show review modal for user review before acquirer authorization
    statusEl.innerHTML = '<span class="status-warning">Google Pay sheet completed. Awaiting user final authorization...</span>';
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

      const unit = pendingAuthorization.unitSuffix;
      reviewModal.classList.remove('visible');
      statusEl.innerHTML = `<span class="status-info">Authorizing $${pendingAuthorization.finalTotal.toFixed(2)}${unit} with Sabre gateway acquirer...</span>`;

      // Simulate acquirer authorization network request delay
      await new Promise(resolve => setTimeout(resolve, 600));

      statusEl.innerHTML = `<span class="status-success">Payment ${pendingAuthorization.isRecurring ? '& MIT mandate ' : ''}authorized successfully with Sabre acquirer!</span>`;

      const paymentData = pendingAuthorization.paymentData;
      const sanitizedData = {
        apiVersion: paymentData.apiVersion,
        apiVersionMinor: paymentData.apiVersionMinor,
        checkoutType: pendingAuthorization.isRecurring ? 'RECURRING_SUBSCRIPTION' : 'ONE_TIME_PURCHASE',
        gateway: pendingAuthorization.gateway,
        cardFundingSource: pendingAuthorization.cardFundingSource,
        isFundingSourceSimulated: pendingAuthorization.isSimulated,
        cardNetwork: pendingAuthorization.cardNetwork,
        basePrice: `$${pendingAuthorization.basePrice.toFixed(2)}${unit}`,
        surchargeRate: pendingAuthorization.surchargeRate,
        surchargeFee: `$${pendingAuthorization.surchargeAmount.toFixed(2)}`,
        finalAmountAuthorized: `$${pendingAuthorization.finalTotal.toFixed(2)}${unit}`,
        mitRecurringMandate: pendingAuthorization.mitDetails || 'N/A (One-Time Purchase)',
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



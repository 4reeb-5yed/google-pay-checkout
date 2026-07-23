/**
 * Google Pay Client Wrapper
 * Handles PaymentsClient initialization, isReadyToPay gating, button rendering, and loadPaymentData calls.
 */

import { GPAY_CONFIG, getIsReadyToPayRequest, getCardPaymentMethod } from './config.js';

let paymentsClient = null;

/**
 * Ensures Google Pay JavaScript SDK is fully loaded before client initialization.
 * @param {number} timeoutMs - Maximum milliseconds to wait for script loading (default 3s)
 * @returns {Promise<boolean>}
 */
export function waitForGooglePaySdk(timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (typeof google !== 'undefined' && google?.payments?.api) {
      return resolve(true);
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (typeof google !== 'undefined' && google?.payments?.api) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 50);
  });
}

/**
 * Lazy initialization of Google PaymentsClient
 */
export function getGooglePaymentsClient() {
  if (!paymentsClient) {
    if (typeof google === 'undefined' || !google.payments || !google.payments.api) {
      throw new Error('Google Pay JavaScript SDK is not loaded.');
    }
    paymentsClient = new google.payments.api.PaymentsClient({
      environment: GPAY_CONFIG.environment
    });
  }
  return paymentsClient;
}

/**
 * Checks if the user is ready to pay with Google Pay.
 * @returns {Promise<boolean>}
 */
export async function checkIsReadyToPay() {
  try {
    const isLoaded = await waitForGooglePaySdk();
    if (!isLoaded) {
      throw new Error('Google Pay JavaScript SDK failed to load within timeout.');
    }
    const client = getGooglePaymentsClient();
    const response = await client.isReadyToPay(getIsReadyToPayRequest());
    return !!(response && response.result);
  } catch (err) {
    console.error('Error checking isReadyToPay:', err);
    return false;
  }
}

/**
 * Creates and renders the official Google Pay button into a container.
 * @param {HTMLElement} container - DOM element to render button in
 * @param {Function} onClickHandler - Click event handler for payment initiation
 * @param {Object} options - Optional button customization options
 */
export function renderGooglePayButton(container, onClickHandler, options = {}) {
  const client = getGooglePaymentsClient();
  
  const defaultOptions = {
    onClick: onClickHandler,
    buttonType: 'buy',
    buttonColor: 'black',
    buttonSizeMode: 'fill'
  };

  const buttonOptions = Object.assign({}, defaultOptions, options);
  const button = client.createButton(buttonOptions);

  container.innerHTML = '';
  container.appendChild(button);
}

/**
 * Prepares the PaymentDataRequest object for loadPaymentData.
 * Supports both standard one-time purchase requests and recurring transaction requests.
 * 
 * @param {Object} transactionData - Transaction info or recurringTransactionInfo object
 * @returns {Object} PaymentDataRequest
 */
export function buildPaymentDataRequest(transactionData) {
  const baseRequest = {
    apiVersion: GPAY_CONFIG.apiVersion,
    apiVersionMinor: GPAY_CONFIG.apiVersionMinor,
    allowedPaymentMethods: [getCardPaymentMethod()],
    merchantInfo: GPAY_CONFIG.merchantInfo
  };

  // Check if payload is a recurring transaction request
  if (transactionData && (transactionData.recurringTransactionInfo || transactionData.recurrenceItems)) {
    const recurringPayload = transactionData.recurringTransactionInfo || transactionData;
    return Object.assign(baseRequest, {
      recurringTransactionInfo: recurringPayload
    });
  }

  // Standard One-Time Transaction Path ($29.99 or single cart item)
  return Object.assign(baseRequest, {
    transactionInfo: transactionData
  });
}

/**
 * Triggers the Google Pay payment sheet.
 * @param {Object} transactionInfo - Transaction details
 * @returns {Promise<Object>} Payment data payload from Google Pay
 */
export async function triggerGooglePay(transactionInfo) {
  const client = getGooglePaymentsClient();
  const requestPayload = buildPaymentDataRequest(transactionInfo);
  return await client.loadPaymentData(requestPayload);
}

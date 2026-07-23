/**
 * Express Guest Checkout & Data Collection Module
 * Handles product attribute validation, guest card payment parameters,
 * and contact/address data extraction from Google Pay API responses.
 */

import { getBaseCardPaymentMethod, GPAY_CONFIG } from './config.js';

/**
 * Validates that required product attributes (Size and Color) are selected.
 * @param {Object} selectedAttributes - { size, color }
 * @returns {Object} { isValid, missingAttributes }
 */
export function validateProductAttributes(selectedAttributes = {}) {
  const missing = [];
  if (!selectedAttributes.size) missing.push('Size');
  if (!selectedAttributes.color) missing.push('Color');

  return {
    isValid: missing.length === 0,
    missingAttributes: missing,
    summary: missing.length === 0 ? `${selectedAttributes.color}, Size ${selectedAttributes.size}` : ''
  };
}

/**
 * Returns card payment method extended with FULL billing address and phone number requirements.
 * @returns {Object} CardPaymentMethod with billingAddressParameters
 */
export function getGuestCardPaymentMethod() {
  const baseCard = getBaseCardPaymentMethod();
  return Object.assign({}, baseCard, {
    tokenizationSpecification: GPAY_CONFIG.tokenizationSpecification,
    parameters: Object.assign({}, baseCard.parameters, {
      billingAddressRequired: true,
      billingAddressParameters: {
        format: 'FULL',
        phoneNumberRequired: true
      }
    })
  });
}

/**
 * Extracts and formats email, shipping address, phone number, and billing address from Google Pay response.
 * Logs console.warn messages and flags simulated states whenever payload fields are missing.
 * 
 * @param {Object} paymentData - Google Pay loadPaymentData response payload
 * @returns {Object} Guest contact & address details with simulation flags
 */
export function parseGuestContactData(paymentData) {
  let isEmailSimulated = false;
  let isShippingSimulated = false;
  let isBillingSimulated = false;

  // 1. Email Extraction & Fallback
  let email = paymentData?.email;
  if (!email) {
    console.warn('[Google Pay Checkout Warning] email field missing from PaymentData payload. Falling back to simulated value: guest.developer@example.com.');
    isEmailSimulated = true;
    email = 'guest.developer@example.com';
  }

  // 2. Shipping Address Extraction & Fallback
  const rawShipping = paymentData?.shippingAddress;
  if (!rawShipping || !rawShipping.address1) {
    console.warn('[Google Pay Checkout Warning] shippingAddress field missing from PaymentData payload. Falling back to simulated address: 123 Innovation Way, San Francisco, CA.');
    isShippingSimulated = true;
  }

  const shippingAddress = {
    name: rawShipping?.name || 'John Doe (Guest)',
    address1: rawShipping?.address1 || '123 Innovation Way',
    address2: rawShipping?.address2 || 'Suite 400',
    locality: rawShipping?.locality || 'San Francisco',
    administrativeArea: rawShipping?.administrativeArea || 'CA',
    postalCode: rawShipping?.postalCode || '94105',
    countryCode: rawShipping?.countryCode || 'US',
    phoneNumber: rawShipping?.phoneNumber || '+1 (555) 019-2834'
  };

  // 3. Billing Address Extraction & Fallback
  const paymentMethodData = paymentData?.paymentMethodData || {};
  const rawBilling = paymentMethodData.info?.billingAddress;
  if (!rawBilling || !rawBilling.address1) {
    console.warn('[Google Pay Checkout Warning] billingAddress field missing from PaymentData payload. Falling back to simulated address: 123 Innovation Way, San Francisco, CA.');
    isBillingSimulated = true;
  }

  const billingAddress = {
    name: rawBilling?.name || shippingAddress.name,
    address1: rawBilling?.address1 || shippingAddress.address1,
    locality: rawBilling?.locality || shippingAddress.locality,
    administrativeArea: rawBilling?.administrativeArea || shippingAddress.administrativeArea,
    postalCode: rawBilling?.postalCode || shippingAddress.postalCode,
    countryCode: rawBilling?.countryCode || shippingAddress.countryCode,
    phoneNumber: rawBilling?.phoneNumber || shippingAddress.phoneNumber
  };

  return {
    email,
    isEmailSimulated,
    shippingAddress,
    isShippingSimulated,
    billingAddress,
    isBillingSimulated,
    displayShippingString: `${shippingAddress.address1}, ${shippingAddress.locality}, ${shippingAddress.administrativeArea} ${shippingAddress.postalCode}`,
    displayBillingString: `${billingAddress.address1}, ${billingAddress.locality}, ${billingAddress.administrativeArea} ${billingAddress.postalCode}`
  };
}

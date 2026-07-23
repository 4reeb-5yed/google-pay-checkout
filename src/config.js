/**
 * Google Pay API Configuration
 * Specifications grounded in official Google Pay Web API v2 docs.
 */

export const GPAY_CONFIG = {
  apiVersion: 2,
  apiVersionMinor: 0,

  // Environment set to TEST as required by scope
  environment: 'TEST',

  // Merchant info for TEST mode
  merchantInfo: {
    merchantId: '12345678901234567890',
    merchantName: 'CanSpirit AI Demo Store'
  },

  // Allowed card networks & authentication methods
  allowedCardNetworks: [
    'AMEX',
    'DISCOVER',
    'INTERAC',
    'JCB',
    'MASTERCARD',
    'VISA'
  ],

  allowedCardAuthMethods: [
    'PAN_ONLY',
    'CRYPTOGRAM_3DS'
  ],

  // Gateway tokenization spec for TEST environment
  tokenizationSpecification: {
    type: 'PAYMENT_GATEWAY',
    parameters: {
      gateway: 'sabre',
      gatewayMerchantId: 'exampleGatewayMerchantId'
    }
  }
};

/**
 * Base card payment method used for isReadyToPay check
 */
export function getBaseCardPaymentMethod() {
  return {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: GPAY_CONFIG.allowedCardAuthMethods,
      allowedCardNetworks: GPAY_CONFIG.allowedCardNetworks
    }
  };
}

/**
 * Full card payment method with tokenization specification for loadPaymentData
 */
export function getCardPaymentMethod() {
  return Object.assign(
    {},
    getBaseCardPaymentMethod(),
    {
      tokenizationSpecification: GPAY_CONFIG.tokenizationSpecification
    }
  );
}

/**
 * Request configuration for isReadyToPay()
 */
export function getIsReadyToPayRequest() {
  return {
    apiVersion: GPAY_CONFIG.apiVersion,
    apiVersionMinor: GPAY_CONFIG.apiVersionMinor,
    allowedPaymentMethods: [getBaseCardPaymentMethod()]
  };
}

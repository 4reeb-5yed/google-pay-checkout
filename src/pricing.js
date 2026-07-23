/**
 * Pricing & Surcharge Logic Module
 * Handles card funding source extraction, fallback detection, and fee calculations.
 */

/**
 * Parses card funding source details from Google Pay payment payload.
 * Emits console warning and flags simulated state if cardFundingSource is missing.
 * 
 * @param {Object} paymentData - Google Pay loadPaymentData response object
 * @returns {Object} { fundingSource, isSimulated, cardNetwork }
 */
export function parseCardFundingSource(paymentData) {
  const paymentMethodData = paymentData?.paymentMethodData || {};
  const info = paymentMethodData.info || {};
  const rawFundingSource = info.cardFundingSource;
  const cardNetwork = info.cardNetwork || paymentMethodData.description || 'CARD';

  if (!rawFundingSource) {
    console.warn('[Google Pay Checkout Warning] cardFundingSource signal is missing/undefined in PaymentData payload. Falling back to simulated value: CREDIT.');
    return {
      fundingSource: 'CREDIT',
      isSimulated: true,
      cardNetwork
    };
  }

  return {
    fundingSource: rawFundingSource.toUpperCase(),
    isSimulated: false,
    cardNetwork
  };
}

/**
 * Calculates card funding surcharge based on business specification:
 * - DEBIT & PREPAID: 0.1% extra fee
 * - CREDIT: 0.5% extra fee
 * 
 * @param {number} basePrice
 * @param {string} fundingSource - 'CREDIT', 'DEBIT', 'PREPAID', etc.
 * @returns {Object} { rateLabel, surchargeAmount, finalTotal }
 */
export function calculateSurcharge(basePrice, fundingSource = 'CREDIT') {
  const normalizedSource = (fundingSource || 'CREDIT').toUpperCase();
  let rate = 0.0;
  let rateLabel = '0.0%';

  if (normalizedSource === 'DEBIT' || normalizedSource === 'PREPAID') {
    rate = 0.001; // 0.1%
    rateLabel = '0.1%';
  } else if (normalizedSource === 'CREDIT') {
    rate = 0.005; // 0.5%
    rateLabel = '0.5%';
  }

  const surchargeAmount = Math.round(basePrice * rate * 100) / 100;
  const finalTotal = Math.round((basePrice + surchargeAmount) * 100) / 100;

  return {
    rateLabel,
    surchargeAmount,
    finalTotal
  };
}

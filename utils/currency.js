// utils/currency.js
const axios = require('axios');

/**
 * Converts an amount from USD (system default) to a target local currency (e.g., KES)
 * using live rates.
 * @param {Number} amountUSD - Amount entered by user in USD
 * @param {String} targetCurrency - Target local currency code (e.g., 'KES')
 */
const convertFromUSD = async (amountUSD, targetCurrency = 'KES') => {
  try {
    const response = await axios.get('https://open.er-api.com/v6/latest/USD');
    
    if (response.data && response.data.result === 'success') {
      const rate = response.data.rates[targetCurrency.toUpperCase()] || 130;
      const convertedAmount = Number((amountUSD * rate).toFixed(2));
      return {
        convertedAmount,
        exchangeRate: rate
      };
    } else {
      throw new Error('Failed to retrieve live exchange rates.');
    }
  } catch (err) {
    console.error('Currency Conversion Error:', err.message);
    // Fallback rate if external API fails
    const fallbackRate = 130;
    return {
      convertedAmount: Number((amountUSD * fallbackRate).toFixed(2)),
      exchangeRate: fallbackRate
    };
  }
};

module.exports = {
  convertFromUSD
};
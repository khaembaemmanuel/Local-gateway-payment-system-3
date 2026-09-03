// services/currencyService.js
const axios = require('axios');

/**
 * Fetches live exchange rate from local currency to USD
 * @param {String} baseCurrency - e.g., 'KES', 'EUR', 'GBP'
 */
async function getExchangeRateToUSD(baseCurrency) {
  try {
    // Using a reliable public standard endpoint (Replace with your chosen API Key provider)
    // Example using ExchangeRate-API (Free public tier or similar REST API)
    const response = await axios.get(`https://open.er-api.com/v6/latest/${baseCurrency}`);
    
    if (response.data && response.data.result === 'success') {
      const rateToUSD = response.data.rates.USD; // Value of 1 Unit of Local Currency in USD
      return rateToUSD;
    } else {
      throw new Error('Unable to fetch valid exchange rate data.');
    }
  } catch (error) {
    console.err('Currency API Error:', error.message);
    throw new Error('Exchange rate service currently unavailable.');
  }
}

module.exports = { getExchangeRateToUSD };
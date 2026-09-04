// utils/currency.js
const convertFromUSD = async (amount, targetCurrency) => {
  // If no currency conversion API is needed yet or it defaults to 1:1, 
  // you can return the amount directly or implement your rate lookup here.
  const rates = {
    USD: 1,
    KES: 130, // Example conversion rate for Kenyan Shillings if applicable
    EUR: 0.92,
    GBP: 0.79
  };
  
  const rate = rates[targetCurrency] || 1;
  return Number((amount * rate).toFixed(2));
};

module.exports = {
  convertFromUSD
};
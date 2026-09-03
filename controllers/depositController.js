// controllers/depositController.js
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getExchangeRateToUSD } = require('../services/currencyService');

async function handleDeposit(req, res) {
  try {
    const userId = req.user._id || req.body.userId;
    const { amountLocal, currencyLocal } = req.body;

    if (!amountLocal || amountLocal <= 0) {
      return res.status(400).json({ error: 'Invalid deposit amount.' });
    }

    // Pull user profile to check their registered currency if not explicitly passed
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const baseCurrency = currencyLocal || user.currency || 'KES';
    const rateToUSD = await getExchangeRateToUSD(baseCurrency);

    const amountUSD = Number((amountLocal * rateToUSD).toFixed(2));

    const newTransaction = new Transaction({
      userId,
      amount: amountLocal,
      currency: baseCurrency,
      amountUSD,
      exchangeRate: rateToUSD,
      status: 'Completed'
    });

    await newTransaction.save();

    return res.status(200).json({
      message: 'Deposit successful and converted.',
      transaction: {
        id: newTransaction._id,
        amountLocal: `${baseCurrency} ${amountLocal}`,
        amountUSD: `USD $${amountUSD}`,
        exchangeRateApplied: rateToUSD,
        date: newTransaction.createdAt
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error processing currency conversion.' });
  }
}

module.exports = { handleDeposit };
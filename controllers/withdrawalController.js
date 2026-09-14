// controllers/withdrawalController.js
const WithdrawalRequest = require('../models/WithdrawalRequest');
const User = require('../models/User');
const { getExchangeRateFromUSD } = require('../services/currencyService');

async function handleWithdrawal(req, res) {
  try {
    const userId = req.user._id || req.body.userId;
    const { amountUSD, phoneNumber } = req.body; // System default USD entered by user

    if (!amountUSD || amountUSD <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount in USD.' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Recipient phone number is required.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Check if user has sufficient USD balance
    if (user.balance < amountUSD) {
      return res.status(400).json({ error: 'Insufficient account balance.' });
    }

    const targetCurrency = 'KES';
    const rateToKES = await getExchangeRateFromUSD(targetCurrency);

    // Convert system default USD to local KES payout equivalent
    const payoutAmountLocal = Number((amountUSD * rateToKES).toFixed(2));

    const newWithdrawal = new WithdrawalRequest({
      userId,
      amountUSD,                  // Deducted from USD system balance
      payoutAmountLocal,          // Disbursed in KES to mobile phone
      currency: targetCurrency,
      exchangeRate: rateToKES,
      phoneNumber,
      status: 'Pending'
    });

    await newWithdrawal.save();

    return res.status(200).json({
      message: 'Withdrawal request successfully queued and converted to local currency.',
      withdrawal: {
        id: newWithdrawal._id,
        amountUSD: `USD $${amountUSD}`,
        payoutAmountLocal: `${targetCurrency} ${payoutAmountLocal}`,
        exchangeRateApplied: rateToKES,
        phoneNumber,
        date: newWithdrawal.createdAt
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error processing withdrawal currency conversion.' });
  }
}

module.exports = { handleWithdrawal };
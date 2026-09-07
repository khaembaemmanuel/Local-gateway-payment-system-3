// routes/withdraw.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WithdrawalRequest = require('../models/WithdrawalRequest'); // Optional: if using separate model
const { TRANSACTION_TYPES, TRANSACTION_STATUS, GATEWAYS } = require('../config/constants');

// ==========================================
// 1. INITIATE MANUAL M-PESA/GATEWAY WITHDRAWAL
// ==========================================
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, phone, currencyLocal } = req.body;
    const userId = req.user.userId;

    // Fix validation bug: check if amount is missing or less than/equal to 0
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user has sufficient balance
    if (user.balance < Number(amount)) {
      return res.status(400).json({ success: false, message: 'Insufficient account balance' });
    }

    const targetPhone = phone || user.phoneNumber;
    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Recipient phone number is required' });
    }

    // Generate a unique tracking reference ID
    const referenceID = `WD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    // Calculate exchange rate and USD amount (using user's exchange rate or default 130)
    const exchangeRate = user.exchangeRate || 130;
    const amountUSD = Number(amount) / exchangeRate;

    // Create a Pending withdrawal transaction record for the admin portal & user history
    const transaction = new Transaction({
      userId,
      amount: Number(amount),
      amountUSD: amountUSD,
      exchangeRate: exchangeRate,
      currency: currencyLocal || user.currency || 'KES',
      type: 'Withdrawal',
      gateway: 'M-Pesa',
      status: 'Pending',
      reference: referenceID,
      metadata: { phone: targetPhone }
    });
    await transaction.save();

    // Optionally save to WithdrawalRequest model if your admin portal reads from it
    await WithdrawalRequest.create({
      userId,
      amountUSD: amountUSD,
      payoutAmountLocal: Number(amount),
      currency: currencyLocal || user.currency || 'KES',
      phoneNumber: targetPhone,
      status: 'Pending'
    });

    // Deduct balance immediately or hold it until admin approves (deducting here prevents double spending)
    await User.findByIdAndUpdate(userId, {
      $inc: { balance: -amountUSD } // Deducting USD equivalent from user balance
    });

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully and is pending admin approval.',
      reference: referenceID
    });

  } catch (err) {
    console.error('Manual Withdrawal Error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request',
      error: err.message
    });
  }
});

module.exports = router;
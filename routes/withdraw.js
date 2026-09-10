// routes/withdraw.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');

// ==========================================
// 1. INITIATE MANUAL M-PESA/GATEWAY WITHDRAWAL (USD Input)
// ==========================================
router.post('/withdraw', auth, async (req, res) => {
  try {
    // Accept USD amount from the frontend form fields
    const rawAmount = req.body.amount || req.body.withdrawalAmount || req.body.amountUSD;
    const phone = req.body.phone || req.body.phoneNumber;
    const currencyLocal = req.body.currencyLocal || req.body.currency;
    const userId = req.user.userId;

    const amountUSD = Number(rawAmount);

    if (!rawAmount || isNaN(amountUSD) || amountUSD <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount in USD' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user has sufficient USD balance first
    if (user.balance < amountUSD) {
      return res.status(400).json({ success: false, message: 'Insufficient account balance' });
    }

    const exchangeRate = user.exchangeRate || 130;
    const payoutAmountLocal = amountUSD * exchangeRate; // Convert USD input to local equivalent

    const targetPhone = phone || user.phoneNumber;
    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Recipient phone number is required' });
    }

    const referenceID = `WD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    // Create Transaction record
    const transaction = new Transaction({
      userId,
      amount: payoutAmountLocal, // Stored as local currency equivalent
      amountUSD: amountUSD,     // Stored as entered USD amount
      exchangeRate: exchangeRate,
      currency: currencyLocal || user.currency || 'KES',
      type: 'Withdrawal',
      gateway: 'M-Pesa',
      status: 'Pending',
      reference: referenceID,
      metadata: { phone: targetPhone }
    });
    await transaction.save();

    // Create WithdrawalRequest record for admin portal
    await WithdrawalRequest.create({
      userId,
      amountUSD: amountUSD,
      payoutAmountLocal: payoutAmountLocal,
      currency: currencyLocal || user.currency || 'KES',
      phoneNumber: targetPhone,
      status: 'Pending'
    });

    // Deduct USD balance immediately
    await User.findByIdAndUpdate(userId, {
      $inc: { balance: -amountUSD }
    });

    return res.json({
      success: true,
      message: 'Withdrawal request submitted successfully and is pending admin approval.',
      reference: referenceID,
      amountUSD,
      payoutAmountLocal
    });

  } catch (err) {
    console.error('Manual Withdrawal Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request',
      error: err.message
    });
  }
});

// ==========================================
// 2. GET USER TRANSACTION HISTORY
// ==========================================
router.get('/transactions', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    console.error('Fetch Transactions Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load transaction history'
    });
  }
});

module.exports = router;
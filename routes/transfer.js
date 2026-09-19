// routes/transfer.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, env.jwtSecret || process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    next();
  });
};

// ==========================================
// 1. LOOKUP RECIPIENT ACCOUNT
// ==========================================
router.get('/lookup/:accountNumber', authenticateToken, async (req, res, next) => {
  try {
    const { accountNumber } = req.params;
    const recipient = await User.findOne({ accountNumber: accountNumber.trim() }).select('firstName lastName accountNumber username');
    
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient account number not found.' });
    }

    if (recipient._id.toString() === req.userId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot transfer funds to your own account.' });
    }

    res.status(200).json({
      success: true,
      recipient: {
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        accountNumber: recipient.accountNumber,
        username: recipient.username
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. INITIATE INTERNAL TRANSFER
// ==========================================
router.post('/internal', authenticateToken, async (req, res, next) => {
  let session = null;
  try {
    // Robust safety fallback if req.body is undefined
    const body = req.body || {};
    console.log('📥 Incoming Transfer Request Body:', body);
    
    const recipientAccountNumber = body.recipientAccountNumber || 
                                   body.recipientAccount || 
                                   body.accountNumber || 
                                   body.account || 
                                   (req.query ? req.query.recipientAccountNumber : null);
                                   
    const amount = body.amount;
    const note = body.note;
    const transferAmount = parseFloat(amount);

    if (!recipientAccountNumber) {
      return res.status(400).json({ success: false, message: 'Recipient account number is required.' });
    }

    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid transfer amount.' });
    }

    // Attempt session start (safely falls back if MongoDB is standalone)
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessionErr) {
      console.warn('⚠️ Replica set not configured; executing transfer without session transaction.');
    }

    const senderQuery = User.findById(req.userId);
    const sender = session ? await senderQuery.session(session) : await senderQuery;
    
    if (!sender) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(404).json({ success: false, message: 'Sender account not found.' });
    }

    if (sender.balance < transferAmount) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({ success: false, message: 'Insufficient account balance for this transfer.' });
    }

    const recipientQuery = User.findOne({ accountNumber: String(recipientAccountNumber).trim() });
    const recipient = session ? await recipientQuery.session(session) : await recipientQuery;
    
    if (!recipient) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(404).json({ success: false, message: 'Recipient account number does not exist.' });
    }

    if (sender._id.toString() === recipient._id.toString()) {
      if (session) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({ success: false, message: 'Cannot transfer funds to the same account.' });
    }

    // Update balances
    sender.balance -= transferAmount;
    recipient.balance += transferAmount;

    if (session) {
      await sender.save({ session });
      await recipient.save({ session });
    } else {
      await sender.save();
      await recipient.save();
    }

    const transferRef = 'TRF-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);

    // Save transaction logs
    const senderTransaction = new Transaction({
      userId: sender._id,
      type: 'Withdrawal',
      amount: transferAmount,
      amountLocal: transferAmount,
      currency: sender.currency || 'USD',
      exchangeRate: 1,
      gateway: 'Internal Transfer',
      status: 'Completed',
      reference: transferRef,
      recipientAccountNumber: recipient.accountNumber,
      metadata: { 
        direction: 'OUT',
        note: note || 'Internal Transfer Out', 
        otherPartyName: `${recipient.firstName} ${recipient.lastName}`,
        otherPartyAccount: recipient.accountNumber
      }
    });

    const recipientTransaction = new Transaction({
      userId: recipient._id,
      type: 'Deposit',
      amount: transferAmount,
      amountLocal: transferAmount,
      currency: recipient.currency || 'USD',
      exchangeRate: 1,
      gateway: 'Internal Transfer',
      status: 'Completed',
      reference: transferRef + '-REC',
      recipientAccountNumber: sender.accountNumber,
      metadata: { 
        direction: 'IN',
        note: note || 'Internal Transfer In', 
        otherPartyName: `${sender.firstName} ${sender.lastName}`,
        otherPartyAccount: sender.accountNumber
      }
    });

    if (session) {
      await senderTransaction.save({ session });
      await recipientTransaction.save({ session });
      await session.commitTransaction();
      session.endSession();
    } else {
      await senderTransaction.save();
      await recipientTransaction.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Internal transfer completed successfully!',
      newBalance: sender.balance,
      reference: transferRef
    });

  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (e) {}
    }
    console.error('Transfer Error Stack:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error during transfer.' });
  }
});

module.exports = router;
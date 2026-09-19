// routes/transfer.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Middleware to authenticate JWT token (matching your existing auth guard pattern)
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

    // Prevent transferring to self
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
// 2. INITIATE INTERNAL TRANSFER (Atomic Session)
// ==========================================
router.post('/internal', authenticateToken, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { recipientAccountNumber, amount, note } = req.body;
    const transferAmount = parseFloat(amount);

    if (isNaN(transferAmount) || transferAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Please provide a valid transfer amount.' });
    }

    // Fetch sender and lock session
    const sender = await User.findById(req.userId).session(session);
    if (!sender) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Sender account not found.' });
    }

    // Check if sender has enough balance
    if (sender.balance < transferAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Insufficient account balance for this transfer.' });
    }

    // Fetch recipient and lock session
    const recipient = await User.findOne({ accountNumber: recipientAccountNumber.trim() }).session(session);
    if (!recipient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Recipient account number does not exist.' });
    }

    if (sender._id.toString() === recipient._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Cannot transfer funds to the same account.' });
    }

    // 1. Deduct from sender
    sender.balance -= transferAmount;
    await sender.save({ session });

    // 2. Add to recipient
    recipient.balance += transferAmount;
    await recipient.save({ session });

    // 3. Generate unique reference ID
    const transferRef = 'TRF-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);

    // 4. Create transaction log for SENDER (Outgoing Transfer)
    const senderTransaction = new Transaction({
      userId: sender._id,
      type: 'WITHDRAWAL',
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
        recipientName: `${recipient.firstName} ${recipient.lastName}`,
        otherPartyName: `${recipient.firstName} ${recipient.lastName}`,
        otherPartyAccount: recipient.accountNumber
      }
    });
    await senderTransaction.save({ session });

    // 5. Create transaction log for RECIPIENT (Incoming Transfer)
    const recipientTransaction = new Transaction({
      userId: recipient._id,
      type: 'DEPOSIT',
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
        senderName: `${sender.firstName} ${sender.lastName}`,
        otherPartyName: `${sender.firstName} ${sender.lastName}`,
        otherPartyAccount: sender.accountNumber
      }
    });
    await recipientTransaction.save({ session });

    // Commit the transaction atomically
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Internal transfer completed successfully!',
      newBalance: sender.balance,
      reference: transferRef
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});

module.exports = router;
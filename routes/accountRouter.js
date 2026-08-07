// routes/accountRouter.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// ==========================================
// 1. GET ACCOUNT DASHBOARD PROFILE
// ==========================================
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -otp');
    if (!user) return res.status(404).json({ success: false, message: 'User account not found' });

    const recentTransactions = await Transaction.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        username: user.username,
        email: user.email,
        accountNumber: user.accountNumber,
        accountType: user.accountType,
        balance: user.balance,
        recentTransactions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ==========================================
// 2. TRANSFER MONEY TO ANOTHER ACCOUNT
// ==========================================
router.post('/transfer', auth, async (req, res) => {
  try {
    const { recipientAccountNumber, amount } = req.body;
    const transferAmount = Number(amount);

    if (!transferAmount || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid transfer amount' });
    }

    const sender = await User.findById(req.user.userId);
    if (!sender) return res.status(404).json({ success: false, message: 'Sender not found' });

    if (sender.accountNumber === recipientAccountNumber) {
      return res.status(400).json({ success: false, message: 'You cannot transfer money to your own account' });
    }

    if (sender.balance < transferAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance for this transfer' });
    }

    const recipient = await User.findOne({ accountNumber: recipientAccountNumber });
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient account number not found' });
    }

    // Atomic Balance Updates
    await User.findByIdAndUpdate(sender._id, { $inc: { balance: -transferAmount } });
    await User.findByIdAndUpdate(recipient._id, { $inc: { balance: transferAmount } });

    // Record sender transaction record
    const senderTx = new Transaction({
      userId: sender._id,
      type: 'Transfer',
      amount: transferAmount,
      gateway: 'System',
      recipientAccountNumber,
      status: 'Completed'
    });
    await senderTx.save();

    const updatedSender = await User.findById(sender._id).select('balance');

    res.json({
      success: true,
      message: `Successfully transferred KES ${transferAmount} to account ${recipientAccountNumber}`,
      remainingBalance: updatedSender.balance
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
// controllers/adminController.js
const User = require('../models/User');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Transaction = require('../models/Transaction');
const { convertFromUSD } = require('../utils/currency');

// 1. Get all registered clients with local currency balance equivalents
const getAllClients = async (req, res, next) => {
  try {
    const clients = await User.find().select('-password').sort({ createdAt: -1 });
    
    // Attach calculated local balance equivalents for administrative visibility
    const clientsWithLocalValues = await Promise.all(clients.map(async (client) => {
      const clientObj = client.toObject();
      clientObj.localBalanceEquivalent = await convertFromUSD(client.balance, client.currency);
      return clientObj;
    }));

    return res.status(200).json({
      success: true,
      count: clientsWithLocalValues.length,
      clients: clientsWithLocalValues
    });
  } catch (err) {
    next(err);
  }
};

// 2. Get all pending withdrawal requests requiring manual payout
const getPendingWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ status: 'Pending' })
      .populate('userId', 'firstName lastName email accountNumber phoneNumber currency')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: withdrawals.length,
      withdrawals
    });
  } catch (err) {
    next(err);
  }
};

// 3. Mark a withdrawal as completed (Indicates manual disbursement was done)
const completeWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;

    const withdrawal = await WithdrawalRequest.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    }

    if (withdrawal.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Withdrawal is already ${withdrawal.status.toLowerCase()}` });
    }

    withdrawal.status = 'Completed';
    await withdrawal.save();

    return res.status(200).json({
      success: true,
      message: `Withdrawal marked as completed. Disburse ${withdrawal.currency} ${withdrawal.payoutAmountLocal.toLocaleString()} manually to ${withdrawal.phoneNumber}.`
    });
  } catch (err) {
    next(err);
  }
};

// 4. Reject a withdrawal and refund USD balance back to the user
const rejectWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;

    const withdrawal = await WithdrawalRequest.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    }

    if (withdrawal.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Withdrawal is already ${withdrawal.status.toLowerCase()}` });
    }

    // Refund the USD amount back to the user's ledger balance
    const user = await User.findById(withdrawal.userId);
    if (user) {
      user.balance += withdrawal.amountUSD;
      await user.save();
    }

    withdrawal.status = 'Rejected';
    await withdrawal.save();

    return res.status(200).json({
      success: true,
      message: 'Withdrawal request rejected and USD balance refunded to user account.'
    });
  } catch (err) {
    next(err);
  }
};

// 5. Toggle User Block Status (Block / Unblock)
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    user.isBlocked = isBlocked;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Client account has been successfully ${isBlocked ? 'blocked' : 'unblocked'}.`
    });
  } catch (err) {
    next(err);
  }
};

// 6. Delete User Account
const deleteUserAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    // Prevent deleting the master admin account via interface safety
    if (process.env.ADMIN_EMAIL && user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Cannot delete the master admin account.' });
    }

    await User.findByIdAndDelete(id);

    // Clean up related transaction logs
    await Transaction.deleteMany({ userId: id });

    return res.status(200).json({
      success: true,
      message: 'Client account and associated records deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// 7. Get Client Transaction History
const getClientTransactionHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const transactions = await Transaction.find({ userId: id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllClients,
  getPendingWithdrawals,
  completeWithdrawal,
  rejectWithdrawal,
  updateUserStatus,
  deleteUserAccount,
  getClientTransactionHistory
};
// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { 
  getAllClients, 
  getPendingWithdrawals, 
  completeWithdrawal, 
  rejectWithdrawal,
  updateUserStatus,
  deleteUserAccount,
  getClientTransactionHistory,
  updateUserBalance
} = require('../controllers/adminController');
const verifyHardcodedAdmin = require('../middleware/adminAuth');
const User = require('../models/User'); // Required for admin user approval workflow

// --- Admin Authentication Endpoint ---
router.post('/login', (req, res) => {
  const { password } = req.body;

  // Verify password against environment variable
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Invalid administrator password.' });
  }

  // Generate secure JWT token
  const token = jwt.sign(
    { role: 'admin' }, 
    process.env.ADMIN_SECRET_KEY, 
    { expiresIn: '2h' }
  );

  // Issue secure HttpOnly cookie
  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 40 * 24 * 60 * 60 * 1000 // 2 hours
  });

  return res.json({ success: true, message: 'Admin authentication successful' });
});

// --- Apply Admin Middleware to All Routes Below ---
router.use(verifyHardcodedAdmin);

// Admin Endpoints
router.get('/clients', getAllClients);
router.get('/withdrawals/pending', getPendingWithdrawals);
router.post('/withdrawals/:id/complete', completeWithdrawal);
router.post('/withdrawals/:id/reject', rejectWithdrawal);

// Client Management & Audit Controls
router.put('/clients/:id/status', updateUserStatus);
router.delete('/clients/:id', deleteUserAccount);
router.get('/clients/:id/transactions', getClientTransactionHistory);
router.put('/clients/:id/balance', updateUserBalance); // Added balance editing endpoint

// ==========================================
// PENDING USER REGISTRATION APPROVAL ENDPOINTS
// ==========================================

// GET: Fetch all users pending approval
router.get('/pending-users', async (req, res, next) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' }).select('-password -otp');
    res.status(200).json({ success: true, count: pendingUsers.length, users: pendingUsers });
  } catch (err) {
    next(err);
  }
});

// POST: Approve a user account
router.post('/approve-user/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.status = 'active'; // Activate account so they can log in
    await user.save();

    res.status(200).json({ 
      success: true, 
      message: `User ${user.firstName} ${user.lastName} has been successfully approved!` 
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
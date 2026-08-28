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
  getClientTransactionHistory
} = require('../controllers/adminController');
const verifyHardcodedAdmin = require('../middleware/adminAuth');

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
    maxAge: 2 * 60 * 60 * 1000 // 2 hours
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

module.exports = router;
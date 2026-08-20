const express = require('express');
const router = express.Router();
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 

// 1. JWT Authentication Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized access. Token missing.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// 2. Standard Admin Guard Middleware (Allows ADMIN and SUPERADMIN)
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id || req.user._id);

    if (user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')) {
      req.adminUser = user;
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      message: 'Access Denied: Administrator privileges required.' 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Security check failed.' });
  }
};

// 3. Strict Super Admin Guard Middleware (Allows ONLY SUPERADMIN)
const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id || req.user._id);

    if (user && user.role === 'SUPERADMIN') {
      req.adminUser = user;
      return next();
    }

    return res.status(403).json({ 
      success: false, 
      message: 'Access Denied: Super Admin privileges required.' 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Security check failed.' });
  }
};

// ------------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------------

// SERVE PRIVATE ADMIN HTML DIRECTLY (GET /admin/dashboard)
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../private/admin.html'));
});

// ==========================================
// SUPER ADMIN MONITORING & MANAGEMENT ROUTES
// ==========================================

// GET ALL ADMIN ACCOUNTS (GET /admin/list-admins)
router.get('/list-admins', verifyToken, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ['ADMIN', 'SUPERADMIN'] } }).select('-password');
    return res.json({ success: true, count: admins.length, admins });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin accounts.' });
  }
});

// PROMOTE OR DEMOTE USER ROLE (POST /admin/set-role)
router.post('/set-role', verifyToken, requireSuperAdmin, async (req, res) => {
  const { userId, role } = req.body; // role: 'USER', 'ADMIN', or 'SUPERADMIN'

  const normalizedRole = role ? role.toUpperCase() : '';
  if (!['USER', 'ADMIN', 'SUPERADMIN'].includes(normalizedRole)) {
    return res.status(400).json({ success: false, message: 'Invalid role specified.' });
  }

  try {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found.' });
    }

    targetUser.role = normalizedRole;
    await targetUser.save();

    return res.json({ 
      success: true, 
      message: `User account ${targetUser.email} has been updated to role: ${normalizedRole}` 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
});

// ==========================================
// STANDARD ADMIN & SUPER ADMIN MANAGEMENT ROUTES
// ==========================================

// GET TOTAL REGISTERED USERS COUNT (GET /admin/users/count)
router.get('/users/count', verifyToken, requireAdmin, async (req, res) => {
  try {
    const count = await User.countDocuments();
    return res.json({ success: true, count });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user count.' });
  }
});

// SEARCH USER BY ACCOUNT NUMBER OR EMAIL (GET /admin/user/search?query=...)
router.get('/user/search', verifyToken, requireAdmin, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ success: false, message: 'Please provide an account number or email.' });
  }

  try {
    const user = await User.findOne({
      $or: [
        { accountNumber: query.trim() },
        { email: query.trim().toLowerCase() }
      ]
    }).select('-password'); // Exclude password hash

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error searching database.' });
  }
});

// ADJUST BALANCE (ADD OR DEDUCT) (POST /admin/adjust-balance)
router.post('/adjust-balance', verifyToken, requireAdmin, async (req, res) => {
  const { userId, amount, action } = req.body; // action: 'add' or 'deduct'

  const parsedAmount = parseFloat(amount);
  if (!userId || isNaN(parsedAmount) || parsedAmount <= 0 || !['add', 'deduct'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid payload or amount.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Target account not found.' });
    }

    let currentBalance = parseFloat(user.balance) || 0;

    if (action === 'add') {
      currentBalance += parsedAmount;
    } else if (action === 'deduct') {
      if (parsedAmount > currentBalance) {
        return res.status(400).json({ success: false, message: 'Cannot deduct more than the current available balance.' });
      }
      currentBalance -= parsedAmount;
    }

    user.balance = currentBalance;
    await user.save();

    return res.json({ 
      success: true, 
      message: `Successfully ${action === 'add' ? 'added' : 'deducted'} $${parsedAmount.toFixed(2)}.`,
      newBalance: user.balance 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user balance.' });
  }
});

// TOGGLE ACCOUNT DEACTIVATION STATUS (POST /admin/toggle-status)
router.post('/toggle-status', verifyToken, requireAdmin, async (req, res) => {
  const { userId, status } = req.body; // status: 'active' or 'deactivated'

  if (!userId || !['active', 'deactivated'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status command.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Target account not found.' });
    }

    user.status = status; 
    user.isDeactivated = (status === 'deactivated');
    await user.save();

    return res.json({ 
      success: true, 
      message: `Account has been set to ${status.toUpperCase()}.`,
      status: user.status
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update account status.' });
  }
});

// DELETE USER ACCOUNT PERMANENTLY (DELETE /admin/delete-user/:userId)
router.delete('/delete-user/:userId', verifyToken, requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;

  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'Account not found or already deleted.' });
    }

    return res.json({ 
      success: true, 
      message: `User account ${deletedUser.email} has been permanently deleted.` 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete user account.' });
  }
});

module.exports = router;
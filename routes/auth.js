const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

// ==========================================
// MIDDLEWARE: JWT AUTHENTICATION GUARD
// ==========================================
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
// 1. REGISTER USER
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      country, 
      phone, 
      gender, 
      dob, 
      address, 
      accountType, 
      currency, 
      password 
    } = req.body;

    const username = req.body.username || (email ? email.split('@')[0] : null);

    if (!firstName || !lastName || !email || !password || !accountType || !currency) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please complete all required fields.' 
      });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'An account with this email or username already exists.' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const accountNumber = 'SRCB' + Math.floor(100000 + Math.random() * 900000);

    const newUser = new User({
      firstName,
      lastName,
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      country: country || null,
      phoneNumber: phone || req.body.phoneNumber || null,
      gender: gender || null,
      dob: dob || null,
      address: address || null,
      accountNumber,
      accountType: accountType || 'Savings',
      currency: currency || 'USD',
      balance: 0.00
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id, accountNumber: newUser.accountNumber, role: newUser.role },
      env.jwtSecret || process.env.JWT_SECRET,
      { expiresIn: env.jwtExpiresIn || '1d' }
    );

    const userPayload = {
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      username: newUser.username,
      accountNumber: newUser.accountNumber,
      accountType: newUser.accountType,
      currency: newUser.currency,
      balance: newUser.balance
    };

    res.status(201).json({ 
      success: true,
      message: 'Account created successfully', 
      token,
      user: userPayload,
      account: userPayload
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ==========================================
// 2. DIRECT SINGLE-STEP LOGIN (NO OTP)
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username and password are required' });
    }

    const user = await User.findOne({ 
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }] 
    });
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // --- NEW: BLOCK DEACTIVATED ACCOUNTS ---
    if (user.status === 'deactivated' || user.isDeactivated === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deactivated by the bank administrator. Please contact support.' 
      });
    }
    // ---------------------------------------

    const token = jwt.sign(
      { userId: user._id, accountNumber: user.accountNumber, role: user.role },
      env.jwtSecret || process.env.JWT_SECRET,
      { expiresIn: env.jwtExpiresIn || '1d' }
    );

    const userPayload = {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      accountNumber: user.accountNumber,
      accountType: user.accountType,
      currency: user.currency,
      balance: user.balance
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userPayload,
      account: userPayload
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ==========================================
// 3. FETCH USER PROFILE (/me)
// ==========================================
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -otp');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        accountNumber: user.accountNumber,
        accountType: user.accountType,
        currency: user.currency,
        balance: user.balance
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ==========================================
// 4. DEPOSIT FUNDS
// ==========================================
router.post('/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid deposit amount' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.balance = (user.balance || 0) + numericAmount;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Deposit successful',
      newBalance: user.balance
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ==========================================
// 5. WITHDRAW FUNDS
// ==========================================
router.post('/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid withdrawal amount' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (numericAmount > user.balance) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    user.balance -= numericAmount;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal successful',
      newBalance: user.balance
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
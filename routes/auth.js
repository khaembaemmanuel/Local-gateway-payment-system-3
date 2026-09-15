// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
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
// 1. REGISTER USER (Forced to USER Role & Pending Status)
// ==========================================
router.post('/register', async (req, res, next) => {
  try {
    const { 
      firstName, 
      lastName, 
      username,
      email, 
      password, 
      country, 
      phoneNumber, 
      gender, 
      dob, 
      address, 
      accountType, 
      currency 
    } = req.body;

    const generatedUsername = username || (email ? email.split('@')[0] : null);

    if (!firstName || !lastName || !email || !password || !accountType || !currency || !dob) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please complete all required fields including date of birth.' 
      });
    }

    // AGE VALIDATION (Enforcing minimum age requirement of 18 years old)
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(400).json({ 
        success: false, 
        message: 'You must be at least 18 years old to register an account.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username: generatedUsername }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'An account with this email or username already exists.' 
      });
    }

    // Hash password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique account number
    const accountNumber = Math.floor(1000000000000000 + Math.random() * 9000000000000000);

    // Create and save new user - Set status to 'pending' awaiting admin approval
    const newUser = new User({
      firstName,
      lastName,
      username: generatedUsername,
      email: email.toLowerCase(),
      password: hashedPassword,
      country: country || null,
      phoneNumber: phoneNumber || req.body.phone || null,
      gender: gender || null,
      dob: dobDate,
      address: address || null,
      accountNumber,
      accountType: accountType || 'Savings',
      currency: currency || 'USD',
      balance: 0.00,
      role: 'USER',
      status: 'pending' // Require admin activation before user can access dashboard
    });

    await newUser.save();

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful! Your account is pending administrator approval before you can log in.', 
      accountNumber 
    });
  } catch (err) {
    console.error('Registration Error:', err);
    next(err);
  }
});

// ==========================================
// 2. DIRECT LOGIN ROUTE (Blocks Pending Accounts)
// ==========================================
router.post('/login', async (req, res, next) => {
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

    // Block pending approval accounts
    if (user.status === 'pending') {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account is currently pending administrator approval. Please wait for activation.' 
      });
    }

    // Block deactivated accounts
    if (user.status === 'deactivated' || user.isDeactivated === true) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been deactivated by the bank administrator. Please contact support.' 
      });
    }

    // Check against .env configuration for admin email dynamically
    const configuredAdminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase() : '';
    const isEnvAdmin = user.email && user.email.toLowerCase() === configuredAdminEmail;
    const isDbAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

    // If matched via .env, ensure their database role is synchronized to ADMIN
    if (isEnvAdmin && !isDbAdmin) {
      user.role = 'ADMIN';
      await user.save();
    }

    const isAdmin = isEnvAdmin || isDbAdmin;

    const token = jwt.sign(
      { userId: user._id, accountNumber: user.accountNumber, role: user.role },
      env.jwtSecret || process.env.JWT_SECRET,
      { expiresIn: env.jwtExpiresIn || '1d' }
    );
    
    // Assign redirection path: private folder admin.html for admins, public dashboard for regular users
    const redirectTo = isAdmin ? '/admin/admin.html' : '/dashboard.html';

    const userPayload = {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      accountNumber: user.accountNumber,
      accountType: user.accountType,
      currency: user.currency,
      balance: user.balance,
      role: user.role
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      role: user.role,
      redirectTo: redirectTo, // Tells frontend precisely where to navigate user
      user: userPayload,
      account: userPayload
    });
  } catch (err) {
    console.error('Login Error:', err);
    next(err);
  }
});

// ==========================================
// 3. FETCH USER PROFILE (/me)
// ==========================================
router.get('/me', authenticateToken, async (req, res, next) => {
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
        balance: user.balance,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. DEPOSIT FUNDS
// ==========================================
router.post('/deposit', authenticateToken, async (req, res, next) => {
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
    next(err);
  }
});

// ==========================================
// 5. WITHDRAW FUNDS
// ==========================================
router.post('/withdraw', authenticateToken, async (req, res, next) => {
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
    next(err);
  }
});

// ==========================================
// 6. FORGOT PASSWORD ROUTE (2-minute OTP)
// ==========================================
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User email not found' 
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    user.otp = {
      code: otpCode,
      expiresAt: expiresAt,
      isVerified: false
    };
    
    user.resetOtp = otpCode;
    user.resetOtpExpire = expiresAt;
    
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"Swift Royal Capital Bank" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset Verification Code',
      text: `Hello ${user.firstName || 'Client'},\n\nYour password reset OTP code is: ${otpCode}\n\nThis code will expire in 2 minutes. If you did not request this, please ignore this email.\n\nRegards,\nSwift Royal Capital Bank`
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email. It will expire in 2 minutes.'
    });

  } catch (err) {
    console.error('Email Dispatch Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP email. Please try again later.' });
  }
});

// ==========================================
// 7. VERIFY OTP ROUTE
// ==========================================
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const isValidCode = (user && user.otp && user.otp.code === code) || (user && user.resetOtp === code);
    
    if (!user || !isValidCode) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
    }

    const expirationTime = user.otp?.expiresAt || user.resetOtpExpire;
    if (expirationTime && Date.now() > new Date(expirationTime).getTime()) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    if (user.otp) {
      user.otp.isVerified = true;
    }
    await user.save();

    return res.status(200).json({ 
      success: true, 
      message: 'OTP verified successfully. You can now reset your password.' 
    });

  } catch (err) {
    next(err);
  }
});

// ==========================================
// 8. RESET PASSWORD ROUTE (Min 8 characters)
// ==========================================
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const isValidCode = (user && user.otp && user.otp.code === otp) || (user && user.resetOtp === otp);
    
    if (!user || !isValidCode) {
      return res.status(400).json({ success: false, message: 'Invalid session or OTP code.' });
    }

    const expirationTime = user.otp?.expiresAt || user.resetOtpExpire;
    if (expirationTime && Date.now() > new Date(expirationTime).getTime()) {
      return res.status(400).json({ success: false, message: 'Session expired. Please restart the reset process.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.otp = { code: null, expiresAt: null, isVerified: false };
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;

    await user.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Password reset successful! You can now log in with your new password.' 
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
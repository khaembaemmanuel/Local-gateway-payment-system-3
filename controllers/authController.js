// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// ==========================================
// 1. REGISTRATION ROUTE
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

    // AGE VALIDATION (Enforcing minimum age requirement of 23 years old)
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }

    if (age < 23) {
      return res.status(400).json({ success: false, message: 'You must be at least 23 years old to register an account.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username or Email is already registered.' });
    }

    // Validate and sanitize currency selection against allowed schema options
    const allowedCurrencies = ['USD', 'EUR', 'GBP', 'KES'];
    const userCurrency = currency && allowedCurrencies.includes(currency.toUpperCase()) 
      ? currency.toUpperCase() 
      : 'USD';

    // Hash password securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique account number (e.g., timestamp + random digits)
    const accountNumber = 'SRCB' + Math.floor(1000000000 + Math.random() * 9000000000);

    // Create and save new user
    const newUser = new User({
      firstName,
      lastName,
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      country,
      phoneNumber,
      gender,
      dob: dobDate,
      address,
      accountNumber,
      accountType: accountType || 'Savings',
      currency: userCurrency,
      balance: 0.00,
      role: 'USER'
    });

    await newUser.save();

    res.status(201).json({ 
      success: true, 
      message: 'Registration successful!', 
      accountNumber,
      currency: userCurrency 
    });
  } catch (err) {
    next(err);
  }
});


// ==========================================
// 2. FORGOT PASSWORD ROUTE (Generates 2-minute OTP)
// ==========================================
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(200).json({ 
        success: true, 
        message: 'If that email exists, an OTP has been sent.' 
      });
    }

    // Generate 6-digit OTP code and set expiration to 2 minutes
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

    console.log(`[OTP SYSTEM] Password Reset OTP for ${email}: ${otpCode}`);

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email. It will expire in 2 minutes.'
    });

  } catch (err) {
    next(err);
  }
});


// ==========================================
// 3. VERIFY OTP ROUTE
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
// 4. RESET PASSWORD ROUTE (Min 8 characters)
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
// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ 
        success: true, 
        message: 'If that email exists, an OTP has been sent.' 
      });
    }
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 1000);

    user.otp = {
      code: otpCode,
      expiresAt: expiresAt,
      isVerified: false
    };
    
    await user.save();


    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email. It will expire in 1 minute.'
    });

  } catch (err) {
    next(err);
  }
});

router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.otp || user.otp.code !== code) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
    }

    if (Date.now() > new Date(user.otp.expiresAt).getTime()) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    user.otp.isVerified = true;
    await user.save();

    return res.status(200).json({ 
      success: true, 
      message: 'OTP verified successfully. You can now reset your password.' 
    });

  } catch (err) {
    next(err);
  }
});
const router = require('express').Router();
const User = require('../models/User'); // Your database model

router.post('/register', async (req, res) => {
  try {
    const { dob, email, password } = req.body;

    //AGE VALIDATION 
    const dobDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - dobDate.getFullYear();
    const monthDiff = today.getMonth() - dobDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
      age--;
    }

    if (age < 18) {
      return res.status(400).json({ message: 'You must be at least 18 years old to register.' });
    }
    // -------------------------------

    //Saving to database
    res.status(201).json({ message: 'Registration successful!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
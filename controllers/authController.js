// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// 1. Request Password Reset (Generates OTP expiring in 1 minute)
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

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 1 minute from now (1 min * 60 sec * 1000 ms)
    const expiresAt = new Date(Date.now() + 60 * 1000);

    user.otp = {
      code: otpCode,
      expiresAt: expiresAt,
      isVerified: false
    };
    
    await user.save();

    // TODO: Add your email sending service here (e.g., Nodemailer) to send `otpCode`

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email. It will expire in 1 minute.'
    });

  } catch (err) {
    next(err);
  }
});

// 2. Verify OTP
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.otp || user.otp.code !== code) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
    }

    // Check if OTP has expired
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

module.exports = router;
// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const connectDB = require('./config/db');
const PORT = process.env.PORT || 4000;

// Initialize express app FIRST before using app.use()
const app = express();

// 1. Core Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// 3. API routers & Verification Endpoint
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/account', require('./routes/accountRouter'));
// Mount Admin Routes (Handles /admin/dashboard, /admin/user/search, etc.)
app.use('/admin', require('./routes/adminRouter'));

// Google reCAPTCHA Verification Endpoint
app.post('/verify-captcha', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, message: 'Captcha token is missing' });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    try {
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;
        const response = await axios.post(verifyUrl);

        if (response.data.success) {
            return res.json({ success: true, message: 'Verification successful' });
        } else {
            return res.json({ success: false, message: 'Google reCAPTCHA validation failed' });
        }
    } catch (error) {
        console.error('reCAPTCHA server error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error during verification' });
    }
});

// 4. Root Endpoint / Health Check
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'UP', timestamp: new Date().toISOString() });
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 5. Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
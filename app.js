// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 4000;
const app = express();

// Trust proxy if behind a reverse proxy like Render
app.set('trust proxy', 1);

// 1. Professional Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      frameSrc: ["'self'", "https://www.google.com"],
      connectSrc: ["'self'", "https://api.safaricom.co.ke", "https://sandbox.safaricom.co.ke"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. Strict CORS Policy
const allowedOrigins = [
  'https://infoswiftroyalinvestment.online',
  'https://www.infoswiftroyalinvestment.online'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (like mobile apps, curl, or server-to-server webhooks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy: Origin not allowed.'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate Limiting (Prevent Brute Force & DDoS)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Stricter rate limit for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Max 10 login/register attempts per 15 minutes
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 4. Body Parsing & Input Protection (Payload limits, XSS, HPP)
app.use(express.json({ limit: '10kb' })); // Limit body size to 10kb to prevent payload injection
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(hpp()); // Prevent HTTP Parameter Pollution

// 5. Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache'); // Ensure users always get latest frontend updates
    }
  }
}));

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 6. API routers & Verification Endpoint
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/account', require('./routes/accountRouter'));
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
        console.error('reCAPTCHA server error:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error during verification' });
    }
});

// 7. Root Endpoint / Health Check
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'UP', timestamp: new Date().toISOString() });
});

// 8. Global Error Handling Middleware (Never leak stack traces in production)
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.message);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500 
      ? 'An unexpected error occurred. Please try again later.' 
      : err.message
  });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Secure server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.err('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
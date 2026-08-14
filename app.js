// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const PORT = process.env.PORT || 4000;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(helmet());

//avoiding asset restriction 
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com", "maps.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "images/"],
            connectSrc: ["'self'"],
        },
    })
);
// 2. Define a Rate Limiter for Login/Auth routes to stop bot/brute-force attacks
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 10, // Limit each IP to 10 requests per windowMs for login/signup
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        status: 429,
        error: 'Too many login attempts from this IP, please try again after 15 minutes.'
    }
});
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// 1. Core Middlewares

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// 3. API routers
app.use('/api/auth', require('./routes/auth'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/account', require('./routes/accountRouter'));
// Mount Admin Routes (Handles /admin/dashboard, /admin/user/search, etc.)
app.use('/admin', require('./routes/adminRouter'));
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
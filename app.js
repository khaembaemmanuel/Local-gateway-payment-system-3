// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const PORT = process.env.PORT || 4000;

const app = express();

// 1. Core Middlewares
app.use((req, res, next) => {
  if (req.query.access === 'ManuchoManucho78?' || req.path === '/login') {
    return next();
  }
  res.send(`
    <div style="text-align: center; margin-top: 100px; font-family: sans-serif;">
      <h1>Site Under Maintenance</h1>
      <p>Swift Royal Capital Bank is coming soon. Please check back later.</p>
    </div>
  `);
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// 3. Register API Routers
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
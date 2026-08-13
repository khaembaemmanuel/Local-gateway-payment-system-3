// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const PORT = process.env.PORT || 4000;

const app = express();

// 1. Core Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1.5 Maintenance Mode Middleware
const maintenanceMode = (req, res, next) => {
  // Allow health checks to bypass maintenance so uptime monitors don't fail
  if (req.path === '/health') {
    return next();
  }

  // Check if maintenance mode is enabled via environment variables
  if (process.env.MAINTENANCE_MODE === 'true') {
    return res.status(503).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>System Under Maintenance</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: #f4f7f6;
                  color: #333;
                  text-align: center;
                  padding: 80px 20px;
              }
              .container {
                  max-width: 600px;
                  margin: 0 auto;
                  background: #fff;
                  padding: 40px;
                  border-radius: 8px;
                  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
              }
              h1 { color: #d9534f; margin-bottom: 20px; }
              p { font-size: 16px; line-height: 1.6; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <h1>System Under Maintenance</h1>
              <p>We are currently performing scheduled system upgrades. We will be back online shortly. Thank you for your patience.</p>
          </div>
      </body>
      </html>
    `);
  }

  next();
};

app.use(maintenanceMode);

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
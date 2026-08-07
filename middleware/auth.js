// middleware/auth.js
const jwt = require('jsonwebtoken');
const env = require('../config/env');

module.exports = function (req, res, next) {
  // 1. Extract Authorization header
  const authHeader = req.header('Authorization');
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : null;

  // 2. Reject if token is missing
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. Authentication token missing.' 
    });
  }

  try {
    // 3. Verify token using strictly validated secret
    const decoded = jwt.verify(token, env.jwtSecret);
    
    // Attaches payload (id, role, etc.) to request object
    req.user = decoded; 
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired. Please log in again.' 
      });
    }

    return res.status(403).json({ 
      success: false, 
      message: 'Invalid authentication token.' 
    });
  }
};
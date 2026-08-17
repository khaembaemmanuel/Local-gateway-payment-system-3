// middleware/auth.js
const jwt = require('jsonwebtoken');
const env = require('../config/env');

module.exports = function (req, res, next) {

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
    
    const decoded = jwt.verify(token, env.jwtSecret);
    
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
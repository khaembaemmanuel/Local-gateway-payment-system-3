// middleware/adminAuth.js
const jwt = require('jsonwebtoken');

const verifyAdmin = (req, res, next) => {
  // 1. Bypass strict checks during local testing
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // 2. In production, check for the secure HTTP-only admin cookie
  const token = req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No admin session provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET_KEY);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Invalid privileges.' });
    }

    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired admin session.' });
  }
};

module.exports = verifyAdmin;
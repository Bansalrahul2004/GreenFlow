const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Role-based authorization
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Specific role checks
const isAdmin = authorizeRoles('admin');
const isSupplier = authorizeRoles('supplier');
const isManager = authorizeRoles('manager');
const isConsumer = authorizeRoles('consumer');
// isAdminOrManager: Allows both admin and manager roles to access protected routes (e.g., supplier management)
const isAdminOrManager = authorizeRoles('admin', 'manager');
const isAdminOrSupplier = authorizeRoles('admin', 'supplier');

// Check if user can access supplier data
const canAccessSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    
    if (req.user.role === 'admin') {
      return next();
    }
    
    if (req.user.role === 'supplier' && req.user.supplierId?.toString() === supplierId) {
      return next();
    }
    
    res.status(403).json({ error: 'Access denied to supplier data' });
  } catch (error) {
    res.status(500).json({ error: 'Authorization error' });
  }
};

// Optional authentication (for public endpoints)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  isAdmin,
  isSupplier,
  isManager,
  isConsumer,
  isAdminOrManager,
  isAdminOrSupplier,
  canAccessSupplier,
  optionalAuth
}; 
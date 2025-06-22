const jwt = require("jsonwebtoken");
const User = require("../models/user");

// Get JWT secret from environment or use default
const JWT_SECRET = process.env.JWT_SECRET_PHRASE || 'smartronix-jwt-secret-key-2024';

// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
  try {
    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('User authenticated:', !!req.user);
    console.log('User ID:', req.user?._id);
    
    if (!req.user) {
      console.log('No user found, redirecting to login');
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }
      return res.redirect(`/login?message=Please+log+in+to+continue&redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    console.log('Authentication successful, proceeding to next middleware');
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    console.log('Clearing token due to error');
    res.clearCookie("token");
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication failed' 
      });
    }
    return res.redirect("/login");
  }
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }
      return res.redirect("/login");
    }

    if (req.user.role !== "admin") {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Admin privileges required.' 
        });
      }
      return res.status(403).render("pages/error", {
        message: "Access denied. Admin privileges required.",
        error: {},
        layout: false
      });
    }

    next();
  } catch (error) {
    console.error("Admin Auth Error:", error);
    res.clearCookie("token");
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication failed' 
      });
    }
    return res.redirect("/login");
  }
};

// Role-based authorization middleware
const authorize = (allowedRoles = []) => {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(401).json({ 
            success: false, 
            message: 'Authentication required' 
          });
        }
        return res.redirect(`/login?message=Please+log+in+to+continue&redirect=${encodeURIComponent(req.originalUrl)}`);
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(403).json({ 
            success: false, 
            message: 'Access denied: You do not have permission to access this resource' 
          });
        }
        return res.status(403).render('pages/error', {
          message: 'Access denied: You do not have permission to access this page',
          error: {}
        });
      }

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.clearCookie("token");
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication failed' 
        });
      }
      return res.redirect("/login");
    }
  };
};

module.exports = {
  isAuthenticated,
  isAdmin,
  authorize
};

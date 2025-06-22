const jwt = require("jsonwebtoken");
const User = require("../models/user");

// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }
      return res.redirect(`/login?message=Please+log+in+to+continue&redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_PHRASE);
    const user = await User.findById(decoded.id);

    if (!user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      return res.redirect("/login");
    }

    req.user = user;
    res.locals.user = user;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
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
    const token = req.cookies.token;

    if (!token) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }
      return res.redirect("/login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_PHRASE);
    const user = await User.findById(decoded.id);

    if (!user || user.role !== "admin") {
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

    req.user = user;
    res.locals.user = user;
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
      const token = req.cookies.token;

      if (!token) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(401).json({ 
            success: false, 
            message: 'Authentication required' 
          });
        }
        return res.redirect(`/login?message=Please+log+in+to+continue&redirect=${encodeURIComponent(req.originalUrl)}`);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_PHRASE);
      const user = await User.findById(decoded.id);

      if (!user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(401).json({ 
            success: false, 
            message: 'User not found' 
          });
        }
        return res.redirect("/login");
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
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

      req.user = user;
      res.locals.user = user;
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

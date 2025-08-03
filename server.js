const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const User = require('./models/user');    
const Category = require('./models/Category');
const jwt = require("jsonwebtoken");
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

// Configuration
const config = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    sessionSecret: process.env.SESSION_SECRET,
    jwtSecret: process.env.JWT_SECRET_PHRASE,
    mongoUri: process.env.MONGODB_URI
};

// Validate required environment variables
if (!config.sessionSecret) {
    console.error('SESSION_SECRET environment variable is required');
    process.exit(1);
}

if (!config.jwtSecret) {
    console.error('JWT_SECRET_PHRASE environment variable is required');
    process.exit(1);
}

if (!config.mongoUri) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
}

// Connect to database
connectDB();

const app = express();

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

// Security middleware
app.use(cors());
app.use(compression());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Session middleware
app.use(session({
    secret: config.sessionSecret,
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: config.env === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    },
    name: 'smartronics.sid',
    store: MongoStore.create({
        mongoUrl: config.mongoUri,
        ttl: 24 * 60 * 60, // 24 hours
        autoRemove: 'native',
        touchAfter: 24 * 3600 // time period in seconds
    })
}));

// Logging
if (config.env === 'development') {
    app.use(morgan('dev'));
}

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Set view engine and views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Use EJS layouts
app.use(expressLayouts);
app.set('layout', false); // Set default layout to false
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Categories cache
let categoriesCache = {
    data: null,
    timestamp: null,
    isValid: function() {
        return this.data && this.timestamp && 
               (Date.now() - this.timestamp) < (1 * 60 * 1000); // 1 minute
    },
    set: function(data) {
        this.data = data;
        this.timestamp = Date.now();
    },
    get: function() {
        return this.data;
    },
    clear: function() {
        this.data = null;
        this.timestamp = null;
    }
};

// Make cache globally available for controllers
global.categoriesCache = categoriesCache;

// Global categories middleware - must be before routes
app.use(async (req, res, next) => {
    try {
        // Check cache first
        if (categoriesCache.isValid()) {
            res.locals.categories = categoriesCache.get();
            return next();
        }

        // Fetch all categories for the navbar
        const categories = await Category.find().sort({ categoryID: 1 }).lean();
        res.locals.categories = categories || [];
        
        // Cache the results
        categoriesCache.set(categories);
        next();
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.locals.categories = [];
        next();
    }
});

// Ensure categories is always defined for all routes
app.use((req, res, next) => {
    if (typeof res.locals.categories === 'undefined') {
        res.locals.categories = [];
    }
    next();
});

// Add a route to manually clear categories cache
app.post('/admin/clear-categories-cache', (req, res) => {
    try {
        if (global.categoriesCache) {
            global.categoriesCache.clear();
        }
        res.json({ success: true, message: 'Categories cache cleared' });
    } catch (error) {
        console.error('Error clearing categories cache:', error);
        res.status(500).json({ success: false, message: 'Error clearing cache' });
    }
});

// Set path for all routes
app.use((req, res, next) => {
    res.locals.path = req.path;
    next();
});

// Import routes
const homeRoutes = require('./routes/home');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/order');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

app.use(async (req, res, next) => {
    try {
      const token = req.cookies.token;
      if (config.env === 'development') {
        console.log('JWT Middleware - Token:', token ? 'Present' : 'Not present');
      }
  
      if (!token) {
        if (config.env === 'development') {
          console.log('JWT Middleware - No token, setting user to null');
        }
        res.locals.user = null;
        req.user = null;
        return next();
      }
  
      const decoded = jwt.verify(token, config.jwtSecret);
      if (config.env === 'development') {
        console.log('JWT Middleware - Token decoded:', decoded);
      }
      const user = await User.findById(decoded.id);
      if (config.env === 'development') {
        console.log('JWT Middleware - User found:', user ? user.email : 'Not found');
      }
  
      res.locals.user = user || null;
      req.user = user || null;
      next();
    } catch (error) {
      console.error("JWT middleware error:", error);
      res.locals.user = null;
      req.user = null;
      return next();
    }
});

// Use routes
app.use('/', homeRoutes);
app.use('/products', productRoutes);
app.use('/cart', cartRoutes);
app.use('/order', orderRoutes);
app.use('/api/user', userRoutes);
app.use('/admin', adminRoutes);

app.get("/login" , (req,res)=>{
    res.render("pages/login", { layout: false })
})
app.get("/signup" , (req,res)=>{
    res.render("pages/signup", { layout: false })
})

// Test login page
app.get("/test-login", (req, res) => {
    res.sendFile(path.join(__dirname, 'test-login.html'));
})

// Test cart page
app.get("/test-cart", (req, res) => {
    res.sendFile(path.join(__dirname, 'test-cart.html'));
})

// Debug route for session testing
app.get("/debug-session", (req, res) => {
    res.json({
        sessionId: req.session.id,
        sessionData: req.session,
        user: req.user ? { id: req.user._id, email: req.user.email } : null,
        cookies: req.cookies
    });
})

// Test session storage
app.get("/test-session", (req, res) => {
    req.session.testValue = "test-" + Date.now();
    req.session.save((err) => {
        if (err) {
            res.json({ error: "Session save failed", details: err.message });
        } else {
            res.json({ 
                success: true, 
                sessionId: req.session.id,
                testValue: req.session.testValue,
                sessionData: req.session
            });
        }
    });
})

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('pages/error', {
        message: 'Something went wrong!',
        error: config.env === 'development' ? err : {},
        layout: false
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('pages/error', {
        message: 'Page not found',
        error: {},
        layout: false
    });
});

app.listen(config.port, () => {
    console.log(`Server is running in ${config.env} mode on port ${config.port}`);
});
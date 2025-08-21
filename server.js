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
app.use(cors({
    origin: true, // Allow all origins
    credentials: true, // Allow credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Add headers for iframe compatibility - MUST BE BEFORE SESSION MIDDLEWARE
app.use((req, res, next) => {
    // Remove any existing X-Frame-Options header
    res.removeHeader('X-Frame-Options');
    
    // Set permissive Content-Security-Policy for iframe embedding
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
    
    // Set X-Frame-Options to allow all embedding
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    
    // Additional headers for iframe compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    next();
});

// Iframe detection and handling middleware
app.use((req, res, next) => {
    // Check if request is coming from an iframe
    const isIframe = req.headers['sec-fetch-dest'] === 'iframe' || 
                     req.headers['x-frame-options'] === 'iframe' ||
                     req.query.iframe === 'true' ||
                     req.headers['referer'] && req.headers['referer'].includes('iframe');
    
    // Set iframe-specific headers
    if (isIframe) {
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Add iframe flag to response locals
        res.locals.isIframe = true;
        
        // Log iframe request for debugging
        console.log(`[IFRAME] Request from iframe: ${req.path} - Origin: ${req.headers['origin'] || 'unknown'}`);
    }
    
    next();
});
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
        httpOnly: false, // Allow JavaScript access for iframe scenarios
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'none', // Allow cross-site cookies for iframe
        domain: undefined // Let the browser set the domain
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

// Add a route to manually clear home page cache
app.post('/clear-cache', (req, res) => {
    try {
        const homeController = require('./controllers/homeController');
        if (homeController.cache) {
            homeController.cache.clear();
            console.log('Home page cache cleared via root route');
        }
        res.json({ success: true, message: 'Home page cache cleared successfully' });
    } catch (error) {
        console.error('Error clearing home page cache:', error);
        res.status(500).json({ success: false, message: 'Error clearing cache' });
    }
});

// Debug route to check discount status
app.get('/debug-discounts', async (req, res) => {
    try {
        const Product = require('./models/Products');
        const products = await Product.find({ hasDiscount: true }).select('name price originalPrice hasDiscount discountPercentage discountEndDate');
        
        res.json({
            timestamp: new Date().toISOString(),
            totalProducts: await Product.countDocuments(),
            discountedProducts: products.length,
            products: products
        });
    } catch (error) {
        console.error('Error in debug route:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test route to check a specific product
app.get('/debug-product/:id', async (req, res) => {
    try {
        const Product = require('./models/Products');
        const product = await Product.findById(req.params.id).select('name price originalPrice hasDiscount discountPercentage discountStartDate discountEndDate');
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({
            timestamp: new Date().toISOString(),
            product: product
        });
    } catch (error) {
        console.error('Error in debug product route:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual trigger for discount validation
app.post('/validate-discounts', async (req, res) => {
    try {
        const DiscountController = require('./controllers/discountController');
        await DiscountController.validateDiscounts();
        
        // Clear home cache after validation
        const homeController = require('./controllers/homeController');
        if (homeController.cache) {
            homeController.cache.clear();
        }
        
        res.json({ success: true, message: 'Discount validation completed and cache cleared' });
    } catch (error) {
        console.error('Error in manual discount validation:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check what discounts are expired
app.get('/check-expired-discounts', async (req, res) => {
    try {
        const Product = require('./models/Products');
        const now = new Date();
        
        const expiredDiscounts = await Product.find({ 
            hasDiscount: true,
            discountEndDate: { $lt: now }
        }).select('name price originalPrice hasDiscount discountPercentage discountEndDate');
        
        const activeDiscounts = await Product.find({ 
            hasDiscount: true,
            discountEndDate: { $gte: now }
        }).select('name price originalPrice hasDiscount discountPercentage discountEndDate');
        
        res.json({
            timestamp: now.toISOString(),
            expiredCount: expiredDiscounts.length,
            activeCount: activeDiscounts.length,
            expired: expiredDiscounts,
            active: activeDiscounts
        });
    } catch (error) {
        console.error('Error checking expired discounts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test route to check a specific product's discount status
app.get('/test-product/:id', async (req, res) => {
    try {
        const Product = require('./models/Products');
        const product = await Product.findById(req.params.id).select('name price originalPrice hasDiscount discountPercentage discountStartDate discountEndDate');
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({
            timestamp: new Date().toISOString(),
            product: product,
            hasDiscount: product.hasDiscount,
            price: product.price,
            originalPrice: product.originalPrice,
            discountPercentage: product.discountPercentage
        });
    } catch (error) {
        console.error('Error checking product:', error);
        res.status(500).json({ error: error.message });
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
const discountRoutes = require('./routes/discount');

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
app.use('/api/discounts', discountRoutes);

app.get("/login" , (req,res)=>{
    // Preserve intended destination for both login and subsequent signup
    if (req.query.redirect) {
        req.session.returnTo = req.query.redirect;
    }
    res.render("pages/login", { layout: false })
})
app.get("/signup" , (req,res)=>{
    // If redirect is passed directly to signup, store it as well
    if (req.query.redirect) {
        req.session.returnTo = req.query.redirect;
    }
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

// Test admin access
app.get("/test-admin", (req, res) => {
    res.json({
        user: req.user ? { id: req.user._id, email: req.user.email, role: req.user.role } : null,
        isAdmin: req.user?.role === 'admin',
        session: req.session,
        cookies: req.cookies
    });
})

// Test admin view rendering
app.get("/test-admin-view", (req, res) => {
    try {
        res.render('pages/Admin/dashboard', {
            title: 'Test Dashboard',
            stats: {
                totalUsers: 0,
                totalProducts: 0,
                monthlyRevenue: 0,
                annualRevenue: 0
            },
            layout: 'layouts/admin'
        });
    } catch (error) {
        res.json({
            error: 'View rendering failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
})

// Test iframe functionality
app.get("/test-iframe", (req, res) => {
    // Ensure iframe headers are set for this test route
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.json({
        success: true,
        message: 'Iframe test successful',
        timestamp: new Date().toISOString(),
        headers: req.headers,
        isIframe: req.headers['sec-fetch-dest'] === 'iframe',
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        iframeHeaders: {
            xFrameOptions: res.getHeader('X-Frame-Options'),
            contentSecurityPolicy: res.getHeader('Content-Security-Policy'),
            accessControlAllowOrigin: res.getHeader('Access-Control-Allow-Origin')
        }
    });
});

// Iframe health check
app.get("/iframe-health", (req, res) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.json({
        status: 'healthy',
        iframe: 'enabled',
        timestamp: new Date().toISOString(),
        cors: 'enabled',
        session: 'enabled'
    });
});

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

// Start discount validation cron job
const DiscountController = require('./controllers/discountController');

// Validate discounts every 5 minutes for better performance
setInterval(async () => {
    try {
        await DiscountController.validateDiscounts();
    } catch (error) {
        console.error('Error in discount validation cron job:', error);
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Test discount validation on startup
setTimeout(async () => {
    try {
        console.log('🧪 Running initial discount validation test...');
        await DiscountController.validateDiscounts();
        console.log('✅ Initial discount validation test completed');
    } catch (error) {
        console.error('❌ Initial discount validation test failed:', error);
    }
}, 5000); // Run after 5 seconds

app.listen(config.port, () => {
    console.log(`Server is running in ${config.env} mode on port ${config.port}`);
    console.log('Discount validation cron job started (runs every 5 minutes)');
});
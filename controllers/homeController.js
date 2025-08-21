const Product = require("../models/Products");
const Category = require("../models/Category");
const mongoose = require("mongoose");

// Constants for limits
const LIMITS = {
  FEATURED_PRODUCTS: 8,
  MAIN_CATEGORIES: 6,
  NEW_ARRIVALS: 3,
  BEST_SELLERS: 3
};

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Helper function to map category names to icon classes
const getCategoryIconClass = (categoryName) => {
  if (!categoryName) return 'default';
  
  const name = categoryName.toLowerCase().trim();
  
  // Map specific category names to icon classes
  if (name.includes('headphone') || name.includes('earphone') || name.includes('audio')) {
    return 'headphones';
  }
  if (name.includes('mobile') || name.includes('phone') || name.includes('smartphone')) {
    return 'mobile-alt';
  }
  if (name.includes('tv') || name.includes('television') || name.includes('display')) {
    return 'tv';
  }
  if (name.includes('laptop') || name.includes('computer') || name.includes('pc')) {
    return 'laptop';
  }
  if (name.includes('tablet') || name.includes('ipad')) {
    return 'tablet-alt';
  }
  if (name.includes('camera') || name.includes('photo')) {
    return 'camera';
  }
  if (name.includes('gaming') || name.includes('game')) {
    return 'gamepad';
  }
  if (name.includes('accessory') || name.includes('accessories')) {
    return 'puzzle-piece';
  }
  if (name.includes('wearable') || name.includes('watch') || name.includes('fitness')) {
    return 'clock';
  }
  
  // Default icon class for unmapped categories
  return 'box';
};

// Simple cache object
const cache = {
  data: null,
  timestamp: null,
  isValid: function() {
    return this.data && this.timestamp && 
           (Date.now() - this.timestamp) < CACHE_DURATION;
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

// Simple logger
const logger = {
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
  info: (message, data = {}) => {
    console.log(`[INFO] ${message}`, data);
  },
  error: (message, error = {}) => {
    console.error(`[ERROR] ${message}`, error);
  }
};

// Fallback data
const getFallbackData = () => ({
  featuredProducts: [],
  mainCategories: [],
  newArrivals: [],
  bestSellers: []
});

exports.getHomePage = async (req, res) => {
  try {
    logger.debug('Home page request received');

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      logger.error('Database connection not ready', { 
        state: mongoose.connection.readyState 
      });
      throw new Error("Database connection not ready. Please try again in a few moments.");
    }

    // Check cache first
    if (cache.isValid()) {
      logger.debug('Serving home page from cache');
      return res.render("pages/Home/home", {
        title: "Homepage",
        ...cache.get(),
        error: null,
      });
    }

    logger.debug('Fetching fresh home page data');

    // Fetch data with individual error handling for each query
    const [featuredProducts, mainCategories, newArrivals, bestSellers] = await Promise.allSettled([
      Product.find({ featured: true })
        .populate("category")
        .limit(LIMITS.FEATURED_PRODUCTS)
        .lean(),
      Category.find({ parent: null })
        .limit(LIMITS.MAIN_CATEGORIES)
        .lean(),
      Product.find()
        .populate("category")
        .sort({ createdAt: -1 })
        .limit(LIMITS.NEW_ARRIVALS)
        .lean(),
      Product.aggregate([
        {
          $lookup: {
            from: 'orderitems',
            localField: '_id',
            foreignField: 'product',
            as: 'orderItems'
          }
        },
        {
          $addFields: {
            totalOrders: { $size: '$orderItems' }
          }
        },
        {
          $sort: { totalOrders: -1 }
        },
        {
          $limit: LIMITS.BEST_SELLERS
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category'
          }
        },
        {
          $unwind: '$category'
        }
      ])
    ]);

    // Handle individual query results and add iconClass to categories
    const homeData = {
      featuredProducts: featuredProducts.status === 'fulfilled' ? featuredProducts.value : [],
      mainCategories: mainCategories.status === 'fulfilled' ? 
        mainCategories.value.map(category => ({
          ...category,
          iconClass: getCategoryIconClass(category.name)
        })) : [],
      newArrivals: newArrivals.status === 'fulfilled' ? newArrivals.value : [],
      bestSellers: bestSellers.status === 'fulfilled' ? bestSellers.value : []
    };

    // Log any failed queries
    if (featuredProducts.status === 'rejected') {
      logger.error('Failed to fetch featured products', featuredProducts.reason);
    }
    if (mainCategories.status === 'rejected') {
      logger.error('Failed to fetch main categories', mainCategories.reason);
    }
    if (newArrivals.status === 'rejected') {
      logger.error('Failed to fetch new arrivals', newArrivals.reason);
    }
    if (bestSellers.status === 'rejected') {
      logger.error('Failed to fetch best sellers', bestSellers.reason);
    }

    logger.debug('Home page data fetched', {
      featuredProductsCount: homeData.featuredProducts.length,
      categoriesCount: homeData.mainCategories.length,
      newArrivalsCount: homeData.newArrivals.length,
      bestSellersCount: homeData.bestSellers.length
    });

    // Cache the successful data
    cache.set(homeData);

    res.render("pages/Home/home", {
      title: "Homepage",
      ...homeData,
      error: null,
    });
  } catch (error) {
    logger.error('Home page error', error);
    
    // Try to serve cached data if available
    if (cache.isValid()) {
      logger.debug('Serving cached data due to error');
      return res.render("pages/Home/home", {
        title: "Homepage",
        ...cache.get(),
        error: "Some data may be outdated due to a temporary issue.",
      });
    }

    // Serve fallback data
    logger.debug('Serving fallback data');
    res.render("pages/Home/home", {
      title: "Homepage",
      ...getFallbackData(),
      error: "Unable to load content at the moment. Please try again in a few moments.",
    });
  }
};

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

// Cache duration in milliseconds (tiered caching for better performance)
const CACHE_DURATION = {
    FEATURED_PRODUCTS: 2 * 60 * 1000,    // 2 minutes
    MAIN_CATEGORIES: 30 * 60 * 1000,     // 30 minutes (rarely change)
    NEW_ARRIVALS: 2 * 60 * 1000,         // 2 minutes
    BEST_SELLERS: 60 * 60 * 1000         // 1 hour (expensive query)
};

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

// Helper function to check for active discounts
const checkForActiveDiscounts = async () => {
  try {
    const now = new Date();
    const activeDiscounts = await Product.countDocuments({
      hasDiscount: true,
      discountStartDate: { $lte: now },
      discountEndDate: { $gt: now }
    });
    return activeDiscounts > 0;
  } catch (error) {
    console.error('Error checking for active discounts:', error);
    return false;
  }
};

// Tiered cache object for better performance
const cache = {
    data: {
        featuredProducts: null,
        mainCategories: null,
        newArrivals: null,
        bestSellers: null
    },
    timestamps: {
        featuredProducts: null,
        mainCategories: null,
        newArrivals: null,
        bestSellers: null
    },
    isValid: function(key) {
        if (!key || !CACHE_DURATION[key.toUpperCase()]) {
            return false;
        }
        const duration = CACHE_DURATION[key.toUpperCase()];
        return this.data[key] && this.timestamps[key] && 
               (Date.now() - this.timestamps[key]) < duration;
    },
    set: function(key, data) {
        this.data[key] = data;
        this.timestamps[key] = Date.now();
    },
    get: function(key) {
        return this.data[key];
    },
    clear: function(key = null) {
        if (key) {
            this.data[key] = null;
            this.timestamps[key] = null;
        } else {
            // Clear all
            Object.keys(this.data).forEach(k => {
                this.data[k] = null;
                this.timestamps[k] = null;
            });
        }
    }
};

// Export cache for external access
module.exports.cache = cache;

// Method to warm up cache with fresh data
module.exports.warmCache = async () => {
    try {
        console.log('🔥 Warming up home page cache...');
        
        // Fetch fresh data
        const [featuredProducts, mainCategories, newArrivals, bestSellers] = await Promise.allSettled([
            Product.find({ featured: true })
                .populate("category")
                .select('name description price imageUrl category hasDiscount discountPercentage originalPrice createdAt')
                .limit(LIMITS.FEATURED_PRODUCTS)
                .lean(),
            Category.find({ parent: null })
                .limit(LIMITS.MAIN_CATEGORIES)
                .lean(),
            Product.find()
                .populate("category")
                .select('name description price imageUrl category hasDiscount discountPercentage originalPrice createdAt')
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
                },
                {
                    $project: {
                        name: 1,
                        description: 1,
                        price: 1,
                        imageUrl: 1,
                        category: 1,
                        hasDiscount: 1,
                        discountPercentage: 1,
                        originalPrice: 1,
                        totalOrders: 1
                    }
                }
            ])
        ]);

        // Update cache with fresh data using tiered approach
        if (featuredProducts.status === 'fulfilled') {
            cache.set('featuredProducts', featuredProducts.value);
        }
        if (mainCategories.status === 'fulfilled') {
            cache.set('mainCategories', mainCategories.value.map(category => ({
                ...category,
                iconClass: category.iconClass || getCategoryIconClass(category.name)
            })));
        }
        if (newArrivals.status === 'fulfilled') {
            cache.set('newArrivals', newArrivals.value);
        }
        if (bestSellers.status === 'fulfilled') {
            cache.set('bestSellers', bestSellers.value);
        }
        
        console.log('✅ Home page cache warmed up successfully with tiered caching');
        
        // Check if there are active discounts for the banner
        const hasActiveDiscounts = await checkForActiveDiscounts();
        
        return { 
            featuredProducts: featuredProducts.status === 'fulfilled' ? featuredProducts.value : [],
            mainCategories: mainCategories.status === 'fulfilled' ? 
                mainCategories.value.map(category => ({
                    ...category,
                    iconClass: category.iconClass || getCategoryIconClass(category.name)
                })) : [],
            newArrivals: newArrivals.status === 'fulfilled' ? newArrivals.value : [],
            bestSellers: bestSellers.status === 'fulfilled' ? bestSellers.value : [],
            hasActiveDiscounts 
        };
    } catch (error) {
        console.error('❌ Error warming up cache:', error);
        return null;
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

    // Check if force refresh is requested
    const forceRefresh = req.query.refresh === 'true' || req.query.bypass === 'true';
    
    console.log('🔄 Home page request:', {
      forceRefresh,
      cacheValid: cache.isValid('featuredProducts') && cache.isValid('mainCategories') && 
                  cache.isValid('newArrivals') && cache.isValid('bestSellers'),
      cacheData: 'tiered',
      query: req.query
    });
    
    // Check cache first (unless force refresh is requested)
    if (!forceRefresh && cache.isValid('featuredProducts') && cache.isValid('mainCategories') && 
        cache.isValid('newArrivals') && cache.isValid('bestSellers')) {
      logger.debug('Serving home page from cache');
      console.log('📦 Serving from tiered cache');
      
      // Check if there are active discounts for the banner
      const hasActiveDiscounts = await checkForActiveDiscounts();
      
      return res.render("pages/Home/home", {
        title: "Homepage",
        featuredProducts: cache.get('featuredProducts'),
        mainCategories: cache.get('mainCategories'),
        newArrivals: cache.get('newArrivals'),
        bestSellers: cache.get('bestSellers'),
        hasActiveDiscounts,
        error: null,
      });
    }

    logger.debug('Fetching fresh home page data');

    // Check if there are any products in the database
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);
    
    if (totalProducts === 0) {
      console.warn('⚠️ No products found in database');
      return res.render("pages/Home/home", {
        title: "Homepage",
        featuredProducts: [],
        mainCategories: [],
        newArrivals: [],
        bestSellers: [],
        hasActiveDiscounts: false,
        error: "No products available at the moment.",
      });
    }

    // Fetch data with individual error handling for each query
    const [featuredProducts, mainCategories, newArrivals, bestSellers] = await Promise.allSettled([
      Product.find({ featured: true })
        .populate("category")
        .select('name description price imageUrl category hasDiscount discountPercentage originalPrice createdAt')
        .limit(LIMITS.FEATURED_PRODUCTS)
        .lean(),
      Category.find({ parent: null })
        .limit(LIMITS.MAIN_CATEGORIES)
        .lean(),
      Product.find()
        .populate("category")
        .select('name description price imageUrl category hasDiscount discountPercentage originalPrice createdAt')
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
        },
        {
          $project: {
            name: 1,
            description: 1,
            price: 1,
            imageUrl: 1,
            category: 1,
            hasDiscount: 1,
            discountPercentage: 1,
            originalPrice: 1,
            totalOrders: 1
          }
        }
      ])
    ]);

    // Debug raw query results
    console.log('🔍 Raw query results:', {
      featuredProducts: featuredProducts.status === 'fulfilled' ? featuredProducts.value.length : 'rejected',
      mainCategories: mainCategories.status === 'fulfilled' ? mainCategories.value.length : 'rejected',
      newArrivals: newArrivals.status === 'fulfilled' ? newArrivals.value.length : 'rejected',
      bestSellers: bestSellers.status === 'fulfilled' ? bestSellers.value.length : 'rejected'
    });

    // Debug any rejected queries
    if (featuredProducts.status === 'rejected') {
      console.error('❌ Featured products query failed:', featuredProducts.reason);
    }
    if (mainCategories.status === 'rejected') {
      console.error('❌ Main categories query failed:', mainCategories.reason);
    }
    if (newArrivals.status === 'rejected') {
      console.error('❌ New arrivals query failed:', newArrivals.reason);
    }
    if (bestSellers.status === 'rejected') {
      console.error('❌ Best sellers query failed:', bestSellers.reason);
    }

    if (newArrivals.status === 'fulfilled' && newArrivals.value.length > 0) {
      console.log('🔍 Raw New Arrivals from DB:', newArrivals.value[0]);
    }

    if (bestSellers.status === 'fulfilled' && bestSellers.value.length > 0) {
      console.log('🔍 Raw Best Sellers from DB:', bestSellers.value[0]);
    }

    // Handle individual query results and add iconClass to categories
    const homeData = {
      featuredProducts: featuredProducts.status === 'fulfilled' ? featuredProducts.value : [],
      mainCategories: mainCategories.status === 'fulfilled' ? 
        mainCategories.value.map(category => ({
          ...category,
          iconClass: category.iconClass || getCategoryIconClass(category.name)
        })) : [],
      newArrivals: newArrivals.status === 'fulfilled' ? newArrivals.value : [],
      bestSellers: bestSellers.status === 'fulfilled' ? bestSellers.value : []
    };

    // Debug discount data
    if (homeData.newArrivals.length > 0) {
      logger.debug('New Arrivals discount data:', homeData.newArrivals.map(p => ({
        name: p.name,
        hasDiscount: p.hasDiscount,
        price: p.price,
        originalPrice: p.originalPrice,
        discountPercentage: p.discountPercentage
      })));
      
      // Log raw data for debugging
      console.log('🔍 Raw New Arrivals data:', homeData.newArrivals);
    }
    
    if (homeData.bestSellers.length > 0) {
      logger.debug('Best Sellers discount data:', homeData.bestSellers.map(p => ({
        name: p.name,
        hasDiscount: p.hasDiscount,
        price: p.price,
        originalPrice: p.originalPrice,
        discountPercentage: p.discountPercentage
      })));
      
      // Log raw data for debugging
      console.log('🔍 Raw Best Sellers data:', homeData.bestSellers);
    }

    // Additional debugging for template data
    logger.debug('Final home data structure:', {
      newArrivalsCount: homeData.newArrivals.length,
      bestSellersCount: homeData.bestSellers.length,
      sampleNewArrival: homeData.newArrivals[0] ? {
        name: homeData.newArrivals[0].name,
        hasDiscount: homeData.newArrivals[0].hasDiscount,
        price: homeData.newArrivals[0].price,
        originalPrice: homeData.newArrivals[0].originalPrice,
        discountPercentage: homeData.newArrivals[0].discountPercentage
      } : null,
      sampleBestSeller: homeData.bestSellers[0] ? {
        name: homeData.bestSellers[0].name,
        hasDiscount: homeData.bestSellers[0].hasDiscount,
        price: homeData.bestSellers[0].price,
        originalPrice: homeData.bestSellers[0].originalPrice,
        discountPercentage: homeData.bestSellers[0].discountPercentage
      } : null
    });

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

    // Cache the successful data using tiered approach
    cache.set('featuredProducts', homeData.featuredProducts);
    cache.set('mainCategories', homeData.mainCategories);
    cache.set('newArrivals', homeData.newArrivals);
    cache.set('bestSellers', homeData.bestSellers);
    
    console.log('💾 Fresh data cached with tiered approach:', {
      newArrivalsCount: homeData.newArrivals.length,
      bestSellersCount: homeData.bestSellers.length,
      cacheTimestamp: new Date().toISOString()
    });

    // Check if there are active discounts for the banner
    const hasActiveDiscounts = await checkForActiveDiscounts();

    res.render("pages/Home/home", {
      title: "Homepage",
      ...homeData,
      hasActiveDiscounts,
      error: null,
    });
  } catch (error) {
    logger.error('Home page error', error);
    
    // Try to serve cached data if available
    if (cache.isValid('featuredProducts') || cache.isValid('mainCategories') || 
        cache.isValid('newArrivals') || cache.isValid('bestSellers')) {
      logger.debug('Serving partial cached data due to error');
      
      // Check if there are active discounts for the banner
      const hasActiveDiscounts = await checkForActiveDiscounts();
      
      return res.render("pages/Home/home", {
        title: "Homepage",
        featuredProducts: cache.get('featuredProducts') || [],
        mainCategories: cache.get('mainCategories') || [],
        newArrivals: cache.get('newArrivals') || [],
        bestSellers: cache.get('bestSellers') || [],
        hasActiveDiscounts,
        error: "Some data may be outdated due to a temporary issue.",
      });
    }

    // Serve fallback data
    logger.debug('Serving fallback data');
    
    // Check if there are active discounts for the banner
    const hasActiveDiscounts = await checkForActiveDiscounts();
    
    res.render("pages/Home/home", {
      title: "Homepage",
      ...getFallbackData(),
      hasActiveDiscounts,
      error: "Unable to load content at the moment. Please try again in a few moments.",
    });
  }
};

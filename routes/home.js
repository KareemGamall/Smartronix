const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

router.get('/', homeController.getHomePage);

// Route to clear home page cache (for discount operations)
router.post('/clear-cache', (req, res) => {
    try {
        // Clear the cache
        const cache = require('../controllers/homeController').cache;
        if (cache) {
            cache.clear();
            console.log('Home page cache cleared via API');
        }
        res.json({ success: true, message: 'Cache cleared successfully' });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ success: false, error: 'Failed to clear cache' });
    }
});

// Route to force refresh home page
router.get('/refresh', (req, res) => {
    try {
        // Clear the cache
        const cache = require('../controllers/homeController').cache;
        if (cache) {
            cache.clear();
            console.log('Home page cache cleared for force refresh');
        }
        // Redirect to home page with force refresh
        res.redirect('/?refresh=true');
    } catch (error) {
        console.error('Error force refreshing:', error);
        res.status(500).json({ success: false, error: 'Failed to force refresh' });
    }
});

// Route to check cache status
router.get('/cache-status', (req, res) => {
    try {
        const cache = require('../controllers/homeController').cache;
        if (cache) {
            res.json({
                success: true,
                cacheExists: {
                    featuredProducts: !!cache.get('featuredProducts'),
                    mainCategories: !!cache.get('mainCategories'),
                    newArrivals: !!cache.get('newArrivals'),
                    bestSellers: !!cache.get('bestSellers')
                },
                cacheValid: {
                    featuredProducts: cache.isValid('featuredProducts'),
                    mainCategories: cache.isValid('mainCategories'),
                    newArrivals: cache.isValid('newArrivals'),
                    bestSellers: cache.isValid('bestSellers')
                },
                cacheTimestamps: {
                    featuredProducts: cache.get('featuredProducts') ? new Date(cache.timestamps.featuredProducts).toISOString() : null,
                    mainCategories: cache.get('mainCategories') ? new Date(cache.timestamps.mainCategories).toISOString() : null,
                    newArrivals: cache.get('newArrivals') ? new Date(cache.timestamps.newArrivals).toISOString() : null,
                    bestSellers: cache.get('bestSellers') ? new Date(cache.timestamps.bestSellers).toISOString() : null
                }
            });
        } else {
            res.json({ success: false, error: 'Cache not found' });
        }
    } catch (error) {
        console.error('Error checking cache status:', error);
        res.status(500).json({ success: false, error: 'Failed to check cache status' });
    }
});

// Route to warm up cache
router.post('/warm-cache', async (req, res) => {
    try {
        const homeController = require('../controllers/homeController');
        if (homeController.warmCache) {
            const result = await homeController.warmCache();
            if (result) {
                res.json({ success: true, message: 'Cache warmed up successfully' });
            } else {
                res.status(500).json({ success: false, error: 'Failed to warm up cache' });
            }
        } else {
            res.status(500).json({ success: false, error: 'Cache warming not available' });
        }
    } catch (error) {
        console.error('Error warming up cache:', error);
        res.status(500).json({ success: false, error: 'Failed to warm up cache' });
    }
});

module.exports = router;
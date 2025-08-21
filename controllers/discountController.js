const Product = require('../models/Products');

class DiscountController {
    // Get all discounts
    static async getDiscounts(req, res) {
        try {
            const products = await Product.find({ hasDiscount: true })
                .populate('category')
                .select('name price originalPrice discountPercentage discountStartDate discountEndDate hasDiscount');
            
            res.json(products);
        } catch (error) {
            console.error('Error fetching discounts:', error);
            res.status(500).json({ error: 'Failed to fetch discounts' });
        }
    }

    // Add discount to a product
    static async addDiscount(req, res) {
        try {
            const { productId, discountPercentage, startDate, endDate, active } = req.body;
            
            console.log('📥 Received discount request:', {
                productId,
                discountPercentage,
                startDate,
                endDate,
                active,
                activeType: typeof active,
                body: req.body
            });

            // Validate input
            if (!productId || !discountPercentage || !startDate || !endDate) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            if (discountPercentage < 1 || discountPercentage > 99) {
                return res.status(400).json({ error: 'Discount percentage must be between 1 and 99' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Calculate discount
            const originalPrice = product.price;
            const discountAmount = (originalPrice * discountPercentage) / 100;
            const finalPrice = Math.round((originalPrice - discountAmount) * 10) / 10; // Round to 1 decimal place

            // Update product with discount
            product.hasDiscount = active;
            product.discountPercentage = discountPercentage;
            product.discountStartDate = new Date(startDate);
            product.discountEndDate = new Date(endDate);
            product.originalPrice = originalPrice;
            product.price = finalPrice;

            console.log('🔄 Updating product with discount:', {
                productId: product._id,
                name: product.name,
                hasDiscount: product.hasDiscount,
                discountPercentage: product.discountPercentage,
                originalPrice: product.originalPrice,
                finalPrice: product.price,
                startDate: product.discountStartDate,
                endDate: product.discountEndDate
            });

            await product.save();

            console.log('✅ Product saved successfully. Final state:', {
                productId: product._id,
                name: product.name,
                hasDiscount: product.hasDiscount,
                discountPercentage: product.discountPercentage,
                originalPrice: product.originalPrice,
                price: product.price,
                startDate: product.discountStartDate,
                endDate: product.discountEndDate
            });

            res.json({ 
                message: 'Discount added successfully',
                product: {
                    id: product._id,
                    name: product.name,
                    originalPrice: product.originalPrice,
                    discountPercentage: product.discountPercentage,
                    finalPrice: product.price,
                    startDate: product.discountStartDate,
                    endDate: product.discountEndDate,
                    active: product.hasDiscount
                }
            });

            // Clear homepage cache after changes
            try {
                const homeController = require('./homeController');
                if (homeController.warmCache) {
                    await homeController.warmCache();
                    console.log('🏠 Home cache warmed up after adding discount');
                } else if (homeController.cache) {
                    homeController.cache.clear();
                    console.log('🏠 Home cache cleared after adding discount');
                }
            } catch (e) {
                console.warn('Could not warm up home cache after adding discount:', e.message);
            }

        } catch (error) {
            console.error('Error adding discount:', error);
            res.status(500).json({ error: 'Failed to add discount' });
        }
    }

    // Update discount
    static async updateDiscount(req, res) {
        try {
            const { productId, discountPercentage, startDate, endDate, active } = req.body;

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            if (!product.hasDiscount) {
                return res.status(400).json({ error: 'Product has no discount to update' });
            }

            // Update discount fields
            if (discountPercentage) {
                product.discountPercentage = discountPercentage;
                const discountAmount = (product.originalPrice * discountPercentage) / 100;
                product.price = Math.round((product.originalPrice - discountAmount) * 10) / 10; // Round to 1 decimal place
            }

            if (startDate) product.discountStartDate = new Date(startDate);
            if (endDate) product.discountEndDate = new Date(endDate);
            if (active !== undefined) product.hasDiscount = active;

            await product.save();

            res.json({ 
                message: 'Discount updated successfully',
                product: {
                    id: product._id,
                    name: product.name,
                    originalPrice: product.originalPrice,
                    discountPercentage: product.discountPercentage,
                    finalPrice: product.price,
                    startDate: product.discountStartDate,
                    endDate: product.discountEndDate,
                    active: product.hasDiscount
                }
            });

            // Clear homepage cache after changes
            try {
                const homeController = require('./homeController');
                if (homeController.warmCache) {
                    await homeController.warmCache();
                    console.log('🏠 Home cache warmed up after updating discount');
                } else if (homeController.cache) {
                    homeController.cache.clear();
                    console.log('🏠 Home cache cleared after updating discount');
                }
            } catch (e) {
                console.warn('Could not warm up home cache after updating discount:', e.message);
            }

        } catch (error) {
            console.error('Error updating discount:', error);
            res.status(500).json({ error: 'Failed to update discount' });
        }
    }

    // Remove discount from a product
    static async removeDiscount(req, res) {
        try {
            const { productId } = req.params;

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            if (!product.hasDiscount) {
                return res.status(400).json({ error: 'Product has no discount to remove' });
            }

            // Restore original price and remove discount fields
            const originalPrice = product.originalPrice || product.price;
            product.price = originalPrice;
            product.hasDiscount = false;
            product.discountPercentage = 0;
            product.discountStartDate = null;
            product.discountEndDate = null;
            product.originalPrice = null;

            await product.save();

            res.json({ 
                message: 'Discount removed successfully',
                product: {
                    id: product._id,
                    name: product.name,
                    price: product.price
                }
            });

            // Clear homepage cache after changes
            try {
                const homeController = require('./homeController');
                if (homeController.warmCache) {
                    await homeController.warmCache();
                    console.log('🏠 Home cache warmed up after removing discount');
                } else if (homeController.cache) {
                    homeController.cache.clear();
                    console.log('🏠 Home cache cleared after removing discount');
                }
            } catch (e) {
                console.warn('Could not warm up home cache after removing discount:', e.message);
            }

        } catch (error) {
            console.error('Error removing discount:', error);
            res.status(500).json({ error: 'Failed to remove discount' });
        }
    }

    // Get products eligible for discount
    static async getEligibleProducts(req, res) {
        try {
            const products = await Product.find({ hasDiscount: false })
                .populate('category')
                .select('name price category');
            
            res.json(products);
        } catch (error) {
            console.error('Error fetching eligible products:', error);
            res.status(500).json({ error: 'Failed to fetch eligible products' });
        }
    }

    // Check if discount is still valid
    static async validateDiscounts() {
        try {
            const now = new Date();
            
            const products = await Product.find({ 
                hasDiscount: true,
                discountEndDate: { $lt: now }
            });
            
            // Only log if there are expired discounts to process
            if (products.length > 0) {
                console.log(`🔍 Found ${products.length} expired discounts to process at ${now.toISOString()}`);
            }
            
            let cacheCleared = false;
            
            for (const product of products) {
                console.log(`🔄 Processing expired discount for product: ${product.name} (ID: ${product._id})`);
                console.log(`   - Current price: $${product.price}`);
                console.log(`   - Original price: $${product.originalPrice}`);
                console.log(`   - End date: ${product.discountEndDate}`);
                
                product.hasDiscount = false;
                product.price = product.originalPrice || product.price;
                product.discountPercentage = 0;
                product.discountStartDate = null;
                product.discountEndDate = null;
                product.originalPrice = null;
                
                await product.save();
                console.log(`✅ Restored product ${product.name} to original price: $${product.price}`);
                
                // Clear home cache immediately after each product update
                if (!cacheCleared) {
                    try {
                        const homeController = require('./homeController');
                        if (homeController.warmCache) {
                            await homeController.warmCache();
                            console.log('🏠 Home cache warmed up after discount expiry');
                            cacheCleared = true;
                        } else if (homeController.cache) {
                            homeController.cache.clear();
                            console.log('🏠 Home cache cleared after discount expiry');
                            cacheCleared = true;
                        }
                    } catch (e) {
                        console.warn('Could not warm up home cache after discount expiry:', e.message);
                    }
                }
            }

            // Only log completion if we processed discounts
            if (products.length > 0) {
                console.log(`🎯 Discount validation complete. Processed ${products.length} expired discounts`);
            }
        } catch (error) {
            console.error('❌ Error validating discounts:', error);
        }
    }
}

module.exports = DiscountController;

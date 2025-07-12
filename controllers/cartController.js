const Cart = require('../models/Cart');
const Product = require('../models/Products');

const DELIVERY_FEE = 50;

const formatPrice = (price) => Number(price.toFixed(2));

// Simple logger with levels
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

const createCartResponse = (cart) => ({
  ...cart.toObject(),
  deliveryFee: DELIVERY_FEE,
  grandTotal: formatPrice(cart.totalAmount + DELIVERY_FEE)
});

const handleEmptyCart = () => ({
  items: [],
  totalAmount: 0,
  deliveryFee: DELIVERY_FEE,
  grandTotal: formatPrice(DELIVERY_FEE)
});

class CartHelper {
  static async findUserCart(req) {
    logger.debug('Finding user cart', {
      sessionId: req.session.id,
      cartId: req.session.cartId,
      userId: req.user?._id
    });
    
    // First try to find cart by user ID (for logged in users)
    if (req.user?._id) {
      const userCart = await Cart.findOne({ user: req.user._id });
      if (userCart) {
        logger.debug('Found user cart', { cartId: userCart._id });
        return userCart;
      }
    }
    
    // Then try to find cart by session cartId (most reliable)
    if (req.session.cartId) {
      const cartById = await Cart.findById(req.session.cartId);
      if (cartById) {
        logger.debug('Found cart by session cartId', { cartId: cartById._id });
        return cartById;
      }
    }
    
    // Finally try to find cart by session ID (fallback)
    if (req.session.id) {
      const sessionCart = await Cart.findOne({ 
        sessionId: req.session.id,
        user: null 
      });
      
      if (sessionCart) {
        logger.debug('Found session cart', { cartId: sessionCart._id });
        return sessionCart;
      }
    }
    
    logger.debug('No cart found for user or session');
    return null;
  }

  static async findUserCartWithProducts(req) {
    logger.debug('Finding user cart with products', {
      sessionId: req.session.id,
      cartId: req.session.cartId,
      userId: req.user?._id
    });
    
    // First try to find cart by user ID (for logged in users)
    if (req.user?._id) {
      const userCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
      if (userCart) {
        logger.debug('Found user cart with products', { 
          cartId: userCart._id,
          itemsCount: userCart.items.length 
        });
        return userCart;
      }
    }
    
    // Then try to find cart by session cartId (most reliable)
    if (req.session.cartId) {
      const cartById = await Cart.findById(req.session.cartId).populate('items.product');
      if (cartById) {
        logger.debug('Found cart by session cartId with products', { 
          cartId: cartById._id,
          itemsCount: cartById.items.length 
        });
        return cartById;
      }
    }
    
    // Finally try to find cart by session ID (fallback)
    if (req.session.id) {
      const sessionCart = await Cart.findOne({ 
        sessionId: req.session.id,
        user: null 
      }).populate('items.product');
      
      if (sessionCart) {
        logger.debug('Found session cart with products', { 
          cartId: sessionCart._id,
          itemsCount: sessionCart.items.length 
        });
        return sessionCart;
      }
    }
    
    logger.debug('No cart found for user or session');
    return null;
  }

  static createNewCart(req) {
    return new Cart({
      user: req.user?._id || null,
      sessionId: req.session.id,
      items: [],
      totalAmount: 0,
      CartID: Date.now()
    });
  }

  static findCartItem(cart, productId) {
    return cart.items.find(item => {
      const itemProductId = item.product._id ? 
        item.product._id.toString() : 
        item.product.toString();
      return itemProductId === productId;
    });
  }

  static findCartItemIndex(cart, productId) {
    return cart.items.findIndex(item => {
      const itemProductId = item.product._id ? 
        item.product._id.toString() : 
        item.product.toString();
      return itemProductId === productId;
    });
  }

  static updateCartTotals(cart) {
    cart.totalAmount = formatPrice(
      cart.items.reduce((total, item) => total + item.total, 0)
    );
  }

  static async validateProductStock(productId, requestedQuantity, currentQuantity = 0) {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    const totalQuantity = currentQuantity + requestedQuantity;
    if (product.stockQuantity < totalQuantity) {
      throw new Error('Not enough stock available');
    }

    return product;
  }

  // New method to validate quantity input
  static validateQuantity(quantity) {
    const num = Number(quantity);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
      throw new Error('Quantity must be a positive integer');
    }
    return num;
  }
}

const ERROR_MESSAGES = {
    PRODUCT_NOT_FOUND: 'Product not found',
    INSUFFICIENT_STOCK: 'Not enough stock available',
    CART_NOT_FOUND: 'Cart not found',
    ITEM_NOT_FOUND: 'Item not found in cart',
    GENERAL_ERROR: 'An error occurred. Please try again.',
    INVALID_QUANTITY: 'Quantity must be a positive integer',
    MISSING_FIELDS: 'Required fields are missing'
};

// Standard response format
const createResponse = (success, data = null, message = '', error = null) => ({
    success,
    data,
    message,
    error
});

const cartController = {
    async addToCart(req, res) {
        try {
            logger.debug('Adding item to cart', {
                userId: req.user?._id,
                sessionId: req.session.id,
                body: req.body
            });
            
            const { productId, quantity } = req.body;
            
            // Validate required fields
            if (!productId || !quantity) {
                return res.status(400).json(createResponse(
                    false, 
                    null, 
                    '', 
                    ERROR_MESSAGES.MISSING_FIELDS
                ));
            }

            // Validate quantity
            let validatedQuantity;
            try {
                validatedQuantity = CartHelper.validateQuantity(quantity);
            } catch (error) {
                return res.status(400).json(createResponse(
                    false, 
                    null, 
                    '', 
                    error.message
                ));
            }
            
            let cart = await CartHelper.findUserCart(req);
            logger.debug('Cart lookup result', { 
                found: !!cart, 
                cartId: cart?._id 
            });
            
            if (!cart) {
                logger.debug('Creating new cart');
                cart = CartHelper.createNewCart(req);
                
                // Save the cart first
                await cart.save();
                logger.debug('New cart saved', { cartId: cart._id });
                
                // Then save session with cart ID
                req.session.cartId = cart._id.toString();
                req.session.save((err) => {
                    if (err) {
                        logger.error('Error saving session', err);
                    } else {
                        logger.debug('Session saved with cart ID', { cartId: cart._id });
                    }
                });
            }

            const existingItem = CartHelper.findCartItem(cart, productId);
            const currentQuantity = existingItem ? existingItem.quantity : 0;
            
            logger.debug('Item analysis', {
                existingItem: !!existingItem,
                currentQuantity,
                requestedQuantity: validatedQuantity
            });

            const product = await CartHelper.validateProductStock(
                productId, 
                validatedQuantity, 
                currentQuantity
            );
            
            logger.debug('Product validated', { productName: product.name });

            if (existingItem) {
                existingItem.quantity += validatedQuantity;
                existingItem.total = formatPrice(existingItem.quantity * existingItem.price);
                logger.debug('Updated existing item', { newQuantity: existingItem.quantity });
            } else {
                cart.items.push({
                    product: productId,
                    quantity: validatedQuantity,
                    price: formatPrice(product.price),
                    total: formatPrice(product.price * validatedQuantity)
                });
                logger.debug('Added new item to cart');
            }

            CartHelper.updateCartTotals(cart);
            logger.debug('Cart totals updated', { totalAmount: cart.totalAmount });
            
            await cart.save();
            logger.debug('Cart saved successfully');

            const updatedCart = await Cart.findById(cart._id).populate('items.product');
            logger.debug('Final cart state', { itemsCount: updatedCart.items.length });
            
            res.json(createResponse(
                true, 
                updatedCart,
                'Item added to cart successfully'
            ));

        } catch (error) {
            logger.error('Error adding to cart', error);
            
            if (error.message === 'Product not found') {
                return res.status(404).json(createResponse(
                    false, 
                    null, 
                    '', 
                    ERROR_MESSAGES.PRODUCT_NOT_FOUND
                ));
            }
            if (error.message === 'Not enough stock available') {
                return res.status(400).json(createResponse(
                    false, 
                    null, 
                    '', 
                    ERROR_MESSAGES.INSUFFICIENT_STOCK
                ));
            }
            
            res.status(500).json(createResponse(
                false, 
                null, 
                '', 
                ERROR_MESSAGES.GENERAL_ERROR
            ));
        }
    },

    async getCart(req, res) {
        try {
            logger.debug('=== GET CART DEBUG ===');
            logger.debug('User authenticated:', !!req.user);
            logger.debug('User ID:', req.user?._id);
            logger.debug('Session ID:', req.session.id);
            
            const cart = await CartHelper.findUserCartWithProducts(req);
            logger.debug('Cart found:', !!cart);
            logger.debug('Cart ID:', cart?._id);
            logger.debug('Cart items count:', cart?.items?.length || 0);
            
            if (!cart) {
                logger.debug('No cart found, returning empty cart');
                return res.json(handleEmptyCart());
            }

            const response = createCartResponse(cart);
            logger.debug('Sending cart response with items:', response.items?.length || 0);
            res.json(response);

        } catch (error) {
            logger.error('Error getting cart:', error);
            res.status(500).json({ error: ERROR_MESSAGES.GENERAL_ERROR });
        }
    },

    async updateCart(req, res) {
        try {
            const { productId, quantity } = req.body;
            
            const cart = await CartHelper.findUserCart(req);
            if (!cart) {
                return res.status(404).json({ error: ERROR_MESSAGES.CART_NOT_FOUND });
            }

            const itemIndex = CartHelper.findCartItemIndex(cart, productId);
            if (itemIndex === -1) {
                return res.status(404).json({ error: ERROR_MESSAGES.ITEM_NOT_FOUND });
            }

            await CartHelper.validateProductStock(productId, quantity);

            cart.items[itemIndex].quantity = quantity;
            cart.items[itemIndex].total = formatPrice(
                cart.items[itemIndex].price * quantity
            );

            CartHelper.updateCartTotals(cart);
            await cart.save();

            res.json({ 
                success: true, 
                cart: createCartResponse(cart) 
            });

        } catch (error) {
            logger.error('Error updating cart:', error);
            
            if (error.message === 'Product not found') {
                return res.status(404).json({ error: ERROR_MESSAGES.PRODUCT_NOT_FOUND });
            }
            if (error.message === 'Not enough stock available') {
                return res.status(400).json({ error: ERROR_MESSAGES.INSUFFICIENT_STOCK });
            }
            
            res.status(500).json({ error: ERROR_MESSAGES.GENERAL_ERROR });
        }
    },

    async removeFromCart(req, res) {
        try {
            const { productId } = req.params;
            
            const cart = await CartHelper.findUserCart(req);
            if (!cart) {
                return res.status(404).json({ error: ERROR_MESSAGES.CART_NOT_FOUND });
            }

            cart.items = cart.items.filter(item => {
                const itemProductId = item.product._id ? 
                    item.product._id.toString() : 
                    item.product.toString();
                return itemProductId !== productId;
            });

            CartHelper.updateCartTotals(cart);
            await cart.save();

            res.json({ 
                success: true, 
                cart: createCartResponse(cart) 
            });

        } catch (error) {
            logger.error('Error removing from cart:', error);
            res.status(500).json({ error: ERROR_MESSAGES.GENERAL_ERROR });
        }
    },

    async viewCart(req, res) {
        try {
            let cart = await CartHelper.findUserCartWithProducts(req);
            
            if (!cart) {
                cart = {
                    items: [],
                    totalAmount: 0,
                    toObject: function() {
                        return {
                            items: this.items,
                            totalAmount: this.totalAmount
                        };
                    }
                };
            }

            // Filter out items with null products and update totals
            if (cart.items && cart.items.length > 0) {
                const validItems = cart.items.filter(item => item.product !== null);
                const invalidItems = cart.items.filter(item => item.product === null);
                
                // Log invalid items for debugging
                if (invalidItems.length > 0) {
                    logger.debug('Found invalid cart items', { 
                        invalidCount: invalidItems.length,
                        validCount: validItems.length 
                    });
                }
                
                // Update cart with only valid items
                cart.items = validItems;
                CartHelper.updateCartTotals(cart);
                
                // Save the updated cart if there were invalid items
                if (invalidItems.length > 0 && cart._id) {
                    await cart.save();
                    logger.debug('Updated cart after removing invalid items');
                }
            }

            const cartWithDelivery = {
                ...(typeof cart.toObject === 'function' ? cart.toObject() : cart),
                deliveryFee: DELIVERY_FEE,
                grandTotal: formatPrice((cart.totalAmount || 0) + DELIVERY_FEE)
            };

            res.render('pages/Cart/cart', { 
                cart: cartWithDelivery,
                title: 'Shopping Cart'
            });

        } catch (error) {
            logger.error('Error viewing cart:', error);
            res.status(500).render('error', { 
                message: 'Error loading cart. Please try again later.',
                error: error.message
            });
        }
    },

    async checkout(req, res) {
        try {
            logger.debug('=== CART CHECKOUT DEBUG ===');
            logger.debug('User authenticated:', !!req.user);
            logger.debug('User ID:', req.user?._id);
            logger.debug('Session ID:', req.session.id);
            logger.debug('JWT Token present:', !!req.cookies.token);
            
            // Check if user is authenticated using req.user (set by JWT middleware)
            if (!req.user) {
                // The middleware will handle the redirect with the original URL
                logger.debug('User not authenticated, middleware will handle redirect');
                return res.redirect('/login');
            }

            // Use the same cart finding logic as other methods
            const cart = await CartHelper.findUserCartWithProducts(req);
            
            logger.debug('Final cart found:', !!cart);
            logger.debug('Final cart items count:', cart?.items?.length || 0);
            
            if (!cart || cart.items.length === 0) {
                logger.debug('No cart or empty cart, redirecting to cart view');
                return res.redirect('/cart/view');
            }

            const cartWithDelivery = {
                ...(typeof cart.toObject === 'function' ? cart.toObject() : cart),
                deliveryFee: DELIVERY_FEE,
                grandTotal: formatPrice((cart.totalAmount || 0) + DELIVERY_FEE)
            };

            logger.debug('Rendering checkout page with cart data');
            logger.debug('Cart total amount:', cart.totalAmount);
            logger.debug('Cart delivery fee:', DELIVERY_FEE);
            logger.debug('Cart grand total:', cartWithDelivery.grandTotal);
            
            res.render('pages/Order/checkout', { 
                cart: cartWithDelivery,
                user: req.user,
                title: 'Checkout'
            });

        } catch (error) {
            logger.error('Error in checkout:', error);
            res.status(500).render('error', { 
                message: 'Error loading checkout. Please try again later.',
                error: error.message
            });
        }
    }
};

module.exports = cartController;
const Cart = require('../models/Cart');
const Product = require('../models/Products');

const DELIVERY_FEE = 50;

const formatPrice = (price) => Number(price.toFixed(2));

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
        console.log('=== FIND USER CART DEBUG ===');
        console.log('Session ID:', req.session.id);
        console.log('Session cartId:', req.session.cartId);
        console.log('User authenticated:', !!req.user);
        console.log('User ID:', req.user?._id);
        
        // First try to find cart by user ID (for logged in users)
        if (req.user?._id) {
            const userCart = await Cart.findOne({ user: req.user._id });
            if (userCart) {
                console.log('Found user cart with ID:', userCart._id);
                return userCart;
            }
        }
        
        // Then try to find cart by session cartId (most reliable)
        if (req.session.cartId) {
            const cartById = await Cart.findById(req.session.cartId);
            if (cartById) {
                console.log('Found cart by session cartId:', cartById._id);
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
                console.log('Found session cart with ID:', sessionCart._id);
                return sessionCart;
            }
        }
        
        console.log('No cart found for user or session');
        return null;
    }

    static async findUserCartWithProducts(req) {
        console.log('=== FIND USER CART WITH PRODUCTS DEBUG ===');
        console.log('Session ID:', req.session.id);
        console.log('Session cartId:', req.session.cartId);
        console.log('User authenticated:', !!req.user);
        console.log('User ID:', req.user?._id);
        
        // First try to find cart by user ID (for logged in users)
        if (req.user?._id) {
            const userCart = await Cart.findOne({ user: req.user._id }).populate('items.product');
            if (userCart) {
                console.log('Found user cart with products, items count:', userCart.items.length);
                return userCart;
            }
        }
        
        // Then try to find cart by session cartId (most reliable)
        if (req.session.cartId) {
            const cartById = await Cart.findById(req.session.cartId).populate('items.product');
            if (cartById) {
                console.log('Found cart by session cartId with products, items count:', cartById.items.length);
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
                console.log('Found session cart with products, items count:', sessionCart.items.length);
                return sessionCart;
            }
        }
        
        console.log('No cart found for user or session');
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
}

const ERROR_MESSAGES = {
    PRODUCT_NOT_FOUND: 'Product not found',
    INSUFFICIENT_STOCK: 'Not enough stock available',
    CART_NOT_FOUND: 'Cart not found',
    ITEM_NOT_FOUND: 'Item not found in cart',
    GENERAL_ERROR: 'An error occurred. Please try again.'
};

const cartController = {
    async addToCart(req, res) {
        try {
            console.log('=== ADD TO CART DEBUG ===');
            console.log('User authenticated:', !!req.user);
            console.log('User ID:', req.user?._id);
            console.log('Session ID:', req.session.id);
            console.log('Request body:', req.body);
            
            const { productId, quantity } = req.body;
            
            let cart = await CartHelper.findUserCart(req);
            console.log('Existing cart found:', !!cart);
            console.log('Cart ID:', cart?._id);
            
            if (!cart) {
                console.log('Creating new cart...');
                cart = CartHelper.createNewCart(req);
                console.log('New cart created with ID:', cart._id);
                
                // Save the cart first
                await cart.save();
                console.log('Cart saved to database');
                
                // Then save session with cart ID
                req.session.cartId = cart._id.toString();
                req.session.save((err) => {
                    if (err) {
                        console.error('Error saving session:', err);
                    } else {
                        console.log('Session saved with cart ID:', cart._id);
                    }
                });
            }

            const existingItem = CartHelper.findCartItem(cart, productId);
            const currentQuantity = existingItem ? existingItem.quantity : 0;
            
            console.log('Existing item found:', !!existingItem);
            console.log('Current quantity:', currentQuantity);
            console.log('Requested quantity:', quantity);

            const product = await CartHelper.validateProductStock(
                productId, 
                quantity, 
                currentQuantity
            );
            
            console.log('Product validated:', product.name);

            if (existingItem) {
                existingItem.quantity += quantity;
                existingItem.total = formatPrice(existingItem.quantity * existingItem.price);
                console.log('Updated existing item, new quantity:', existingItem.quantity);
            } else {
                cart.items.push({
                    product: productId,
                    quantity: quantity,
                    price: formatPrice(product.price),
                    total: formatPrice(product.price * quantity)
                });
                console.log('Added new item to cart');
            }

            CartHelper.updateCartTotals(cart);
            console.log('Cart total updated:', cart.totalAmount);
            
            await cart.save();
            console.log('Cart saved successfully');

            const updatedCart = await Cart.findById(cart._id).populate('items.product');
            console.log('Final cart items count:', updatedCart.items.length);
            
            res.json({ 
                success: true, 
                cart: updatedCart,
                message: 'Item added to cart successfully'
            });

        } catch (error) {
            console.error('Error adding to cart:', error);
            
            if (error.message === 'Product not found') {
                return res.status(404).json({ error: ERROR_MESSAGES.PRODUCT_NOT_FOUND });
            }
            if (error.message === 'Not enough stock available') {
                return res.status(400).json({ error: ERROR_MESSAGES.INSUFFICIENT_STOCK });
            }
            
            res.status(500).json({ error: ERROR_MESSAGES.GENERAL_ERROR });
        }
    },

    async getCart(req, res) {
        try {
            console.log('=== GET CART DEBUG ===');
            console.log('User authenticated:', !!req.user);
            console.log('User ID:', req.user?._id);
            console.log('Session ID:', req.session.id);
            
            const cart = await CartHelper.findUserCartWithProducts(req);
            console.log('Cart found:', !!cart);
            console.log('Cart ID:', cart?._id);
            console.log('Cart items count:', cart?.items?.length || 0);
            
            if (!cart) {
                console.log('No cart found, returning empty cart');
                return res.json(handleEmptyCart());
            }

            const response = createCartResponse(cart);
            console.log('Sending cart response with items:', response.items?.length || 0);
            res.json(response);

        } catch (error) {
            console.error('Error getting cart:', error);
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
            console.error('Error updating cart:', error);
            
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
            console.error('Error removing from cart:', error);
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
            console.error('Error viewing cart:', error);
            res.status(500).render('error', { 
                message: 'Error loading cart. Please try again later.',
                error: error.message
            });
        }
    },

    async checkout(req, res) {
        try {
            console.log('=== CART CHECKOUT DEBUG ===');
            console.log('User authenticated:', !!req.user);
            console.log('User ID:', req.user?._id);
            console.log('Session ID:', req.session.id);
            console.log('JWT Token present:', !!req.cookies.token);
            
            // Check if user is authenticated using req.user (set by JWT middleware)
            if (!req.user) {
                // The middleware will handle the redirect with the original URL
                console.log('User not authenticated, middleware will handle redirect');
                return res.redirect('/login');
            }

            // Find cart using improved logic
            let cart = null;
            
            // First try to find cart by user ID (for logged in users)
            if (req.user?._id) {
                cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
                if (cart) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('Found user cart with ID:', cart._id);
                    }
                }
            }
            
            // If no user cart found, try session cart
            if (!cart) {
                cart = await Cart.findOne({ 
                    sessionId: req.session.id,
                    user: null 
                }).populate("items.product");
                
                if (cart) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('Found session cart with ID:', cart._id);
                    }
                }
            }

            console.log('Cart found:', !!cart);
            console.log('Cart items count:', cart?.items?.length || 0);
            
            if (!cart || cart.items.length === 0) {
                console.log('No cart or empty cart, redirecting to cart view');
                return res.redirect('/cart/view');
            }

            const cartWithDelivery = {
                ...(typeof cart.toObject === 'function' ? cart.toObject() : cart),
                deliveryFee: DELIVERY_FEE,
                grandTotal: formatPrice((cart.totalAmount || 0) + DELIVERY_FEE)
            };

            console.log('Rendering checkout page with cart data');
            res.render('pages/Order/checkout', { 
                cart: cartWithDelivery,
                user: req.user,
                title: 'Checkout'
            });

        } catch (error) {
            console.error('Error in checkout:', error);
            res.status(500).render('error', { 
                message: 'Error loading checkout. Please try again later.',
                error: error.message
            });
        }
    }
};

module.exports = cartController;
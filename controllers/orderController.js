const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Products");
const mongoose = require("mongoose");

const DELIVERY_FEE = 50;

const formatPrice = (price) => Number(price.toFixed(2));

const validatePhoneNumber = (phone) => {
  const phoneNumber = phone ? phone.replace(/\D/g, "") : '';
  return phoneNumber.length === 10;
};

// Validation constants
const VALIDATION = {
  MIN_ADDRESS_LENGTH: 10,
  MAX_ADDRESS_LENGTH: 200,
  PHONE_LENGTH: 10
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

const orderController = {
  async checkout(req, res) {
    try {
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

      if (!cart || cart.items.length === 0) {
        return res.redirect("/cart/view");
      }

      const cartWithDelivery = {
        ...cart.toObject(),
        deliveryFee: DELIVERY_FEE,
        grandTotal: formatPrice(cart.totalAmount + DELIVERY_FEE),
      };

      // Get user data from req.user (set by auth middleware)
      const user = req.user;

      res.render("pages/Order/checkout", {
        cart: cartWithDelivery,
        user: user,
        title: "Checkout",
      });
    } catch (error) {
      console.error("Error in checkout:", error);
      res.status(500).render("error", {
        error: "Error loading checkout page. Please try again.",
      });
    }
  },

  async placeOrder(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.debug('Starting order placement', {
        userId: req.user?._id,
        sessionId: req.session.id
      });
      
      const {
        shippingAddress,
        contactPhone,
        addressChoice,
        phoneChoice
      } = req.body;

      logger.debug('Order form data', { addressChoice, phoneChoice });

      // Use the exact same cart finding logic as checkout method
      let cart = null;
      
      // First try to find cart by user ID (for logged in users)
      if (req.user?._id) {
        cart = await Cart.findOne({ user: req.user._id }).populate("items.product").session(session);
        if (cart) {
          logger.debug('Found user cart', { cartId: cart._id });
        } else {
          logger.debug('No user cart found', { userId: req.user._id });
        }
      }
      
      // Then try to find cart by session cartId (most reliable)
      if (!cart && req.session.cartId) {
        cart = await Cart.findById(req.session.cartId).populate("items.product").session(session);
        if (cart) {
          logger.debug('Found cart by session cartId', { cartId: cart._id });
        } else {
          logger.debug('No cart found by session cartId', { cartId: req.session.cartId });
        }
      }
      
      // Finally try to find cart by session ID (fallback)
      if (!cart && req.session.id) {
        cart = await Cart.findOne({ 
          sessionId: req.session.id
        }).populate("items.product").session(session);
        
        if (cart) {
          logger.debug('Found session cart', { cartId: cart._id });
        } else {
          logger.debug('No session cart found', { sessionId: req.session.id });
        }
      }

      logger.debug('Cart lookup result', {
        found: !!cart,
        itemsCount: cart?.items?.length || 0
      });

      if (!cart || cart.items.length === 0) {
        logger.debug('No cart or empty cart, redirecting to cart view');
        await session.abortTransaction();
        session.endSession();
        return res.redirect('/cart/view');
      }

      // Get user data from req.user (set by auth middleware)
      const user = req.user;

      const renderCheckoutWithError = (error) => {
        logger.debug('Rendering checkout with error', { error });
        const cartWithDelivery = {
          ...cart.toObject(),
          deliveryFee: DELIVERY_FEE,
          grandTotal: formatPrice(cart.totalAmount + DELIVERY_FEE),
        };
        res.status(400).render("pages/Order/checkout", {
          error: error,
          cart: cartWithDelivery,
          user: user,
          title: "Checkout",
        });
      };

      // Validate address
      if (addressChoice === 'account') {
        if (!user || !user.address) {
          await session.abortTransaction();
          session.endSession();
          return renderCheckoutWithError("No address found in your account. Please add an address or enter a new one.");
        }
      } else {
        if (!shippingAddress || shippingAddress.trim().length < VALIDATION.MIN_ADDRESS_LENGTH || 
            shippingAddress.trim().length > VALIDATION.MAX_ADDRESS_LENGTH) {
          await session.abortTransaction();
          session.endSession();
          return renderCheckoutWithError(`Please enter a valid shipping address (${VALIDATION.MIN_ADDRESS_LENGTH}-${VALIDATION.MAX_ADDRESS_LENGTH} characters).`);
        }
      }

      // Validate phone
      if (phoneChoice === 'account') {
        if (!user || !user.phoneNumber) {
          await session.abortTransaction();
          session.endSession();
          return renderCheckoutWithError("No phone number found in your account. Please add a phone number or enter a new one.");
        }
      } else {
        if (!validatePhoneNumber(contactPhone)) {
          await session.abortTransaction();
          session.endSession();
          return renderCheckoutWithError(`Phone number must be exactly ${VALIDATION.PHONE_LENGTH} digits.`);
        }
      }

      const finalAddress = addressChoice === 'account' ? user.address : shippingAddress.trim();
      let finalPhone = phoneChoice === 'account' ? user.phoneNumber : contactPhone.replace(/\D/g, "");

      // Final validation for the chosen phone number
      if (!validatePhoneNumber(finalPhone)) {
          const errorMessage = phoneChoice === 'account' 
              ? `The phone number in your account (${finalPhone}) is invalid. Please update it in your profile or enter a new one.`
              : `The new phone number you entered is invalid. Please provide a ${VALIDATION.PHONE_LENGTH}-digit number.`;
          await session.abortTransaction();
          session.endSession();
          return renderCheckoutWithError(errorMessage);
      }

      logger.debug('Creating order', { userId: req.user._id });

      const order = new Order({
        user: req.user._id,
        products: cart.items.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
        })),
        totalAmount: formatPrice(cart.totalAmount + DELIVERY_FEE),
        orderStatus: "Confirmed",
        OrderID: Date.now(),
        ShippingAddress: finalAddress,
        ContactNumber: finalPhone,
        PaymentMethod: "Cash on Delivery",
      });

      logger.debug('Saving order');
      await order.save({ session });
      logger.debug('Order saved successfully', { orderId: order._id });
      
      logger.debug('Updating product stock');
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(
          item.product._id, 
          { $inc: { stockQuantity: -item.quantity } },
          { session }
        );
      }

      logger.debug('Deleting cart');
      await Cart.findByIdAndDelete(cart._id, { session });
      
      // Commit transaction
      await session.commitTransaction();
      logger.debug('Transaction committed successfully');

      // Store order ID in session and save
      req.session.lastOrderId = order._id.toString();
      logger.debug('Stored order ID in session', { orderId: req.session.lastOrderId });

      // Force session save and then redirect
      req.session.save((err) => {
        if (err) {
            logger.error("Session save error", err);
            return next(err);
        }

        logger.debug('Session saved successfully, redirecting to order success');
        logger.debug('Session data after save:', {
          sessionId: req.session.id,
          lastOrderId: req.session.lastOrderId,
          sessionData: req.session
        });
        
        // Add a small delay to ensure session is fully saved
        setTimeout(() => {
          res.redirect(`/order/success?orderId=${order._id}`);
        }, 100);
      });
      
    } catch (error) {
      logger.error("Error placing order", error);
      
      // Abort transaction on error
      await session.abortTransaction();
      
      res.status(500).render("pages/error", {
        error: "Error placing order. Please try again.",
      });
    } finally {
      session.endSession();
    }
  },

  async orderSuccess(req, res) {
    try {
      console.log('=== ORDER SUCCESS DEBUG ===');
      console.log('User authenticated:', !!req.user);
      console.log('User ID:', req.user?._id);
      console.log('Session ID:', req.session.id);
      console.log('JWT Token present:', !!req.cookies.token);
      console.log('Session lastOrderId:', req.session.lastOrderId);
      console.log('Session data:', JSON.stringify(req.session, null, 2));
      
      // Try multiple sources for order ID
      let orderId = req.session.lastOrderId;
      let order = null;
      
      // First try session
      if (orderId) {
        console.log("Found order ID in session:", orderId);
        order = await Order.findById(orderId).populate("products.product");
        if (order && order.user.toString() === req.user._id.toString()) {
          console.log("Order found from session");
        } else {
          console.log("Order not found from session or user mismatch");
          order = null;
        }
      }
      
      // If no order from session, try query parameter
      if (!order) {
        const queryOrderId = req.query.orderId;
        if (queryOrderId) {
          console.log("Trying order ID from query parameter:", queryOrderId);
          order = await Order.findById(queryOrderId).populate("products.product");
          if (order && order.user.toString() === req.user._id.toString()) {
            console.log("Order found from query parameter");
          } else {
            console.log("Order not found from query parameter or user mismatch");
            order = null;
          }
        }
      }
      
      // If still no order, try to find the most recent order for this user
      if (!order) {
        console.log("Trying to find most recent order for user");
        order = await Order.findOne({ 
          user: req.user._id 
        }).sort({ OrderDate: -1 }).populate("products.product");
        
        if (order) {
          console.log("Found most recent order:", order._id);
        } else {
          console.log("No orders found for user");
        }
      }
      
      if (!order) {
        console.log("No order found, redirecting to home");
        return res.redirect("/");
      }

      console.log("Order found, rendering success page");
      console.log("Order details:", {
        id: order._id,
        user: order.user,
        totalAmount: order.totalAmount,
        productsCount: order.products.length,
        OrderDate: order.OrderDate,
        OrderID: order.OrderID
      });
      
      // Clear the order ID from session after successful display
      delete req.session.lastOrderId;
      
      res.render("pages/Order/order-success", {
        order: order,
        title: "Order Confirmation",
      });
    } catch (error) {
      console.error("Error loading order success page:", error);
      res.status(500).render("pages/error", {
        error: "Error loading order details. Please try again.",
      });
    }
  },
};

module.exports = orderController;

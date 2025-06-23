const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Products");

const DELIVERY_FEE = 50;

const formatPrice = (price) => Number(price.toFixed(2));

const validatePhoneNumber = (phone) => {
  const phoneNumber = phone ? phone.replace(/\D/g, "") : '';
  return phoneNumber.length === 10;
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
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('=== PLACE ORDER DEBUG ===');
        console.log('User authenticated:', !!req.user);
        console.log('User ID:', req.user?._id);
        console.log('Session ID:', req.session.id);
        console.log('JWT Token present:', !!req.cookies.token);
      }
      
      const {
        shippingAddress,
        contactPhone,
        addressChoice,
        phoneChoice
      } = req.body;

      if (process.env.NODE_ENV === 'development') {
        console.log('Form data:', { addressChoice, phoneChoice });
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

      if (process.env.NODE_ENV === 'development') {
        console.log('Cart found:', !!cart);
        console.log('Cart items count:', cart?.items?.length || 0);
      }

      if (!cart || cart.items.length === 0) {
        return res.redirect('/cart/view');
      }

      // Get user data from req.user (set by auth middleware)
      const user = req.user;

      const renderCheckoutWithError = (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Rendering checkout with error:', error);
        }
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

      if (addressChoice === 'account') {
        if (!user || !user.address) {
          return renderCheckoutWithError("No address found in your account. Please add an address or enter a new one.");
        }
      } else {
        if (!shippingAddress || shippingAddress.trim().length < 10) {
          return renderCheckoutWithError("Please enter a valid shipping address (at least 10 characters).");
        }
      }

      if (phoneChoice === 'account') {
        if (!user || !user.phoneNumber) {
          return renderCheckoutWithError("No phone number found in your account. Please add a phone number or enter a new one.");
        }
      } else {
        if (!validatePhoneNumber(contactPhone)) {
          return renderCheckoutWithError("Phone number must be exactly 10 digits.");
        }
      }

      const finalAddress = addressChoice === 'account' ? user.address : shippingAddress.trim();
      let finalPhone = phoneChoice === 'account' ? user.phoneNumber : contactPhone.replace(/\D/g, "");

      // Final validation for the chosen phone number
      if (!validatePhoneNumber(finalPhone)) {
          const errorMessage = phoneChoice === 'account' 
              ? `The phone number in your account (${finalPhone}) is invalid. Please update it in your profile or enter a new one.`
              : "The new phone number you entered is invalid. Please provide a 10-digit number.";
          return renderCheckoutWithError(errorMessage);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Creating order with user ID:', req.user._id);
      }

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

      if (process.env.NODE_ENV === 'development') {
        console.log('Saving order...');
      }
      await order.save();
      if (process.env.NODE_ENV === 'development') {
        console.log('Order saved successfully, ID:', order._id);
        console.log('Updating product stock...');
      }

      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: {
            stockQuantity: -item.quantity
          },
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Deleting cart...');
      }
      await Cart.findByIdAndDelete(cart._id);
      
      // Store order ID in session
      req.session.lastOrderId = order._id.toString();

      if (process.env.NODE_ENV === 'development') {
        console.log('Stored order ID in session:', req.session.lastOrderId);
      }

      // Force session save and then redirect
      req.session.save((err) => {
        if (err) {
            console.error("Session save error:", err);
            return next(err);
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('Session saved successfully, redirecting to order success...');
        }
        
        // Use absolute path to ensure proper redirect
        res.redirect("/order/success");
      });
      
    } catch (error) {
      console.error("Error placing order:", error);
      res.status(500).render("pages/error", {
        error: "Error placing order. Please try again.",
      });
    }
  },

  async orderSuccess(req, res) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('=== ORDER SUCCESS DEBUG ===');
        console.log('User authenticated:', !!req.user);
        console.log('User ID:', req.user?._id);
        console.log('Session ID:', req.session.id);
        console.log('JWT Token present:', !!req.cookies.token);
        console.log('Session lastOrderId:', req.session.lastOrderId);
        console.log('Session data:', JSON.stringify(req.session, null, 2));
      }
      
      const orderId = req.session.lastOrderId;
      if (!orderId) {
        if (process.env.NODE_ENV === 'development') {
          console.log("No order ID found in session");
        }
        return res.redirect("/");
      }

      if (process.env.NODE_ENV === 'development') {
        console.log("Fetching order details for ID:", orderId);
      }
      const order = await Order.findById(orderId).populate("products.product");

      if (!order) {
        if (process.env.NODE_ENV === 'development') {
          console.log("Order not found in database");
        }
        return res.redirect("/");
      }

      if (process.env.NODE_ENV === 'development') {
        console.log("Order found, rendering success page");
        console.log("Order details:", {
          id: order._id,
          user: order.user,
          totalAmount: order.totalAmount,
          productsCount: order.products.length
        });
      }
      
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

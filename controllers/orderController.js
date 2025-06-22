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
      const cart = await Cart.findOne({
        $or: [{ user: req.user._id }, { sessionId: req.session.id }],
      }).populate("items.product");

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

  async placeOrder(req, res) {
    try {
      console.log('=== PLACE ORDER DEBUG ===');
      console.log('User authenticated:', !!req.user);
      console.log('User ID:', req.user?._id);
      console.log('Session ID:', req.session.id);
      console.log('JWT Token present:', !!req.cookies.token);
      
      const {
        shippingAddress,
        contactPhone,
        addressChoice,
        phoneChoice
      } = req.body;

      console.log('Form data:', { addressChoice, phoneChoice });

      const cart = await Cart.findOne({
        $or: [{
          user: req.user._id
        }, {
          sessionId: req.session.id
        }],
      }).populate("items.product");

      console.log('Cart found:', !!cart);
      console.log('Cart items count:', cart?.items?.length || 0);

      // Get user data from req.user (set by auth middleware)
      const user = req.user;

      const renderCheckoutWithError = (error) => {
        console.log('Rendering checkout with error:', error);
        if (!cart) {
          return res.redirect('/cart/view');
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

      console.log('Creating order with user ID:', req.user._id);

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

      console.log('Saving order...');
      await order.save();
      console.log('Order saved successfully, ID:', order._id);

      console.log('Updating product stock...');
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: {
            stockQuantity: -item.quantity
          },
        });
      }

      console.log('Deleting cart...');
      await Cart.findByIdAndDelete(cart._id);
      
      console.log('Setting session lastOrderId...');
      req.session.lastOrderId = order._id;

      console.log('Redirecting to order success...');
      res.redirect("/order/success");
    } catch (error) {
      console.error("Error placing order:", error);
      res.status(500).render("pages/error", {
        error: "Error placing order. Please try again.",
      });
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
      
      const orderId = req.session.lastOrderId;
      if (!orderId) {
        console.log("No order ID found in session");
        return res.redirect("/");
      }

      console.log("Fetching order details for ID:", orderId);
      const order = await Order.findById(orderId).populate("products.product");

      if (!order) {
        console.log("Order not found in database");
        return res.redirect("/");
      }

      console.log("Order found, rendering success page");
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

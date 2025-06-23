const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const cartController = require('../controllers/cartController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/checkout', isAuthenticated, cartController.checkout);
router.post('/place', isAuthenticated, orderController.placeOrder);
router.get('/success', isAuthenticated, orderController.orderSuccess);

module.exports = router; 
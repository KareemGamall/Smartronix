const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const cartController = require('../controllers/cartController');
const { isAuthenticated } = require('../middleware/auth');

// Test route without authentication
router.get('/checkout-test', (req, res) => {
    console.log('=== TEST CHECKOUT ROUTE ===');
    console.log('User:', req.user);
    console.log('Session:', req.session.id);
    res.send('Test checkout route working! User: ' + (req.user ? req.user.email : 'Not logged in'));
});

router.get('/checkout', isAuthenticated, cartController.checkout);
router.post('/place', isAuthenticated, orderController.placeOrder);
router.get('/success', isAuthenticated, orderController.orderSuccess);

module.exports = router; 
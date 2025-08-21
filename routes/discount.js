const express = require('express');
const router = express.Router();
const DiscountController = require('../controllers/discountController');
const { isAdmin } = require('../middleware/auth');

// Apply admin middleware to all discount routes
router.use(isAdmin);

// Get all discounts
router.get('/', DiscountController.getDiscounts);

// Get products eligible for discount
router.get('/eligible', DiscountController.getEligibleProducts);

// Add discount to a product
router.post('/add', DiscountController.addDiscount);

// Update discount
router.put('/update', DiscountController.updateDiscount);

// Remove discount from a product
router.delete('/remove/:productId', DiscountController.removeDiscount);

module.exports = router;

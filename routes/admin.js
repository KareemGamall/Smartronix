const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { isAdmin } = require('../middleware/auth');

// Protect all admin routes
router.use(isAdmin);

// Dashboard
router.get('/', AdminController.getDashboard);
router.get('/stats', AdminController.getStats);

// User Management
router.get('/users', AdminController.getUsers);
router.get('/users/:id', AdminController.getUser);
router.post('/users', AdminController.createUser);
router.put('/users/:id', AdminController.updateUser);
router.delete('/users/:id', AdminController.deleteUser);

// Product Management
router.get('/products', AdminController.getProducts);
router.get('/products/:id', AdminController.getProduct);
router.post('/products', AdminController.createProduct);
router.put('/products/:id', AdminController.updateProduct);
router.delete('/products/:id', AdminController.deleteProduct);

// Order Management
router.get('/orders', AdminController.getOrders);

// Category Management
router.get('/categories', AdminController.getCategories);
router.get('/categories/:id', AdminController.getCategory);
router.post('/categories', AdminController.createCategory);
router.put('/categories/:id', AdminController.updateCategory);
router.delete('/categories/:id', AdminController.deleteCategory);

// Admin Profile
router.get('/profile', AdminController.getProfile);

// Test Order
router.post('/test-order', AdminController.createTestOrder);

// Debug Routes
router.get('/debug/orders', AdminController.debugOrders);

module.exports = router;

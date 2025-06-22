const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.getAllProducts);
router.get('/search', productController.searchProducts);
router.get('/category/:categoryId', productController.getProductsByCategory);
router.get('/details/:id', productController.getProductDetails);

router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;

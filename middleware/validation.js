const { body, validationResult } = require('express-validator');

// Validation for cart operations
const validateCartItem = [
    body('productId')
        .isMongoId()
        .withMessage('Invalid product ID format'),
    body('quantity')
        .isInt({ min: 1, max: 100 })
        .withMessage('Quantity must be between 1 and 100'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array() 
            });
        }
        next();
    }
];

// Validation for user signup
const validateSignup = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email address'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('phoneNumber')
        .matches(/^(10|11|12|15)\d{8}$/)
        .withMessage('Please enter a valid Egyptian phone number starting with 10, 11, 12, or 15'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array() 
            });
        }
        next();
    }
];

// Validation for user login
const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please enter a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array() 
            });
        }
        next();
    }
];

// Validation for profile update
const validateProfileUpdate = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('phoneNumber')
        .optional()
        .matches(/^(10|11|12|15)\d{8}$/)
        .withMessage('Please enter a valid Egyptian phone number starting with 10, 11, 12, or 15'),
    body('address')
        .optional()
        .trim()
        .isLength({ min: 10, max: 200 })
        .withMessage('Address must be between 10 and 200 characters'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array() 
            });
        }
        next();
    }
];

// Validation for order placement
const validateOrder = [
    body('addressChoice')
        .isIn(['account', 'new'])
        .withMessage('Invalid address choice'),
    body('phoneChoice')
        .isIn(['account', 'new'])
        .withMessage('Invalid phone choice'),
    body('shippingAddress')
        .if(body('addressChoice').equals('new'))
        .trim()
        .isLength({ min: 10, max: 200 })
        .withMessage('Shipping address must be between 10 and 200 characters'),
    body('contactPhone')
        .if(body('phoneChoice').equals('new'))
        .matches(/^(10|11|12|15)\d{8}$/)
        .withMessage('Please enter a valid Egyptian phone number'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array() 
            });
        }
        next();
    }
];

module.exports = {
    validateCartItem,
    validateSignup,
    validateLogin,
    validateProfileUpdate,
    validateOrder
}; 
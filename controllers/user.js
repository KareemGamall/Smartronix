const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Cart = require("../models/Cart");

const formatPrice = (price) => Number(price.toFixed(2));

// Validation constants
const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 50,
  PHONE_LENGTH: 10
};

// Password strength requirements
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex
const PHONE_REGEX = /^\d{10}$/;

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

// Validation functions
const validatePassword = (password) => {
  if (password.length < VALIDATION.MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${VALIDATION.MIN_PASSWORD_LENGTH} characters long`);
  }
  if (password.length > VALIDATION.MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be no more than ${VALIDATION.MAX_PASSWORD_LENGTH} characters long`);
  }
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
  }
  return password;
};

const validateEmail = (email) => {
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Please enter a valid email address');
  }
  return email.toLowerCase().trim();
};

const validatePhone = (phone) => {
  if (!PHONE_REGEX.test(phone)) {
    throw new Error(`Phone number must be exactly ${VALIDATION.PHONE_LENGTH} digits`);
  }
  return phone;
};

const validateName = (name) => {
  const trimmedName = name.trim();
  if (trimmedName.length < VALIDATION.MIN_NAME_LENGTH) {
    throw new Error(`Name must be at least ${VALIDATION.MIN_NAME_LENGTH} characters long`);
  }
  if (trimmedName.length > VALIDATION.MAX_NAME_LENGTH) {
    throw new Error(`Name must be no more than ${VALIDATION.MAX_NAME_LENGTH} characters long`);
  }
  return trimmedName;
};

async function mergeCarts(userId, sessionId) {
  logger.debug('Starting cart merge', { userId, sessionId });

  try {
    const userCart = await Cart.findOne({ user: userId });
    const sessionCart = await Cart.findOne({ sessionId: sessionId, user: null });

    if (!sessionCart) {
      logger.debug('No session cart to merge');
      return { success: true, message: 'No session cart found' };
    }

    if (!userCart) {
      logger.debug('No existing user cart, assigning session cart to user');
      sessionCart.user = userId;
      sessionCart.sessionId = null; // Clear session ID since it's now a user cart
      await sessionCart.save();
      return { success: true, message: 'Session cart assigned to user' };
    }

    logger.debug('Merging carts', {
      userCartItems: userCart.items.length,
      sessionCartItems: sessionCart.items.length
    });

    // Merge session cart items into user cart
    let itemsAdded = 0;
    let itemsUpdated = 0;

    for (const sessionItem of sessionCart.items) {
      const existingItemIndex = userCart.items.findIndex(
        (userItem) => userItem.product.toString() === sessionItem.product.toString()
      );

      if (existingItemIndex > -1) {
        // Item exists, add quantities
        userCart.items[existingItemIndex].quantity += sessionItem.quantity;
        userCart.items[existingItemIndex].total = formatPrice(
          userCart.items[existingItemIndex].quantity * userCart.items[existingItemIndex].price
        );
        itemsUpdated++;
        logger.debug('Updated existing item quantity', { 
          productId: sessionItem.product,
          newQuantity: userCart.items[existingItemIndex].quantity 
        });
      } else {
        // New item, add to cart
        userCart.items.push(sessionItem);
        itemsAdded++;
        logger.debug('Added new item to cart', { productId: sessionItem.product });
      }
    }

    // Recalculate total
    userCart.totalAmount = formatPrice(
      userCart.items.reduce((total, item) => total + item.total, 0)
    );

    await userCart.save();
    await Cart.findByIdAndDelete(sessionCart._id);

    logger.info('Cart merge completed successfully', {
      itemsAdded,
      itemsUpdated,
      finalItemsCount: userCart.items.length,
      finalTotal: userCart.totalAmount
    });

    return { 
      success: true, 
      message: 'Carts merged successfully',
      itemsAdded,
      itemsUpdated
    };
  } catch (error) {
    logger.error('Error in mergeCarts', error);
    return { 
      success: false, 
      message: 'Failed to merge carts',
      error: error.message 
    };
  }
}

exports.signup = async (req, res) => {
  try {
    logger.debug('Signup request received', { 
      email: req.body.email,
      hasName: !!req.body.name,
      hasPhone: !!req.body.phoneNumber
    });

    const { name, email, password, phoneNumber } = req.body;

    // Validate input
    let validatedName, validatedEmail, validatedPassword, validatedPhone;
    
    try {
      validatedName = validateName(name);
      validatedEmail = validateEmail(email);
      validatedPassword = validatePassword(password);
      validatedPhone = validatePhone(phoneNumber);
    } catch (validationError) {
      logger.debug('Validation failed', { error: validationError.message });
      return res.status(400).json({
        error: validationError.message,
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email: validatedEmail });
    if (existingUser) {
      logger.debug('Email already exists', { email: validatedEmail });
      return res.status(400).json({
        error: "Email is already registered",
      });
    }

    const existingPhoneNumber = await User.findOne({ phoneNumber: validatedPhone });
    if (existingPhoneNumber) {
      logger.debug('Phone number already exists', { phone: validatedPhone });
      return res.status(400).json({
        error: "Phone number is already registered",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedPassword, salt);

    // Create user
    const user = await User.create({
      name: validatedName,
      email: validatedEmail,
      password: hashedPassword,
      phoneNumber: validatedPhone,
    });

    logger.info('User created successfully', { userId: user._id, email: validatedEmail });

    // Check if there's a return URL stored in session
    const returnTo = req.session.returnTo;
    if (returnTo) {
      delete req.session.returnTo;
      logger.debug('Redirecting after signup', { returnTo });
      return res.status(201).json({
        message: "User registered successfully",
        redirect: returnTo
      });
    }

    res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    logger.error('Signup error', error);
    
    // Don't expose internal errors in production
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Registration failed. Please try again.';
    
    res.status(500).json({
      error: errorMessage,
    });
  }
};

// Login controller
exports.login = async (req, res) => {
  try {
    console.log('=== LOGIN REQUEST RECEIVED ===');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    
    const { email, password } = req.body;

    console.log('Login attempt for email:', email);
    console.log('Session returnTo:', req.session.returnTo);
    console.log('URL redirect param:', req.query.redirect);

    // Check if there's a redirect parameter in the URL and store it in session
    if (req.query.redirect && !req.session.returnTo) {
      req.session.returnTo = req.query.redirect;
      console.log('Stored redirect from URL in session:', req.query.redirect);
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(400).json({
        error: "Wrong email or password",
      });
    }

    console.log('User found:', user.email);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      return res.status(400).json({
        error: "Wrong email or password",
      });
    }

    console.log('Password validated successfully');

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET_PHRASE || 'smartronix-jwt-secret-key-2024',
      {
        expiresIn: "30d",
      }
    );

    console.log('JWT Secret available:', !!process.env.JWT_SECRET_PHRASE);
    console.log('Generated token:', token ? 'Token generated' : 'No token');

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
    });

    console.log('Cookie set, checking if it was set properly');
    console.log('Response headers:', res.getHeaders());

    await mergeCarts(user._id, req.session.id);

    logger.debug('Cookie set, checking if it was set properly');
    logger.debug('Response headers:', res.getHeaders());

    // Check if there's a return URL stored in session
    const returnTo = req.session.returnTo;
    logger.debug('Found returnTo in session:', returnTo);
    
    if (returnTo) {
      delete req.session.returnTo;
      logger.debug('Sending redirect response:', returnTo);
      return res.status(200).json({ 
        message: "Login successful",
        redirect: returnTo
      });
    }

    logger.debug('No redirect, sending normal response');
    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    logger.error('Login error', error);
    
    // Don't expose internal errors in production
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Login failed. Please try again.';
    
    res.status(500).json({
      error: errorMessage,
    });
  }
};

// Update Profile controller
exports.updateProfile = async (req, res) => {
  try {
    const { name, phoneNumber, address } = req.body;
    const userId = req.user._id;

    console.log('Update Profile Request:', {
      userId: userId,
      name: name,
      phoneNumber: phoneNumber,
      address: address,
      userBeforeUpdate: {
        name: req.user.name,
        phoneNumber: req.user.phoneNumber,
        address: req.user.address
      }
    });

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Name is required",
      });
    }

    // Check if phone number is provided and validate it
    if (phoneNumber && phoneNumber.trim()) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        return res.status(400).json({
          error: "Please enter a valid 10-digit phone number.",
        });
      }

      // Check if phone number is already taken by another user
      const existingPhoneUser = await User.findOne({ 
        phoneNumber: phoneNumber.trim(),
        _id: { $ne: userId }
      });
      
      if (existingPhoneUser) {
        return res.status(400).json({
          error: "Phone number is already taken by another user",
        });
      }
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      phoneNumber: phoneNumber ? phoneNumber.trim() : req.user.phoneNumber,
      address: address ? address.trim() : req.user.address
    };

    console.log('Update Data:', updateData);

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    console.log('Updated User:', {
      _id: updatedUser._id,
      name: updatedUser.name,
      phoneNumber: updatedUser.phoneNumber,
      address: updatedUser.address
    });

    if (!updatedUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error('Error in updateProfile:', error);
    res.status(500).json({
      error: "Error updating profile",
    });
  }
};

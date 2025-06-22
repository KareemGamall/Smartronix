const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.signup = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: "Email is taken",
      });
    }

    const existingPhoneNumber = await User.findOne({ phoneNumber });
    if (existingPhoneNumber) {
      return res.status(400).json({
        error: "Phone number is taken",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phoneNumber,
    });

    user.save();

    // Check if there's a return URL stored in session
    const returnTo = req.session.returnTo;
    if (returnTo) {
      delete req.session.returnTo;
      return res.status(201).json({
        message: "User registered successfully",
        redirect: returnTo
      });
    }

    res.status(201).json({
      message: "User registered successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: error.message,
    });
  }
};

// Login controller
exports.login = async (req, res) => {
  try {
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
      return res.status(400).json({
        error: "Wrong email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        error: "Wrong email or password",
      });
    }

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

    // Check if there's a return URL stored in session
    const returnTo = req.session.returnTo;
    console.log('Found returnTo in session:', returnTo);
    
    if (returnTo) {
      delete req.session.returnTo;
      console.log('Sending redirect response:', returnTo);
      return res.status(200).json({ 
        message: "Login successful",
        redirect: returnTo
      });
    }

    console.log('No redirect, sending normal response');
    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Error in login",
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

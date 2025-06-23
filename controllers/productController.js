const Product = require("../models/Products");
const Category = require("../models/Category");

// Validation constants
const VALIDATION = {
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MIN_DESCRIPTION_LENGTH: 10,
  MAX_DESCRIPTION_LENGTH: 1000,
  MIN_PRICE: 0.01,
  MAX_PRICE: 999999.99,
  MIN_STOCK: 0,
  MAX_STOCK: 999999,
  MAX_SEARCH_LENGTH: 100,
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 50
};

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
const validateProductInput = (data) => {
  const errors = [];

  // Name validation
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Product name is required and must be a string');
  } else {
    const name = data.name.trim();
    if (name.length < VALIDATION.MIN_NAME_LENGTH) {
      errors.push(`Product name must be at least ${VALIDATION.MIN_NAME_LENGTH} characters long`);
    }
    if (name.length > VALIDATION.MAX_NAME_LENGTH) {
      errors.push(`Product name must be no more than ${VALIDATION.MAX_NAME_LENGTH} characters long`);
    }
  }

  // Price validation
  if (!data.price || isNaN(data.price)) {
    errors.push('Price is required and must be a number');
  } else {
    const price = parseFloat(data.price);
    if (price < VALIDATION.MIN_PRICE) {
      errors.push(`Price must be at least $${VALIDATION.MIN_PRICE}`);
    }
    if (price > VALIDATION.MAX_PRICE) {
      errors.push(`Price cannot exceed $${VALIDATION.MAX_PRICE}`);
    }
  }

  // Stock validation
  if (!data.stockQuantity || isNaN(data.stockQuantity)) {
    errors.push('Stock quantity is required and must be a number');
  } else {
    const stock = parseInt(data.stockQuantity);
    if (stock < VALIDATION.MIN_STOCK) {
      errors.push(`Stock quantity cannot be negative`);
    }
    if (stock > VALIDATION.MAX_STOCK) {
      errors.push(`Stock quantity cannot exceed ${VALIDATION.MAX_STOCK}`);
    }
  }

  // Description validation
  if (!data.description || typeof data.description !== 'string') {
    errors.push('Description is required and must be a string');
  } else {
    const description = data.description.trim();
    if (description.length < VALIDATION.MIN_DESCRIPTION_LENGTH) {
      errors.push(`Description must be at least ${VALIDATION.MIN_DESCRIPTION_LENGTH} characters long`);
    }
    if (description.length > VALIDATION.MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description must be no more than ${VALIDATION.MAX_DESCRIPTION_LENGTH} characters long`);
    }
  }

  // Category validation
  if (!data.category) {
    errors.push('Category is required');
  }

  // Image URL validation (basic)
  if (!data.imageUrl || typeof data.imageUrl !== 'string') {
    errors.push('Image URL is required and must be a string');
  } else {
    const imageUrl = data.imageUrl.trim();
    if (imageUrl.length === 0) {
      errors.push('Image URL cannot be empty');
    }
    // Basic URL validation
    try {
      new URL(imageUrl);
    } catch {
      errors.push('Please provide a valid image URL');
    }
  }

  return errors;
};

// Authorization middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Sanitize search query
const sanitizeSearchQuery = (query) => {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  // Remove special characters that could cause issues
  const sanitized = query.trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[&]/g, '&amp;') // Escape ampersands
    .substring(0, VALIDATION.MAX_SEARCH_LENGTH); // Limit length
  
  return sanitized;
};

// Pagination helper
const getPaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(
    VALIDATION.MAX_PAGE_SIZE, 
    Math.max(1, parseInt(req.query.limit) || VALIDATION.DEFAULT_PAGE_SIZE)
  );
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

const productController = {
  async getAllProducts(req, res) {
    try {
      logger.debug('Fetching products with pagination', { query: req.query });

      const { page, limit, skip } = getPaginationParams(req);
      
      // Get total count for pagination
      const totalProducts = await Product.countDocuments().catch(() => 0);
      const totalPages = Math.ceil(totalProducts / limit);

      logger.debug('Pagination info', { 
        page, 
        limit, 
        skip, 
        totalProducts, 
        totalPages 
      });

      // Fetch products with pagination
      const products = await Product.find()
        .skip(skip)
        .limit(limit)
        .catch(() => []);

      logger.debug('Products fetched', { count: products.length });

      if (!products || products.length === 0) {
        logger.debug('No products found');
        return res.render("pages/Products/products", {
          products: [],
          pagination: {
            page,
            limit,
            totalProducts,
            totalPages,
            hasNext: false,
            hasPrev: false
          },
          message: "No products available at the moment.",
        });
      }

      // Try to populate categories if available
      try {
        await Product.populate(products, { path: "category" });
        logger.debug('Categories populated successfully');
      } catch (populateError) {
        logger.error('Error populating categories', populateError);
        // Continue without populated categories
      }

      const pagination = {
        page,
        limit,
        totalProducts,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };

      res.render("pages/Products/products", {
        products: products,
        pagination,
        title: "Our Products",
      });
    } catch (error) {
      logger.error('Error in getAllProducts', error);
      
      // Return fallback data instead of error page
      res.render("pages/Products/products", {
        products: [],
        pagination: {
          page: 1,
          limit: VALIDATION.DEFAULT_PAGE_SIZE,
          totalProducts: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        message: "Unable to load products at the moment. Please try again later.",
        error: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  },

  async createProduct(req, res) {
    try {
      logger.debug('Creating product', { body: req.body });

      // Authorization check
      if (!req.user || req.user.role !== 'admin') {
        logger.debug('Unauthorized product creation attempt', { userId: req.user?._id });
        return res.status(403).json({
          success: false,
          error: "Admin access required to create products",
        });
      }

      const { name, price, description, stockQuantity, category, imageUrl } = req.body;

      // Validate input
      const validationErrors = validateProductInput(req.body);
      if (validationErrors.length > 0) {
        logger.debug('Product validation failed', { errors: validationErrors });
        return res.status(400).json({
          success: false,
          error: validationErrors.join(', '),
        });
      }

      // Verify category exists
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        logger.debug('Category not found', { categoryId: category });
        return res.status(400).json({
          success: false,
          error: "Invalid category selected",
        });
      }

      const product = new Product({
        name: name.trim(),
        price: parseFloat(price),
        description: description.trim(),
        stockQuantity: parseInt(stockQuantity),
        category,
        imageUrl: imageUrl.trim(),
        ProductID: Date.now(),
      });

      await product.save();
      
      logger.info('Product created successfully', { 
        productId: product._id, 
        name: product.name 
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        product,
      });
    } catch (error) {
      logger.error('Error creating product', error);
      res.status(500).json({
        success: false,
        error: "Error creating product. Please try again.",
      });
    }
  },

  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      logger.debug('Updating product', { productId: id, body: req.body });

      // Authorization check
      if (!req.user || req.user.role !== 'admin') {
        logger.debug('Unauthorized product update attempt', { userId: req.user?._id });
        return res.status(403).json({
          success: false,
          error: "Admin access required to update products",
        });
      }

      const { name, price, description, stockQuantity, category, imageUrl } = req.body;

      // Validate input
      const validationErrors = validateProductInput(req.body);
      if (validationErrors.length > 0) {
        logger.debug('Product validation failed', { errors: validationErrors });
        return res.status(400).json({
          success: false,
          error: validationErrors.join(', '),
        });
      }

      // Verify category exists
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        logger.debug('Category not found', { categoryId: category });
        return res.status(400).json({
          success: false,
          error: "Invalid category selected",
        });
      }

      const product = await Product.findByIdAndUpdate(
        id,
        {
          name: name.trim(),
          price: parseFloat(price),
          description: description.trim(),
          stockQuantity: parseInt(stockQuantity),
          category,
          imageUrl: imageUrl.trim(),
        },
        { new: true, runValidators: true }
      );

      if (!product) {
        logger.debug('Product not found for update', { productId: id });
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      logger.info('Product updated successfully', { 
        productId: product._id, 
        name: product.name 
      });

      res.json({
        success: true,
        message: "Product updated successfully",
        product,
      });
    } catch (error) {
      logger.error('Error updating product', error);
      res.status(500).json({
        success: false,
        error: "Error updating product. Please try again.",
      });
    }
  },

  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      logger.debug('Deleting product', { productId: id });

      // Authorization check
      if (!req.user || req.user.role !== 'admin') {
        logger.debug('Unauthorized product deletion attempt', { userId: req.user?._id });
        return res.status(403).json({
          success: false,
          error: "Admin access required to delete products",
        });
      }

      const product = await Product.findByIdAndDelete(id);

      if (!product) {
        logger.debug('Product not found for deletion', { productId: id });
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      logger.info('Product deleted successfully', { 
        productId: id, 
        name: product.name 
      });

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      logger.error('Error deleting product', error);
      res.status(500).json({
        success: false,
        error: "Error deleting product. Please try again.",
      });
    }
  },

  async getProductsByCategory(req, res) {
    try {
      const categoryId = req.params.categoryId;
      const category = await Category.findOne({ categoryID: categoryId });

      if (!category) {
        return res.render("pages/Products/category", {
          products: [],
          title: "Products",
          message: "Category not found.",
        });
      }

      const products = await Product.find({ category: category._id }).populate(
        "category"
      );

      res.render("pages/Products/category", {
        products: products,
        title: category.name,
        message: products.length === 0 ? "No products found in this category." : null
      });
    } catch (error) {
      console.error("Error getting products by category:", error);
      res.status(500).render("error", {
        error: "Error loading products. Please try again later.",
      });
    }
  },
  async getProductDetails(req, res) {
    try {
      const productId = req.params.id;
      const product = await Product.findById(productId).populate("category");

      if (!product) {
        return res.status(404).render("error", {
          message: "Product not found",
          error: {},
        });
      }

      res.render("pages/Details/details", {
        product: product,
        title: product.name,
      });
    } catch (error) {
      console.error("Error getting product details:", error);
      res.status(500).render("error", {
        message: "Error loading product details",
        error: process.env.NODE_ENV === "development" ? error : {},
      });
    }
  },
  async searchProducts(req, res) {
    try {
      const query = req.query.q;
      logger.debug('Search request', { query });

      if (!query) {
        logger.debug('No search query provided, redirecting to products');
        return res.redirect('/products');
      }

      // Sanitize search query
      const sanitizedQuery = sanitizeSearchQuery(query);
      
      if (!sanitizedQuery) {
        logger.debug('Search query sanitized to empty, redirecting to products');
        return res.redirect('/products');
      }

      logger.debug('Searching with sanitized query', { sanitizedQuery });

      const products = await Product.find({
        $or: [
          { name: { $regex: sanitizedQuery, $options: 'i' } },
          { description: { $regex: sanitizedQuery, $options: 'i' } }
        ]
      }).populate('category').lean().catch(() => []);

      logger.debug('Search results', { 
        query: sanitizedQuery, 
        resultsCount: products.length 
      });

      res.render('pages/Products/category', {
        title: `Search Results for "${sanitizedQuery}"`,
        products,
        message: products.length === 0 ? 'No products found matching your search.' : null
      });
    } catch (error) {
      logger.error('Search error', error);
      
      // Return fallback instead of error page
      res.render('pages/Products/category', {
        title: 'Search Results',
        products: [],
        message: 'Unable to perform search at the moment. Please try again later.',
        error: process.env.NODE_ENV === 'development' ? error.message : null
      });
    }
  },
};

module.exports = productController;

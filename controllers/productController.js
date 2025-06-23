const Product = require("../models/Products");
const Category = require("../models/Category");

const productController = {
  async getAllProducts(req, res) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log("Attempting to fetch products...");
      }
      // First get products without population
      const products = await Product.find();
      if (process.env.NODE_ENV === 'development') {
        console.log("Products found:", products.length); // Log number of products found
      }

      if (!products || products.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log("No products found in database");
        }
        return res.render("pages/Products/products", {
          products: [],
          message: "No products available at the moment.",
        });
      }

      // Try to populate categories if available
      try {
        await Product.populate(products, { path: "category" }); //fills category info in each product
      } catch (populateError) {
        console.error("Error populating categories:", populateError);
        // Continue without populated categories
      }

      res.render("pages/Products/products", {
        products: products,
        title: "Our Products",
      });
    } catch (error) {
      console.error("Detailed error in getAllProducts:", error);
      console.error("Error stack:", error.stack);
      res.status(500).render("error", {
        error: "Error loading products. Please try again later.",
      });
    }
  },

  async createProduct(req, res) {
    try {
      const { name, price, description, stockQuantity, category, imageUrl } =
        req.body;

      const product = new Product({
        name,
        price,
        description,
        stockQuantity,
        category,
        imageUrl,
        ProductID: Date.now(), // Generate unique ProductID
      });

      await product.save();
      res.status(201).json({
        success: true,
        message: "Product created successfully",
        product,
      });
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({
        success: false,
        error: "Error creating product. Please try again.",
      });
    }
  },

  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const { name, price, description, stockQuantity, category, imageUrl } =
        req.body;

      const product = await Product.findByIdAndUpdate(
        id,
        {
          name,
          price,
          description,
          stockQuantity,
          category,
          imageUrl,
        },
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      res.json({
        success: true,
        message: "Product updated successfully",
        product,
      });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({
        success: false,
        error: "Error updating product. Please try again.",
      });
    }
  },

  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await Product.findByIdAndDelete(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting product:", error);
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
      if (!query) {
        return res.redirect('/products');
      }

      const products = await Product.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ]
      }).populate('category').lean();

      res.render('pages/Products/category', {
        title: `Search Results for "${query}"`,
        products,
        message: products.length === 0 ? 'No products found matching your search.' : null
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).render('error', {
        message: 'Error performing search',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  },
};

module.exports = productController;

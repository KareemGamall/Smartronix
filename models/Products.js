const mongoose = require("mongoose");
const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    ProductID: {
      type: Number,
      required: true,
      unique: true,
    },
    
    // Discount fields
    hasDiscount: {
      type: Boolean,
      default: false,
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    discountStartDate: {
      type: Date,
      default: null,
    },
    discountEndDate: {
      type: Date,
      default: null,
    },
    originalPrice: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for better query performance
ProductSchema.index({ hasDiscount: 1, discountEndDate: 1 });
ProductSchema.index({ featured: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ stockQuantity: 1 });

module.exports = mongoose.model("Product", ProductSchema);

const mongoose = require("mongoose");
const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    categoryID: { type: Number, required: true, unique: true },
    iconClass: { type: String, default: '' }, // Custom icon class field
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model("Category", CategorySchema);

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  id: { type: String, required: false},
  name: { type: String, required: true }, 
  description: { type: String }, 
  price: { type: Number, required: true }, 
  stock: { type: Number, default: 0 }, 
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  pharmacy_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' },
  main_img_url: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
}, { timestamps: true });
  
module.exports = mongoose.model('Product', ProductSchema);

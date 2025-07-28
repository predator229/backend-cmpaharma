const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: false, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  subcategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  level: { type: Number, default: 0 },
  
  imageUrl: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false },
  iconUrl: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false },
  
  status: { type: String, enum: ['active', 'inactive', 'deleted'], default: 'active' },
  displayOrder: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true },
  
  metaTitle: { type: String, required: false },
  metaDescription: { type: String, required: false },
  keywords: [{ type: String }],
  
  productCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  
  requiresPrescription: { type: Boolean, default: false },
  restrictions: [{ type: String, default: null }],
  specialCategory: { type: String, enum: ['otc', 'prescription', 'homeopathy', 'medical_device', 'supplement', 'cosmetic'], default: 'otc' },

  pharmaciesList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true }],
}, {
  timestamps: true
});

CategorySchema.index({ name: 'text', description: 'text' });
CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ parentCategory: 1, status: 1 });
CategorySchema.index({ level: 1, displayOrder: 1 });

module.exports = mongoose.model('Category', CategorySchema);

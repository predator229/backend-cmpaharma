const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: false, trim: true },
  shortDescription: { type: String, required: false, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  
  // Classification
  // category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  
  // Informations pharmaceutiques
  barcode: { type: String, required: false, unique: true, sparse: true },
  sku: { type: String, required: true, unique: true, trim: true },
  cipCode: { type: String, required: false, unique: true, sparse: true }, // Code CIP pour les médicaments
  laboratoire: { type: String, required: false, trim: true },
  marque: { type: String, required: false, trim: true },
  
  // Prix et stock
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, required: false, min: 0 },
  discountPercentage: { type: Number, required: false, min: 0, max: 100 },
  cost: { type: Number, required: false, min: 0 }, // Prix d'achat
  
  // Statut et visibilité
  status: { type: String, enum: ['active', 'inactive', 'deleted', 'out_of_stock', 'discontinued'], default: 'active' },
  isVisible: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isOnSale: { type: Boolean, default: false },
  
  // Médias
  images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  mainImage: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false },
  
  // Caractéristiques pharmaceutiques
  requiresPrescription: { type: Boolean, default: false },
  prescriptionType: { type: String, enum: ['none', 'simple', 'renewable', 'restricted'], default: 'none' },
  drugForm: { type: String, required: false }, // forme galénique (comprimé, gélule, sirop, etc.)
  dosage: { type: String, required: false },
  packaging: { type: String, required: false }, // conditionnement
  activeIngredients: [{ 
    name: { type: String, required: true },
    dosage: { type: String, required: false }
  }],
  
  // Restrictions et avertissements
  ageRestriction: {
    minAge: { type: Number, required: false },
    maxAge: { type: Number, required: false }
  },
  contraindications: [{ type: String }],
  sideEffects: [{ type: String }],
  warnings: [{ type: String }],
  
  // Classification thérapeutique
  therapeuticClass: { type: String, required: false },
  pharmacologicalClass: { type: String, required: false },
  indicationsTherapeutiques: [{ type: String }],
  
  // Dimensions et poids
  dimensions: {
    length: { type: Number, required: false }, // en cm
    width: { type: Number, required: false },  // en cm
    height: { type: Number, required: false }, // en cm
  },
  weight: { type: Number, required: false }, // en grammes
  
  // SEO
  metaTitle: { type: String, required: false },
  metaDescription: { type: String, required: false },
  keywords: [{ type: String }],
  
  // Statistiques
  viewCount: { type: Number, default: 0 },
  salesCount: { type: Number, default: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewCount: { type: Number, default: 0 },
  
  // Dates importantes
  manufacturingDate: { type: Date, required: false },
  expiryDate: { type: Date, required: false },
  launchDate: { type: Date, default: Date.now },
  
  // Relations avec les pharmacies
  pharmacies: [{
    pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
    // stock: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: false, min: 0 }, // Prix spécifique à cette pharmacie
    isAvailable: { type: Boolean, default: true },
    // reservedStock: { type: Number, default: 0, min: 0 },
    // lastStockUpdate: { type: Date, default: Date.now }
  }],
  
  // Stock global (calculé automatiquement)
  // totalStock: { type: Number, default: 0, min: 0 },
  // lowStockThreshold: { type: Number, default: 10, min: 0 },
  // isLowStock: { type: Boolean, default: false },
  
  // Informations complémentaires
  instructions: { type: String, required: false }, // mode d'emploi
  storage: { type: String, required: false }, // conditions de conservation
  origin: { type: String, required: false }, // pays d'origine
  
  // Produits liés
  relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  alternatives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  
  // Promotions
  promotions: [{
    title: { type: String, required: true },
    description: { type: String, required: false },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
  }],
  
  // Informations de livraison
  deliveryInfo: {
    isFragile: { type: Boolean, default: false },
    requiresColdChain: { type: Boolean, default: false }, // chaîne du froid
    maxDeliveryTime: { type: Number, required: false }, // en heures
    specialHandling: { type: String, required: false }
  }
}, {
  timestamps: true
});

// Index pour les recherches
ProductSchema.index({ name: 'text', description: 'text', shortDescription: 'text' });
ProductSchema.index({ category: 1, status: 1 });
// ProductSchema.index({ barcode: 1 }, { unique: true, sparse: true });
// ProductSchema.index({ sku: 1 }, { unique: true });
// ProductSchema.index({ cipCode: 1 }, { unique: true, sparse: true });
ProductSchema.index({ price: 1 });
ProductSchema.index({ isFeatured: 1, status: 1 });
ProductSchema.index({ 'pharmacies.pharmacy': 1 });
ProductSchema.index({ requiresPrescription: 1 });
ProductSchema.index({ therapeuticClass: 1 });

// Index composé pour les recherches avancées
ProductSchema.index({ category: 1, price: 1, status: 1 });
ProductSchema.index({ 'pharmacies.pharmacy': 1, 'pharmacies.isAvailable': 1 });

// // Middleware pour calculer le stock total
// ProductSchema.pre('save', function(next) {
//   if (this.pharmacies && this.pharmacies.length > 0) {
//     this.totalStock = this.pharmacies.reduce((total, pharmacy) => {
//       return total + (pharmacy.isAvailable ? pharmacy.stock : 0);
//     }, 0);
//     this.isLowStock = this.totalStock <= this.lowStockThreshold;
//   }
//   next();
// });

module.exports = mongoose.model('Product', ProductSchema);
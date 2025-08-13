const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  description: { type: String, required: false },
  
  // Type et valeur de réduction
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  maxDiscount: { type: Number, required: false, min: 0 }, // Pour les pourcentages
  
  // Conditions d'utilisation
  minimumOrderAmount: { type: Number, default: 0, min: 0 },
  maximumOrderAmount: { type: Number, required: false, min: 0 },
  
  // Validité
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  
  // Limites d'utilisation
  usageLimit: { type: Number, required: false, min: 1 }, // Limite globale
  usagePerClient: { type: Number, default: 1, min: 1 }, // Limite par client
  currentUsage: { type: Number, default: 0, min: 0 },
  
  // Restrictions
  applicableProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  excludedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  applicablePharmacies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' }],
  
  // Statut
  status: { type: String, enum: ['active', 'inactive', 'expired'], default: 'active' },
  isPublic: { type: Boolean, default: true }, // Coupon public ou privé
  
  // Clients éligibles (pour coupons privés)
  eligibleClients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }],
  
  // Statistiques
  timesUsed: { type: Number, default: 0 },
  totalDiscountGiven: { type: Number, default: 0 },
  
  // Créateur
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false }
}, {
  timestamps: true
});

// Indexes pour Coupon
CouponSchema.index({ code: 1 });
CouponSchema.index({ startDate: 1, endDate: 1 });
CouponSchema.index({ status: 1 });

module.exports = mongoose.model('Coupon', CouponSchema);
const mongoose = require('mongoose');

const ReviewProductSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: false },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, required: false, trim: true },
  comment: { type: String, required: false, trim: true },
  
  // Aspects spécifiques
  aspects: {
    quality: { type: Number, min: 1, max: 5, required: false },
    service: { type: Number, min: 1, max: 5, required: false },
    delivery: { type: Number, min: 1, max: 5, required: false },
    value: { type: Number, min: 1, max: 5, required: false }
  },
  
  // Statut et modération
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'flagged'], default: 'pending' },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
  moderationNote: { type: String, required: false },
  
  // Utilité
  helpfulVotes: { type: Number, default: 0 },
  unhelpfulVotes: { type: Number, default: 0 },
  
  // Informations additionnelles
  isVerifiedPurchase: { type: Boolean, default: false },
  wouldRecommend: { type: Boolean, required: false },
  
  // Réponse de la pharmacie
  pharmacyResponse: {
    message: { type: String, required: false },
    respondedAt: { type: Date, required: false },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false }
  }
}, {
  timestamps: true
});

// Indexes pour Review
ReviewSchema.index({ product: 1, status: 1 });
ReviewSchema.index({ pharmacy: 1, status: 1 });
ReviewSchema.index({ customer: 1 });
ReviewSchema.index({ rating: 1 });

module.exports = mongoose.model('ReviewProduct', ReviewProductSchema);
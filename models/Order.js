const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  // Référence unique
  orderNumber: { type: String, required: true, unique: true },
  
  // Relations
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  
  // Statut de la commande
  status: { 
    type: String, 
    enum: [
      'pending',           // En attente
      'confirmed',         // Confirmée
      'prescription_pending', // En attente de prescription
      'preparing',         // En préparation
      'ready_for_pickup',  // Prête pour retrait
      'out_for_delivery',  // En cours de livraison
      'delivered',         // Livrée
      'completed',         // Terminée
      'cancelled',         // Annulée
      'returned',          // Retournée
      'refunded'           // Remboursée
    ], 
    default: 'pending' 
  },
  
  // Articles commandés
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    prescriptionRequired: { type: Boolean, default: false },
    prescriptionProvided: { type: Boolean, default: false },
    prescriptionDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false }
  }],
  
  // Totaux
  subtotal: { type: Number, required: true, min: 0 },
  shippingCost: { type: Number, default: 0, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  discountAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  
  // Informations de livraison
  deliveryInfo: {
    method: { type: String, enum: ['home_delivery', 'pickup', 'express', 'scheduled'], required: true },
    address: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
      phone: { type: String, required: false },
      instructions: { type: String, required: false }
    },
    estimatedDeliveryDate: { type: Date, required: false },
    actualDeliveryDate: { type: Date, required: false },
    trackingNumber: { type: String, required: false },
    deliveryProvider: { type: String, required: false }
  },
  
  // Paiement
  payment: {
    method: { type: String, enum: ['card', 'paypal', 'bank_transfer', 'cash', 'insurance'], required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'], default: 'pending' },
    transactionId: { type: String, required: false },
    paidAt: { type: Date, required: false },
    refundAmount: { type: Number, default: 0, min: 0 },
    refundReason: { type: String, required: false }
  },
  
  // Coupon/Promotion
  coupon: {
    code: { type: String, required: false },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: false },
    discountValue: { type: Number, required: false, min: 0 },
    appliedDiscount: { type: Number, default: 0, min: 0 }
  },
  
  // Notes et commentaires
  clientNotes: { type: String, required: false },
  pharmacyNotes: { type: String, required: false },
  internalNotes: { type: String, required: false },
  
  // Dates importantes
  orderDate: { type: Date, default: Date.now },
  confirmedAt: { type: Date, required: false },
  shippedAt: { type: Date, required: false },
  deliveredAt: { type: Date, required: false },
  completedAt: { type: Date, required: false },
  
  // Historique des statuts
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, required: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false }
  }],
  
  // Informations de retour/échange
  returnInfo: {
    isReturnable: { type: Boolean, default: true },
    returnReason: { type: String, required: false },
    returnDate: { type: Date, required: false },
    refundStatus: { type: String, enum: ['none', 'requested', 'approved', 'processed'], default: 'none' }
  }
}, {
  timestamps: true
});

// Indexes pour Order
OrderSchema.index({ customer: 1, status: 1 });
OrderSchema.index({ pharmacy: 1, status: 1 });
OrderSchema.index({ orderDate: -1 });
OrderSchema.index({ 'payment.status': 1 });

OrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Compter les commandes du jour
    const startOfDay = new Date(year, date.getMonth(), date.getDate());
    const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);
    
    const dailyCount = await this.constructor.countDocuments({
      orderDate: { $gte: startOfDay, $lt: endOfDay }
    });
    
    const orderNumber = `CMD${year}${month}${day}${String(dailyCount + 1).padStart(4, '0')}`;
    this.orderNumber = orderNumber;
  }
  next();
});

// Middleware pour mettre à jour les totaux de commande
OrderSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  this.totalAmount = this.subtotal + this.shippingCost + this.taxAmount - this.discountAmount;
  next();
});


module.exports = mongoose.model('Order', OrderSchema);

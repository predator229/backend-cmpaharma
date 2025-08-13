const mongoose = require('mongoose');

const NotificationCustomerSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  
  type: { 
    type: String, 
    enum: [
      'order_confirmed',
      'order_shipped',
      'order_delivered',
      'prescription_needed',
      'prescription_validated',
      'promotion',
      'stock_alert',
      'payment_failed',
      'account_update'
    ], 
    required: true 
  },
  
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Données liées
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  relatedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  
  // Canaux de notification
  channels: {
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true }
  },
  
  // Statut
  status: { type: String, enum: ['pending', 'sent', 'delivered', 'failed'], default: 'pending' },
  readAt: { type: Date, required: false },
  sentAt: { type: Date, required: false },
  
  // Métadonnées
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  expiresAt: { type: Date, required: false }
}, {
  timestamps: true
});

// Indexes pour Notification
NotificationSchema.index({ recipient: 1, readAt: 1 });
NotificationSchema.index({ type: 1, status: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(Notification, NotificationCustomerSchema);
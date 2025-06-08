const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: false},
  description: { type: String }, 
  totalAmount: { type: Number, required: true }, 
  stock: { type: Number, default: 0 }, 
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending'},
  paymentStatus: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid'},
  deliveryStatus: { type: String, enum: ['pending', 'on-the-way', 'delivered'], default: 'pending'},
  deliver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Deliver' },
  pharmacy_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  imageUrl: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
}, { timestamps: true });
  
module.exports = mongoose.model('Order', OrderSchema);

const mongoose = require('mongoose');

const MedicationOrderSchema = new mongoose.Schema({
    customerId: { type: String, required: true },
    pharmacyId: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: Number, required: true },
    orderDate: { type: Date, required: true },
    deliveryDate: { type: Date},
    deliveryAddress: { type: String, required: true },
    deliveryPersonId: { type: String, required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MedicationItem', required: true}],
  }, { timestamps: true });
  
  module.exports = mongoose.model('MedicationOrder', MedicationOrderSchema);
  
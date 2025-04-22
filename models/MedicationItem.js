const mongoose = require('mongoose');

const MedicationItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
  }, { timestamps: true });

  module.exports = mongoose.model('MedicationItem', MedicationItemSchema);

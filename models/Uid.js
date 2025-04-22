const mongoose = require('mongoose');

const uidSchema = new mongoose.Schema({
  uid: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Uid', uidSchema);

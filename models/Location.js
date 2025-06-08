const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: false },
}, { timestamps: true });
  
module.exports = mongoose.model('Location', LocationSchema);

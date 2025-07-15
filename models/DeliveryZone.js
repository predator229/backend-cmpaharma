const mongoose = require('mongoose');

const DeliveryZoneSchema = new mongoose.Schema({
  type: { type: String, enum: ['zone', 'city', 'radius'], required: true,default: 'city'},
  coordinates: { type: mongoose.Schema.Types.ObjectId, ref: 'ZoneCoordinates', required: false },
  radius: { type: Number, default: 20,min: 1,max: 50, required: false},
  isActive: { type: Boolean, default: true },
  maxSelectionArea: {  type: Number,  default: 1000, required:false }
}, { timestamps: true });

module.exports = mongoose.model('DeliveryZone', DeliveryZoneSchema);

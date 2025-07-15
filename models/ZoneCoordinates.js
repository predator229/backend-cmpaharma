const mongoose = require('mongoose');

const ZoneCoordinatesSchema = new mongoose.Schema({
  points: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true }],
}, { timestamps: true });

module.exports = mongoose.model('ZoneCoordinates', ZoneCoordinatesSchema);
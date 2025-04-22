const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  emoji: { type: String, required: true },
  code: { type: String, required: true },
  dial_code: { type: String, required: true }  
}, { timestamps: true });
  
module.exports = mongoose.model('Country', countrySchema);
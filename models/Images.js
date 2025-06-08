const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  description: { type: String, required: false },
  type: { type: String, required: true },
  id_object: { type: String, required: true },
}, { timestamps: true });
  
module.exports = mongoose.model('Image', ImageSchema);

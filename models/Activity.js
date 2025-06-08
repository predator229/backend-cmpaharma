const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: { type: String, required: true },
  id_object: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: false },
}, { timestamps: true });
  
module.exports = mongoose.model('Activity', activitySchema);

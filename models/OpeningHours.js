const mongoose = require('mongoose');

const OpeningHoursSchema = new mongoose.Schema({
  open: { type: Boolean, default: true },
  opening: { type: String, default: '09:00' },
  closing: { type: String, default: '18:00' },
  day: { 
    type: Number, 
    required: true,
    min: [1, 'Day must be at least 1 (Monday)'],
    max: [7, 'Day must be at most 7 (Sunday)'],
    validate: {
      validator: Number.isInteger,
      message: 'Day must be an integer'
    }
  }
}, { timestamps: true });

OpeningHoursSchema.index({ day: 1 });

module.exports = mongoose.model('OpeningHours', OpeningHoursSchema);
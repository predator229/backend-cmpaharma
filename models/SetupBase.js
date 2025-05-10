const mongoose = require('mongoose');

const setupbaseSchema = new mongoose.Schema({
    id: { type: String, required: false },
    font_family: { type: String, required: true },
    font_size: { type:  Number, required: true },
    theme: { type: String, required: true, enum: ['light', 'dark'] },
    isCollapse_menu: { type: Boolean, required: true },
}, { timestamps: true });
  
module.exports = mongoose.model('SetupBase', setupbaseSchema);

const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    module: { type: String, required: true }, 
    label: { type: String }, 
    plateform: { type: String, enum: ['Admin', 'Pharmacy', 'Deliver'], required: true },
    description: { type: String },
    createdBy: { type: String, default: 'System' },
    permissions: [ { type: String, required: true },],
}, { timestamps: true });

module.exports = mongoose.model('Permission', permissionSchema);

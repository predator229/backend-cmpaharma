const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  code: { type: String, enum: [ 'superadmin', 'admin', 'manager', 'pharmacist-owner', 'pharmacist-manager' ], required: true, unique: true },
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  plateform: { type: String, required: true, enum: ['Admin', 'Pharmacy', 'Deliver'] },
  createdBy: { type: String, default: 'System' },
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
}, { timestamps: true });

module.exports = mongoose.model('Group', GroupSchema);

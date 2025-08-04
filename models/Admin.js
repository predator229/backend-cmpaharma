const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  // plateform: { type: String, enum: [ 'pharmacie', 'admin'], required: true, unique: true },
  uids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Uid' }],
  email: { type: String, required: false, unique: false },
  name: { type: String, required: false },
  surname: { type: String, required: false },

  photoURL: { type: String, required: false },
  disabled: { type: Boolean, default: false },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: false },
  city: { type: String, required: false },
  address: { type: String, required: false },
  mobils: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mobil' }],
  phone: { type: mongoose.Schema.Types.ObjectId, ref: 'Mobil' },

  pharmaciesManaged: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: false }],

  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: false }],
  setups: { type: mongoose.Schema.Types.ObjectId, ref: 'SetupBase', required: true },

  isActivated: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);

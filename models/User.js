const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Uid' }],
  email: { type: String, required: false, unique: true },
  name: { type: String, required: true },
  photoURL: { type: String, required: false },
  disabled: { type: Boolean, default: false },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
  city: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  address: { type: String, required: true },
  mobils: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mobil' }],

  vehicleType: { type: String, required: true },
  marqueVehicule: { type: String, required: false },
  modelVehicule: { type: String, required: false },
  anneeVehicule: { type: String, required: false },
  nrEssieux: { type: String, required: false },
  capaciteCharge: { type: String, required: false },
  nrImmatriculation: { type: String, required: false },
  nrAssurance: { type: Date, required: false },
  nrChassis: { type: String, required: false },
  nrPermis: { type: String, required: false },
  nrVisiteTechnique: { type: Date, required: false },
  nrCarteGrise: { type: String, required: false },
  nrContrat: { type: String, required: false },

  coins: { type: Number, default: 0 },

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

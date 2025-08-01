const mongoose = require('mongoose');

const PharmacySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },

  city: { type: String, required: true, trim: true },
  country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
  comentaire: { type: String, default: null },

  logoUrl: { type: mongoose.Schema.Types.ObjectId, ref: 'Image', required: false },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
  licenseNumber: { type: String, required: false }, //unique: true
  siret: { type: String, required: false }, //unique: true
  phoneNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/.+\@.+\..+/, 'Please fill a valid email address'] },
  status: { type: String, enum: ['active', 'inactive', 'deleted', 'pending', 'rejected', 'suspended'], default: 'pending' },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "Location", required: false },
  suspensionDate: { type: Date, default: null },
  suspensionReason: { type: String, default: null },
  registerDate: { type: Date, default: Date.now },
  rating: { type: Number, min: 0, max: 5, default: null },
  workingHours: [{type: mongoose.Schema.Types.ObjectId, ref: 'OpeningHours', required: false}],

  isValidated: { type: Boolean, default: false },

  documents: {
    logo: { type: mongoose.Schema.Types.ObjectId, ref: 'File' , required: false},
    license: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false},
    idDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false},
    insurance: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: false},
  },

  deliveryZone: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryZone', required: false, default: null },
  cityBounds: { type: mongoose.Schema.Types.ObjectId, ref: 'ZoneCoordinates', required: false, default: null },
  deliveryServices: {
    homeDelivery: { type: Boolean, default: true },
    pickupInStore: { type: Boolean, default: true },
    expressDelivery: { type: Boolean, default: false },
    scheduledDelivery: { type: Boolean, default: false }
  },
}, {
  timestamps: true
});

PharmacySchema.index({ name: 'text', address: 'text' });
PharmacySchema.index(
  { licenseNumber: 1 },
  { unique: true, partialFilterExpression: { licenseNumber: { $type: "string" } } }
);
PharmacySchema.index(
  { siret: 1 },
  { unique: true, partialFilterExpression: { siret: { $type: "string" } } }
);

module.exports = mongoose.model('Pharmacy', PharmacySchema);
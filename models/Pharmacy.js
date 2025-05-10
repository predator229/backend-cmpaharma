const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LocationSchema = new Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  }
});

const OpeningHoursSchema = new Schema({
  open: {
    type: Boolean,
    default: true
  },
  opening: {
    type: String,
    default: '09:00'
  },
  closing: {
    type: String,
    default: '18:00'
  }
});

const WorkingHoursSchema = new Schema({
  Lundi: OpeningHoursSchema,
  Mardi: OpeningHoursSchema,
  Mercredi: OpeningHoursSchema,
  Jeudi: OpeningHoursSchema,
  Vendredi: OpeningHoursSchema,
  Samedi: OpeningHoursSchema,
  Dimanche: OpeningHoursSchema
});

const ProductSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  price: {
    type: Number,
    required: true
  },
  imageUrl: {
    type: String
  },
  stock: {
    type: Number,
    default: 0
  },
  category: {
    type: String
  }
});

const OrderSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  customer: {
    type: String,
    required: true
  },
  products: [ProductSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'unpaid'],
    default: 'unpaid'
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'on-the-way', 'delivered'],
    default: 'pending'
  },
  deliveryPerson: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const PharmacySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  logoUrl: {
    type: String,
    default: null
  },
  ownerId: {
    type: String,
    required: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true
  },
  siret: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deleted', 'pending', 'rejected', 'suspended'],
    default: 'pending'
  },
  location: {
    type: LocationSchema,
    required: true
  },
  products: {
    type: [ProductSchema],
    default: []
  },
  workingHours: {
    type: WorkingHoursSchema,
    default: () => ({}) // Default working hours will be set during creation
  },
  openingHours: {
    type: Map,
    of: OpeningHoursSchema,
    default: () => ({}) // Default opening hours will be set during creation
  },
  orders: {
    type: [OrderSchema],
    default: []
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  suspensionDate: {
    type: Date,
    default: null
  },
  suspensionReason: {
    type: String,
    default: null
  },
  registerDate: {
    type: Date,
    default: Date.now
  },
  orders30days: {
    type: Number,
    default: 0
  },
  revenue30days: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: null
  }
}, {
  timestamps: true
});

PharmacySchema.index({ name: 'text', address: 'text' });
PharmacySchema.index({ status: 1 });
PharmacySchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

PharmacySchema.virtual('id').get(function() {
  return this._id.toHexString();
});

PharmacySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Pharmacy', PharmacySchema);
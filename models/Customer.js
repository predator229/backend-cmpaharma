const mongoose = require('mongoose');

const ClustormerSchema = new mongoose.Schema({
  // Informations personnelles
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  phones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mobil', required: true }],
  defaultPhone: { type: mongoose.Schema.Types.ObjectId, ref: 'Mobil', required: false },

  dateOfBirth: { type: Date, required: false },
  gender: { type: String, enum: ['male', 'female', 'other'], required: false },
    
  // Statut du compte
  status: { type: String, enum: ['active', 'inactive', 'suspended', 'deleted'], default: 'active' },
  isBlacklisted: { type: Boolean, default: false },
  blacklistReason: { type: String, required: false },
  
  // Adresses
  addresses: [{
    type: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    isDefault: { type: Boolean, default: false },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    phone: { type: String, required: false },
    instructions: { type: String, required: false } // Instructions de livraison
  }],
  
  // Informations médicales (optionnelles)
  medicalInfo: {
    allergies: [{ type: String }],
    chronicConditions: [{ type: String }],
    currentMedications: [{ type: String }],
    emergencyContact: {
      name: { type: String, required: false },
      phone: { type: String, required: false },
      relationship: { type: String, required: false }
    }
  },
  
  // Préférences
  preferences: {
    newsletter: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    preferredPharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: false },
    language: { type: String, default: 'fr' },
    currency: { type: String, default: 'EUR' }
  },
  
  // Statistiques
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  averageOrderValue: { type: Number, default: 0 },
  lastOrderDate: { type: Date, required: false },
  registrationDate: { type: Date, default: Date.now },
  lastLoginDate: { type: Date, required: false },
  
  // Programme de fidélité
  loyaltyPoints: { type: Number, default: 0 },
  loyaltyTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  
  // Documents d'identité (pour certaines prescriptions)
  identityDocument: {
    type: { type: String, enum: ['passport', 'id_card', 'driver_license'], required: false },
    number: { type: String, required: false },
    expiryDate: { type: Date, required: false },
    verified: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});
module.exports = mongoose.model('Clustormer', ClustormerSchema);
const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  pharmacy: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
  
  // Informations du médecin
  doctor: {
    name: { type: String, required: true },
    rppsNumber: { type: String, required: false }, // Numéro RPPS du médecin
    specialty: { type: String, required: false },
    address: { type: String, required: false },
    phone: { type: String, required: false }
  },
  
  // Document d'ordonnance
  prescriptionDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  prescriptionNumber: { type: String, required: false },
  issueDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  
  // Médicaments prescrits
  medications: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
    medicationName: { type: String, required: true },
    dosage: { type: String, required: true },
    quantity: { type: Number, required: true },
    instructions: { type: String, required: false },
    duration: { type: String, required: false }, // Durée du traitement
    substitutionAllowed: { type: Boolean, default: true }
  }],
  
  // Statut
  status: { 
    type: String, 
    enum: ['pending', 'validated', 'partially_filled', 'filled', 'rejected', 'expired'], 
    default: 'pending' 
  },
  
  // Validation
  validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
  validatedAt: { type: Date, required: false },
  validationNotes: { type: String, required: false },
  
  // Informations complémentaires
  patientInfo: {
    age: { type: Number, required: false },
    weight: { type: Number, required: false }, // en kg
    allergies: [{ type: String }],
    chronicConditions: [{ type: String }]
  }
}, {
  timestamps: true
});

// Indexes pour Prescription
PrescriptionSchema.index({ customer: 1, status: 1 });
PrescriptionSchema.index({ pharmacy: 1, status: 1 });
PrescriptionSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Prescription', PrescriptionSchema);

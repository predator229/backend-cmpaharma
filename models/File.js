const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  originalName: { type: String, required: true }, // Nom original du fichier uploadé
  fileName: { type: String, required: true },     // Nom stocké (dans S3, local, etc.)
  fileType: { type: String, required: true },     // MIME type (ex: image/png, application/pdf)
  fileSize: { type: Number, required: true },     // Taille en octets
  url: { type: String, required: true },          // URL d’accès (CDN, S3, etc.)
  extension: { type: String, required: false },   // Exemple : "pdf", "jpg", "png"

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
  linkedTo: {                                      // Référence polymorphique si besoin
    model: { type: String },                      // "Pharmacy", "User", etc.
    objectId: { type: mongoose.Schema.Types.ObjectId }
  },

  tags: [{ type: String }],                       // Exemples : ["license", "idCard"]
  isPrivate: { type: Boolean, default: false },   // Si le fichier est restreint
  expiresAt: { type: Date, default: null },       // Pour les fichiers temporaires

  meta: {                                          // Métadonnées techniques optionnelles
    width: { type: Number },                      // Pour images
    height: { type: Number },
    pages: { type: Number }                       // Pour PDFs
  }
}, {
  timestamps: true
});

FileSchema.index({ fileName: 1 });
FileSchema.index({ "linkedTo.model": 1, "linkedTo.objectId": 1 });

module.exports = mongoose.model('File', FileSchema);

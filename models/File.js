const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  originalName: { type: String, required: true }, 
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  url: { type: String, required: true },
  extension: { type: String, required: false },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: false },
  linkedTo: {
    model: { type: String },
    objectId: { type: mongoose.Schema.Types.ObjectId }
  },

  tags: [{ type: String }],
  isPrivate: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },

  meta: {
    width: { type: Number },
    height: { type: Number },
    pages: { type: Number }
  }
}, {
  timestamps: true
});

FileSchema.index({ fileName: 1 });
FileSchema.index({ "linkedTo.model": 1, "linkedTo.objectId": 1 });

module.exports = mongoose.model('File', FileSchema);

const mongoose = require('mongoose');

const MiniChatAttachementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['image', 'document'] },
  url: { type: String, required: true },
  size: { type: Number, required: true },

  isActivated: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date},
}, { timestamps: true });

module.exports = mongoose.model('MiniChatAttachement', MiniChatAttachementSchema);

const mongoose = require('mongoose');

const minichatmessageSchema = new mongoose.Schema({

  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderType: { type: String, required: true, enum: ['admin', 'pharmacy'] },

  for: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmarcy', required: false },
  message: { type: String, required: false },
  attachments : [{ type: mongoose.Schema.Types.ObjectId, ref : 'MiniChatAttachement', required:false }],
  isActivated: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  seen: { type: Boolean, default: false },
  seenAt: { type: Date},
  deletedAt: { type: Date},
}, { timestamps: true });

module.exports = mongoose.model('MiniChatMessage', minichatmessageSchema);

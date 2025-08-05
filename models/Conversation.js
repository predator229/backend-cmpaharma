
  const mongoose = require('mongoose');
  
  const ConversationSchema = new mongoose.Schema({

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }],
    groupName: { type: String, required: false },
    unreadCount: { type: Number, default: 0 },
    isActivated: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    isGroup: { type: Boolean, default: false },
  }, { timestamps: true });
  
  module.exports = mongoose.model('Conversation', ConversationSchema);
  
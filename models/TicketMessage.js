// models/TicketMessage.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TicketMessageSchema = new Schema({
  content: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  attachments: [{ type: Schema.Types.ObjectId, ref: 'File' }],

  isInternal: { type: Boolean, default: false },
  seen: { type: Boolean, default: false },
  seenAt: { type: Date },
  editedAt: { type: Date },

}, { timestamps: true }); // auto adds createdAt & updatedAt

// Instance method
TicketMessageSchema.methods.markAsRead = function () {
  this.seen = true;
  this.seenAt = new Date();
  return this.save();
};

TicketMessageSchema.methods.edit = function (newContent) {
  this.content = newContent;
  this.editedAt = new Date();
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('TicketMessage', TicketMessageSchema);

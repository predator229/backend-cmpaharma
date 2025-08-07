// models/Ticket.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TicketSchema = new Schema({
  ticketNumber: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String },
  
  category: {
    type: String,
    enum: ['technical', 'billing', 'account', 'feature_request', 'bug_report', 'general'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed', 'pending'],
    default: 'open'
  },

  // Participants
  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  assignedTo: {
    _id: { type: Schema.Types.ObjectId, ref: 'Admin' },
    name: { type: String },
    email: { type: String },
    type: { type: String, enum: ['admin'] }
  },

  pharmacy: { type: Schema.Types.ObjectId, ref: 'Pharmacy', required: true },

  // Contenu
  messages: [{ type: Schema.Types.ObjectId, ref: 'TicketMessage' }],
  attachments: [{ type: Schema.Types.ObjectId, ref: 'File' }],
  tags: [{ type: String }],

  // Métadonnées
  lastActivity: { type: Date, default: Date.now },
  isPrivate: { type: Boolean, default: false },
  estimatedResolution: { type: Date },
  resolvedAt: { type: Date },
  closedAt: { type: Date },

}, { timestamps: true });
module.exports = mongoose.model('Ticket', TicketSchema);

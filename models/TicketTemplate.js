// models/TicketTemplate.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TicketTemplateSchema = new Schema({
  name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['technical', 'billing', 'account', 'feature_request', 'bug_report', 'general'], 
    default: 'general' 
  },
  title: { type: String, required: true },
  description: { type: String },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium' 
  },
  tags: [{ type: String }],
  isActive: { type: Boolean, default: true },

  createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },

}, { timestamps: true });

module.exports = mongoose.model('TicketTemplate', TicketTemplateSchema);

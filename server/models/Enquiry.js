const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
  type:    { type: String, default: 'Contact Form' }, // 'Contact Form' | 'Bulk Quote'
  name:    { type: String, required: true },
  company: { type: String, default: '' },
  phone:   { type: String, default: '' },
  email:   { type: String, default: '' },
  product: { type: String, default: '' },
  qty:     { type: String, default: '' },
  msg:     { type: String, default: '' },
  unread:  { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Enquiry', EnquirySchema);

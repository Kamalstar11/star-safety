const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  cat:          { type: String, required: true, enum: ['rainwear','head','hands','visibility','foot','respiratory','other'] },
  price:        { type: String, default: 'Contact for Price' },
  moq:          { type: String, default: '' },
  material:     { type: String, default: '' },
  sizes:        { type: String, default: '' },
  colors:       { type: String, default: '' },
  cert:         { type: String, default: '' },
  desc:         { type: String, default: '' },
  features:     { type: String, default: '' },
  applications: { type: String, default: '' },
  status:       { type: String, default: 'active', enum: ['active','inactive'] },
  imgBase64:    { type: String, default: '' },   // base64 uploaded image
  imgPath:      { type: String, default: '' },   // file path if uploaded via multer
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);

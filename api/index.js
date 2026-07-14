// Vercel Serverless entry point - imports the full Express app
// This file wraps server/index.js for Vercel serverless deployment

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const connectDB  = require('../server/db');
const Product    = require('../server/models/Product');
const Enquiry    = require('../server/models/Enquiry');

const app = express();

// ── Connect MongoDB ─────────────────────────────────────────────────────────
connectDB();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ── Auth Middleware ─────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET || 'starsafety_secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Auth Routes ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { adminId, password } = req.body;
  const ADMIN_ID  = process.env.ADMIN_ID  || 'STAR0010';
  const ADMIN_PWD = process.env.ADMIN_PWD || 'Star@@@0909';
  if (adminId !== ADMIN_ID || password !== ADMIN_PWD)
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ adminId }, process.env.JWT_SECRET || 'starsafety_secret', { expiresIn: '24h' });
  res.json({ token, message: 'Login successful' });
});

app.post('/api/auth/logout', (req, res) => res.json({ message: 'Logged out' }));

// ── Products Routes ─────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/all', authMiddleware, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Enquiries Routes ────────────────────────────────────────────────────────
app.post('/api/enquiries', async (req, res) => {
  try {
    const enquiry = new Enquiry({ ...req.body, unread: true });
    await enquiry.save();
    res.status(201).json(enquiry);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/api/enquiries', authMiddleware, async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/enquiries/:id/read', authMiddleware, async (req, res) => {
  try {
    await Enquiry.findByIdAndUpdate(req.params.id, { unread: false });
    res.json({ message: 'Marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/enquiries/:id', authMiddleware, async (req, res) => {
  try {
    await Enquiry.findByIdAndDelete(req.params.id);
    res.json({ message: 'Enquiry deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/enquiries', authMiddleware, async (req, res) => {
  try {
    await Enquiry.deleteMany({});
    res.json({ message: 'All enquiries cleared' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Stats ───────────────────────────────────────────────────────────────────
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [totalProducts, totalEnquiries, unreadEnquiries] = await Promise.all([
      Product.countDocuments(),
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ unread: true }),
    ]);
    res.json({ totalProducts, totalEnquiries, unreadEnquiries });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// ── Export for Vercel Serverless ─────────────────────────────────────────────
module.exports = app;

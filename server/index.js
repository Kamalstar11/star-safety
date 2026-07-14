require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const multer     = require('multer');
const fs         = require('fs');
const connectDB  = require('./db');
const Product    = require('./models/Product');
const Enquiry    = require('./models/Enquiry');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Connect MongoDB ─────────────────────────────────────────────────────────
connectDB();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));    // allow large base64 images
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded images statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// Serve the main website files (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, '..')));

// ── Multer (image upload) ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

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

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { adminId, password } = req.body;
  const ADMIN_ID  = process.env.ADMIN_ID       || 'STAR0010';
  const ADMIN_PWD = process.env.ADMIN_PASSWORD  || 'Star@@@0909';

  if (adminId !== ADMIN_ID || password !== ADMIN_PWD) {
    return res.status(401).json({ error: 'Invalid Admin ID or Password' });
  }

  const token = jwt.sign(
    { adminId, role: 'admin' },
    process.env.JWT_SECRET || 'starsafety_secret',
    { expiresIn: '8h' }
  );
  res.json({ success: true, token, adminId });
});

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/products  — public (website catalog)
app.get('/api/products', async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.query.all === '1') delete filter.status; // admin: show all
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products  — admin only, supports image upload
app.post('/api/products', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imgPath = '/uploads/' + req.file.filename;
    const product = new Product(data);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/products/:id  — admin only
app.put('/api/products/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.imgPath = '/uploads/' + req.file.filename;
    const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/products/:id  — admin only
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    // Remove uploaded image file if exists
    if (product.imgPath) {
      const filePath = path.join(__dirname, '..', product.imgPath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/seed  — admin: seed default products if DB is empty
app.post('/api/products/seed', authMiddleware, async (req, res) => {
  try {
    const count = await Product.countDocuments();
    if (count > 0) return res.json({ message: `DB already has ${count} products. No seed needed.` });

    const defaults = [
      { name:'PVC Rain Suit', cat:'rainwear', price:'Contact for Price', moq:'50 units', material:'0.35mm PVC + Polyester', sizes:'M,L,XL,XXL,3XL', colors:'Yellow, Orange, Blue', cert:'EN 343', desc:'Heavy-duty 0.35mm PVC + polyester. 100% waterproof with heat-sealed seams. Ideal for construction, marine, and agriculture.', features:'100% Waterproof\nHeat-sealed seams\nReflective strips\nHeavy-duty zip', applications:'Construction, Marine, Agriculture, Road Work', imgPath:'/images/pvc_rainsuit.png' },
      { name:'Industrial Safety Helmet', cat:'head', price:'Contact for Price', moq:'100 units', material:'HDPE', sizes:'Universal (Adjustable)', colors:'Yellow, White, Orange, Blue, Red, Green', cert:'EN397', desc:'High-impact HDPE shell with 6-point ratchet suspension. EN397 certified for industrial use.', features:'EN397 Certified\n6-point ratchet\nVented design\nSweat absorbing band', applications:'Construction, Mining, Manufacturing', imgPath:'/images/safety_helmet.png' },
      { name:'Industrial Safety Gloves', cat:'hands', price:'Contact for Price', moq:'200 pairs', material:'PVC/Rubber/Nylon', sizes:'S,M,L,XL,XXL', colors:'Orange/Black, Yellow/Black', cert:'EN388 Cut Level 4', desc:'Cut-resistant Level 4, chemical & anti-vibration PVC grip gloves.', features:'Cut Level 4\nChemical Resistant\nAnti-vibration\nPVC grip coating', applications:'Chemical Plants, Construction, Manufacturing', imgPath:'/images/safety_gloves.png' },
      { name:'Reflective Safety Jacket', cat:'visibility', price:'Contact for Price', moq:'50 units', material:'Polyester Mesh', sizes:'M,L,XL,XXL,3XL', colors:'Orange, Yellow, Lime', cert:'EN ISO 20471 Class 2', desc:'Class 2 EN ISO 20471 certified with 3M Scotchlite reflective strips, polyester mesh body.', features:'EN ISO 20471 Class 2\n3M Scotchlite strips\nBreathable mesh\nFront zip closure', applications:'Road Work, Construction, Warehousing', imgPath:'/images/reflective_jacket.png' },
      { name:'Steel Toe Safety Shoes', cat:'foot', price:'Contact for Price', moq:'50 pairs', material:'Leather + Rubber', sizes:'6 to 11 (UK)', colors:'Black', cert:'IS 15298', desc:'200J steel toe cap, anti-puncture midsole, oil & slip resistant rubber sole.', features:'200J Steel Toe Cap\nAnti-puncture midsole\nOil resistant sole\nIS 15298 certified', applications:'Construction, Oil & Gas, Heavy Industry', imgPath:'/images/safety_shoes.png' },
      { name:'Industrial Respirator', cat:'respiratory', price:'Contact for Price', moq:'100 units', material:'PP + Carbon Filter', sizes:'One Size', colors:'Blue/White, Grey/White', cert:'N95 / FFP2', desc:'N95/FFP2 certified half-face respirator with replaceable filters.', features:'N95 / FFP2 Certified\nReusable design\nReplaceable filters\nComfort foam seal', applications:'Chemical Plants, Mining, Painting, Grinding', imgPath:'/images/respirator_mask.png' },
    ];
    await Product.insertMany(defaults);
    res.json({ message: '✅ 6 default products seeded to MongoDB!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ENQUIRY ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/enquiries  — public (from website forms)
app.post('/api/enquiries', async (req, res) => {
  try {
    const enquiry = new Enquiry(req.body);
    await enquiry.save();
    res.status(201).json({ success: true, message: 'Enquiry saved!', id: enquiry._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/enquiries  — admin only
app.get('/api/enquiries', authMiddleware, async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/enquiries/:id/read  — admin: mark as read
app.patch('/api/enquiries/:id/read', authMiddleware, async (req, res) => {
  try {
    await Enquiry.findByIdAndUpdate(req.params.id, { unread: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/enquiries/:id  — admin only
app.delete('/api/enquiries/:id', authMiddleware, async (req, res) => {
  try {
    await Enquiry.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/enquiries  — admin: clear all
app.delete('/api/enquiries', authMiddleware, async (req, res) => {
  try {
    await Enquiry.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stats  — admin dashboard stats ────────────────────────────────
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const [totalProducts, totalEnquiries, unreadEnquiries] = await Promise.all([
      Product.countDocuments(),
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ unread: true }),
    ]);
    res.json({ totalProducts, totalEnquiries, unreadEnquiries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// ── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 STAR SAFETY Server running on http://localhost:${PORT}`);
  console.log(`📦 API Base: http://localhost:${PORT}/api`);
  console.log(`🌐 Website: http://localhost:${PORT}/index.html`);
  console.log(`🔐 Admin:   http://localhost:${PORT}/admin.html\n`);
});

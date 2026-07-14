// ═══════════════════════════════════════════════════════
// STAR SAFETY — API Client
// Connects frontend HTML pages to the Node.js/MongoDB backend
// ═══════════════════════════════════════════════════════

const IS_LOCAL = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
const API_BASE = IS_LOCAL ? 'http://localhost:5000/api' : '/api';

// ── Token helpers ────────────────────────────────────────
const getToken  = ()    => sessionStorage.getItem('ss_jwt');
const setToken  = (t)   => sessionStorage.setItem('ss_jwt', t);
const clearToken= ()    => sessionStorage.removeItem('ss_jwt');
const authHdr   = ()    => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` });

// ── Generic fetch wrapper ────────────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res  = await fetch(API_BASE + path, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    console.error('API Error:', err.message);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
const Auth = {
  async login(adminId, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId, password }),
    });
    setToken(data.token);
    return data;
  },
  logout() { clearToken(); window.location.href = 'admin.html'; },
  isLoggedIn() { return !!getToken(); },
};

// ═══════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════
const Products = {
  // Public — fetch active products for website catalog
  async getAll(adminMode = false) {
    const url = adminMode ? '/products?all=1' : '/products';
    return apiFetch(url);
  },

  async getById(id) {
    return apiFetch(`/products/${id}`);
  },

  // Admin — create product (supports base64 image from file reader)
  async create(productData) {
    return apiFetch('/products', {
      method:  'POST',
      headers: authHdr(),
      body:    JSON.stringify(productData),
    });
  },

  // Admin — update product
  async update(id, productData) {
    return apiFetch(`/products/${id}`, {
      method:  'PUT',
      headers: authHdr(),
      body:    JSON.stringify(productData),
    });
  },

  // Admin — delete product
  async delete(id) {
    return apiFetch(`/products/${id}`, {
      method:  'DELETE',
      headers: authHdr(),
    });
  },

  // Admin — seed default products
  async seed() {
    return apiFetch('/products/seed', {
      method:  'POST',
      headers: authHdr(),
    });
  },
};

// ═══════════════════════════════════════════════════════
// ENQUIRIES
// ═══════════════════════════════════════════════════════
const Enquiries = {
  // Public — submit enquiry from website form
  async submit(data) {
    return apiFetch('/enquiries', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
  },

  // Admin — get all enquiries
  async getAll() {
    return apiFetch('/enquiries', {
      headers: authHdr(),
    });
  },

  // Admin — mark as read
  async markRead(id) {
    return apiFetch(`/enquiries/${id}/read`, {
      method:  'PATCH',
      headers: authHdr(),
    });
  },

  // Admin — delete one
  async delete(id) {
    return apiFetch(`/enquiries/${id}`, {
      method:  'DELETE',
      headers: authHdr(),
    });
  },

  // Admin — clear all
  async clearAll() {
    return apiFetch('/enquiries', {
      method:  'DELETE',
      headers: authHdr(),
    });
  },
};

// ═══════════════════════════════════════════════════════
// STATS (Admin dashboard)
// ═══════════════════════════════════════════════════════
const Stats = {
  async get() {
    return apiFetch('/stats', { headers: authHdr() });
  },
};

// Export for use in HTML pages
window.SS_API = { Auth, Products, Enquiries, Stats, getToken, isLoggedIn: Auth.isLoggedIn };

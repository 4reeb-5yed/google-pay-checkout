const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Session header handling (X-Session-ID)
app.use((req, res, next) => {
  let sessionId = req.headers['x-session-id'];
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
    sessionId = 'session_' + crypto.randomBytes(8).toString('hex');
  }
  req.sessionId = sessionId.trim();
  res.setHeader('X-Session-ID', req.sessionId);
  next();
});

// Serve static frontend files
app.use(express.static(__dirname));

// Helper: Format cents to currency string ($XX.YY)
function formatMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}

// Helper: Get or create cart for session
function getOrCreateCart(sessionId) {
  const selectStmt = db.prepare('SELECT * FROM carts WHERE session_id = ?');
  let cart = selectStmt.get(sessionId);

  if (!cart) {
    const cartId = 'cart_' + crypto.randomBytes(8).toString('hex');
    const insertStmt = db.prepare('INSERT INTO carts (id, session_id) VALUES (?, ?)');
    insertStmt.run(cartId, sessionId);
    cart = { id: cartId, session_id: sessionId };
  }

  return cart;
}

// Helper: Fetch cart details with items and subtotal
function getCartDetails(sessionId) {
  const cart = getOrCreateCart(sessionId);

  const itemsStmt = db.prepare(`
    SELECT 
      ci.id AS itemId,
      ci.product_id AS productId,
      ci.quantity,
      p.name,
      p.category,
      p.price_cents AS unitPriceCents,
      p.description,
      p.image,
      p.type,
      p.recurrence_period AS recurrencePeriod,
      p.recurrence_period_count AS recurrencePeriodCount
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.cart_id = ?
  `);

  const items = itemsStmt.all(cart.id).map(item => {
    const lineTotalCents = item.unitPriceCents * item.quantity;
    return {
      ...item,
      unitPriceFormatted: formatMoney(item.unitPriceCents),
      lineTotalCents,
      lineTotalFormatted: formatMoney(lineTotalCents)
    };
  });

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cartId: cart.id,
    sessionId,
    itemCount,
    subtotalCents,
    subtotalFormatted: formatMoney(subtotalCents),
    items
  };
}

// --- API ROUTES ---

// GET /api/products — Catalog list, optional ?category= filter
app.get('/api/products', (req, res) => {
  const category = req.query.category;
  let products;

  if (category) {
    const stmt = db.prepare('SELECT * FROM products WHERE category = ? ORDER BY price_cents ASC');
    products = stmt.all(category);
  } else {
    const stmt = db.prepare('SELECT * FROM products ORDER BY category, price_cents ASC');
    products = stmt.all();
  }

  const formatted = products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    priceCents: p.price_cents,
    priceFormatted: formatMoney(p.price_cents),
    description: p.description,
    image: p.image,
    type: p.type,
    recurrencePeriod: p.recurrence_period,
    recurrencePeriodCount: p.recurrence_period_count
  }));

  res.json({ products: formatted });
});

// GET /api/products/:id — Single product detail
app.get('/api/products/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
  const p = stmt.get(req.params.id);

  if (!p) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json({
    product: {
      id: p.id,
      name: p.name,
      category: p.category,
      priceCents: p.price_cents,
      priceFormatted: formatMoney(p.price_cents),
      description: p.description,
      image: p.image,
      type: p.type,
      recurrencePeriod: p.recurrence_period,
      recurrencePeriodCount: p.recurrence_period_count
    }
  });
});

// GET /api/cart — Current session's cart
app.get('/api/cart', (req, res) => {
  const cartData = getCartDetails(req.sessionId);
  res.json(cartData);
});

// POST /api/cart — Add item to cart
app.post('/api/cart', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const parsedQty = parseInt(quantity, 10);

  if (!productId || isNaN(parsedQty) || parsedQty <= 0) {
    return res.status(400).json({ error: 'Valid productId and positive quantity required' });
  }

  // Check if product exists
  const prodStmt = db.prepare('SELECT id FROM products WHERE id = ?');
  if (!prodStmt.get(productId)) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const cart = getOrCreateCart(req.sessionId);

  const existingStmt = db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?');
  const existing = existingStmt.get(cart.id, productId);

  if (existing) {
    const updateStmt = db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?');
    updateStmt.run(parsedQty, existing.id);
  } else {
    const itemId = 'item_' + crypto.randomBytes(8).toString('hex');
    const insertStmt = db.prepare('INSERT INTO cart_items (id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)');
    insertStmt.run(itemId, cart.id, productId, parsedQty);
  }

  // Touch cart updated_at
  db.prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cart.id);

  const updatedCart = getCartDetails(req.sessionId);
  res.status(201).json(updatedCart);
});

// PATCH /api/cart/items/:itemId — Update item quantity
app.patch('/api/cart/items/:itemId', (req, res) => {
  const { quantity } = req.body;
  const itemId = req.params.itemId;
  const parsedQty = parseInt(quantity, 10);

  if (isNaN(parsedQty)) {
    return res.status(400).json({ error: 'Valid integer quantity required' });
  }

  const cart = getOrCreateCart(req.sessionId);

  if (parsedQty <= 0) {
    const deleteStmt = db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?');
    deleteStmt.run(itemId, cart.id);
  } else {
    const updateStmt = db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?');
    updateStmt.run(parsedQty, itemId, cart.id);
  }

  db.prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cart.id);

  const updatedCart = getCartDetails(req.sessionId);
  res.json(updatedCart);
});

// DELETE /api/cart/items/:itemId — Remove item from cart
app.delete('/api/cart/items/:itemId', (req, res) => {
  const itemId = req.params.itemId;
  const cart = getOrCreateCart(req.sessionId);

  const deleteStmt = db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?');
  deleteStmt.run(itemId, cart.id);

  db.prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cart.id);

  const updatedCart = getCartDetails(req.sessionId);
  res.json(updatedCart);
});

// POST /api/checkout/estimate — Compute server-side subtotal and estimated fee range
app.post('/api/checkout/estimate', (req, res) => {
  const cartData = getCartDetails(req.sessionId);
  const subtotalCents = cartData.subtotalCents;

  // Surcharges per master plan Section 2 & UX spec:
  // DEBIT/PREPAID: 0.1% (min fee)
  // CREDIT: 0.5% (max fee)
  const minFeeCents = Math.round(subtotalCents * 0.001);
  const maxFeeCents = Math.round(subtotalCents * 0.005);

  const minTotalCents = subtotalCents + minFeeCents;
  const maxTotalCents = subtotalCents + maxFeeCents;

  res.json({
    subtotalCents,
    subtotalFormatted: formatMoney(subtotalCents),
    estimate: {
      minFeeCents,
      maxFeeCents,
      minTotalCents,
      maxTotalCents,
      minTotalFormatted: formatMoney(minTotalCents),
      maxTotalFormatted: formatMoney(maxTotalCents),
      disclosureText: `Est. total: ${formatMoney(minTotalCents)}–${formatMoney(maxTotalCents)} · final price depends on card type`
    },
    items: cartData.items
  });
});

// Fallback route for SPA page navigation
app.get('*', (req, res) => {
  // If request is asking for API, let express 404 handler take care of it
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Google Pay Store V2 server listening at http://localhost:${PORT}`);
});

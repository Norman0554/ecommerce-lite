const express = require('express');
const client = require('prom-client');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('node:crypto');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;
const appName = process.env.APP_NAME || 'ecommerce-lite';
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.db');

app.use(express.json());

client.collectDefaultMetrics();
client.register.setDefaultLabels({ app: appName });

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const log = (level, message, details = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...details
  };
  console.log(JSON.stringify(payload));
};

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    log('error', 'db_open_failed', { error: err.message, db_path: dbPath });
    process.exit(1);
  }
});

db.serialize(() => {
  db.run('PRAGMA journal_mode=WAL');
  db.run(
    'CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, total REAL, item_count INTEGER)'
  );
  db.run(
    'CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id TEXT, qty INTEGER, price REAL)'
  );
});

const runDb = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });

const allDb = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const pageViews = new client.Counter({
  name: 'ecommerce_page_views_total',
  help: 'Homepage views'
});

const productViews = new client.Counter({
  name: 'ecommerce_product_views_total',
  help: 'Product detail views',
  labelNames: ['product_id']
});

const addToCart = new client.Counter({
  name: 'ecommerce_add_to_cart_total',
  help: 'Add to cart actions',
  labelNames: ['product_id']
});

const checkoutTotal = new client.Counter({
  name: 'ecommerce_checkout_total',
  help: 'Checkout actions'
});

const checkoutValue = new client.Histogram({
  name: 'ecommerce_checkout_value',
  help: 'Checkout order value',
  buckets: [0, 10, 20, 50, 100, 200, 500]
});

const lastCheckoutItems = new client.Gauge({
  name: 'ecommerce_checkout_items_last',
  help: 'Item count in the most recent checkout'
});

const products = [
  {
    id: 'copper-mug',
    name: 'Copper Mug',
    price: 12.5,
    description: 'Hand-hammered mug for warm drinks.',
    badge: 'Craft'
  },
  {
    id: 'linen-tote',
    name: 'Linen Tote',
    price: 18.0,
    description: 'Lightweight tote with sturdy handles.',
    badge: 'Everyday'
  },
  {
    id: 'atlas-notebook',
    name: 'Atlas Notebook',
    price: 9.0,
    description: 'Dot-grid pages with soft-touch cover.',
    badge: 'Study'
  }
];

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
  const requestId = req.headers['x-request-id'] || randomUUID();
  const start = process.hrtime.bigint();

  req.requestId = requestId;
  res.set('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    end({ status_code: res.statusCode });
    log('info', 'http_request', {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(1)),
      user_agent: req.get('user-agent') || ''
    });
  });
  next();
});

app.get('/', (req, res) => {
  pageViews.inc();
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Market Lane</title>
    <style>
      :root {
        --ink: #1f1b16;
        --cream: #f6efe7;
        --sand: #ead7c3;
        --brick: #b2532f;
        --olive: #6c6b4b;
        --shadow: 0 16px 40px rgba(31, 27, 22, 0.18);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        color: var(--ink);
        background: radial-gradient(circle at top, #fff7ef 0%, #f4e4d2 45%, #e8d1bb 100%);
      }
      header {
        padding: 28px 24px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }
      h1 {
        margin: 0;
        font-family: "Palatino Linotype", "Book Antiqua", serif;
        letter-spacing: 1px;
      }
      .tagline {
        font-size: 0.95rem;
        color: #5c544b;
        margin-top: 4px;
      }
      .metrics {
        background: var(--cream);
        padding: 10px 14px;
        border-radius: 999px;
        font-size: 0.85rem;
        border: 1px solid #e2d5c8;
      }
      main {
        padding: 24px;
        display: grid;
        gap: 24px;
      }
      .hero {
        background: linear-gradient(120deg, #fff8f0, #f0dcc7);
        border-radius: 22px;
        padding: 24px;
        box-shadow: var(--shadow);
        display: grid;
        gap: 12px;
      }
      .hero p {
        margin: 0;
        max-width: 480px;
        color: #4c4238;
      }
      .layout {
        display: grid;
        gap: 24px;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      }
      .products {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .card {
        background: var(--cream);
        border-radius: 18px;
        padding: 18px;
        box-shadow: var(--shadow);
        display: grid;
        gap: 10px;
      }
      .badge {
        align-self: start;
        background: var(--sand);
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        color: #5a4b3b;
      }
      .price {
        font-weight: 700;
        color: var(--brick);
      }
      button {
        border: none;
        border-radius: 12px;
        padding: 10px 14px;
        font-weight: 600;
        cursor: pointer;
        background: var(--ink);
        color: #fff7ef;
      }
      button.secondary {
        background: transparent;
        color: var(--ink);
        border: 1px solid var(--ink);
      }
      .cart {
        background: var(--cream);
        border-radius: 18px;
        padding: 18px;
        box-shadow: var(--shadow);
        display: grid;
        gap: 12px;
      }
      .cart-items {
        display: grid;
        gap: 8px;
        font-size: 0.95rem;
      }
      .total {
        font-size: 1.1rem;
        font-weight: 700;
      }
      @media (max-width: 860px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>Market Lane</h1>
        <div class="tagline">Simple ecommerce demo with metrics. No database.</div>
      </div>
      <div class="metrics">Metrics: /metrics</div>
    </header>
    <main>
      <section class="hero">
        <strong>Fresh goods, small batch.</strong>
        <p>Browse our tiny catalog and run a checkout. Each action updates Prometheus metrics.</p>
      </section>
      <section class="layout">
        <div class="products" id="products"></div>
        <aside class="cart">
          <strong>Cart</strong>
          <div class="cart-items" id="cartItems"></div>
          <div class="total" id="cartTotal">Total: $0.00</div>
          <button id="checkoutBtn">Checkout</button>
          <button class="secondary" id="clearBtn">Clear</button>
          <div id="status"></div>
        </aside>
      </section>
    </main>
    <script>
      const productsEl = document.getElementById('products');
      const cartItemsEl = document.getElementById('cartItems');
      const cartTotalEl = document.getElementById('cartTotal');
      const statusEl = document.getElementById('status');
      const cart = new Map();

      const money = (value) => '$' + value.toFixed(2);

      const renderCart = () => {
        cartItemsEl.innerHTML = '';
        let total = 0;
        for (const [id, item] of cart.entries()) {
          const row = document.createElement('div');
          row.textContent = item.name + ' x' + item.qty;
          cartItemsEl.appendChild(row);
          total += item.price * item.qty;
        }
        cartTotalEl.textContent = 'Total: ' + money(total);
      };

      const addToCart = async (product) => {
        const existing = cart.get(product.id) || { ...product, qty: 0 };
        existing.qty += 1;
        cart.set(product.id, existing);
        renderCart();
        await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: product.id, qty: 1 })
        });
      };

      const fetchProducts = async () => {
        const res = await fetch('/api/products');
        const data = await res.json();
        data.forEach((product) => {
          const card = document.createElement('article');
          card.className = 'card';
          card.innerHTML = \`
            <span class="badge">\${product.badge}</span>
            <strong>\${product.name}</strong>
            <span>\${product.description}</span>
            <span class="price">\${money(product.price)}</span>
            <button>Add to cart</button>
          \`;
          card.querySelector('button').addEventListener('click', () => addToCart(product));
          card.addEventListener('mouseenter', () => {
            fetch('/api/product/' + product.id);
          }, { once: true });
          productsEl.appendChild(card);
        });
      };

      document.getElementById('checkoutBtn').addEventListener('click', async () => {
        if (cart.size === 0) {
          statusEl.textContent = 'Cart is empty.';
          return;
        }
        const items = Array.from(cart.values()).map(item => ({ id: item.id, qty: item.qty }));
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
        const data = await res.json();
        statusEl.textContent = 'Order placed. Total ' + money(data.total);
        cart.clear();
        renderCart();
      });

      document.getElementById('clearBtn').addEventListener('click', () => {
        cart.clear();
        statusEl.textContent = 'Cart cleared.';
        renderCart();
      });

      fetchProducts();
    </script>
  </body>
</html>`);
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.get('/api/product/:id', (req, res) => {
  const product = products.find((item) => item.id === req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  productViews.inc({ product_id: product.id });
  res.json(product);
});

app.post('/api/cart/add', (req, res) => {
  const { id, qty } = req.body || {};
  const product = products.find((item) => item.id === id);
  if (!product || !Number.isFinite(qty) || qty <= 0) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  addToCart.inc({ product_id: product.id }, qty);
  log('info', 'add_to_cart', {
    request_id: req.requestId,
    product_id: product.id,
    qty
  });
  res.json({ ok: true });
});

app.post('/api/checkout', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    res.status(400).json({ error: 'No items' });
    return;
  }
  let total = 0;
  let count = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.id);
    const qty = Number(item.qty || 0);
    if (!product || !Number.isFinite(qty) || qty <= 0) {
      res.status(400).json({ error: 'Invalid item' });
      return;
    }
    total += product.price * qty;
    count += qty;
  }
  let orderId;
  try {
    await runDb('BEGIN');
    const result = await runDb(
      'INSERT INTO orders (created_at, total, item_count) VALUES (?, ?, ?)',
      [new Date().toISOString(), total, count]
    );
    orderId = result.lastID;
    for (const item of items) {
      const product = products.find((p) => p.id === item.id);
      await runDb(
        'INSERT INTO order_items (order_id, product_id, qty, price) VALUES (?, ?, ?, ?)',
        [orderId, product.id, Number(item.qty || 0), product.price]
      );
    }
    await runDb('COMMIT');
  } catch (err) {
    try {
      await runDb('ROLLBACK');
    } catch (rollbackErr) {
      log('error', 'checkout_rollback_failed', { error: rollbackErr.message });
    }
    log('error', 'checkout_db_failed', { error: err.message, request_id: req.requestId });
    res.status(500).json({ error: 'DB error' });
    return;
  }
  checkoutTotal.inc();
  checkoutValue.observe(total);
  lastCheckoutItems.set(count);
  log('info', 'checkout_completed', {
    request_id: req.requestId,
    order_id: orderId,
    total,
    item_count: count
  });
  res.json({ ok: true, total, order_id: orderId });
});

app.get('/api/orders', async (req, res) => {
  try {
    const rows = await allDb(
      'SELECT id, total, item_count, created_at FROM orders ORDER BY id DESC LIMIT 20'
    );
    res.json(rows);
  } catch (err) {
    log('error', 'orders_list_failed', { error: err.message, request_id: req.requestId });
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = app;

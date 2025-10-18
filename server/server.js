const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { all, get, run, initialize, databaseFile } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const TABLE_NAME_REGEX = /^[A-Za-z0-9_]+$/;
const ALLOWED_ROLES = new Set(['client', 'seller']);
const DEFAULT_ROLE = 'client';

app.use(cors());
app.use(express.json());

function normaliseUsername(value = '') {
  return value.trim();
}

function normaliseEmail(value) {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase();
}

function normaliseRole(value) {
  if (!value) {
    return DEFAULT_ROLE;
  }

  const role = String(value).trim().toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : null;
}

function normaliseStoredRole(value) {
  if (!value) {
    return DEFAULT_ROLE;
  }

  const role = String(value).trim().toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : DEFAULT_ROLE;
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body || {};

    const normalisedUsername = normaliseUsername(username);
    const normalisedEmail = normaliseEmail(email);
    const normalisedRole = normaliseRole(role);

    if (!normalisedUsername || normalisedUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    if (!normalisedRole) {
      return res.status(400).json({ message: "Role must be either 'client' or 'seller'." });
    }

    if (normalisedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
      return res.status(400).json({ message: 'Invalid email address supplied.' });
    }

    const existingUser = await get(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
      [normalisedUsername]
    );

    if (existingUser) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    if (normalisedEmail) {
      const existingEmail = await get(
        'SELECT id FROM users WHERE email = ?',
        [normalisedEmail]
      );

      if (existingEmail) {
        return res.status(409).json({ message: 'Email is already registered.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [normalisedUsername, normalisedEmail, passwordHash, normalisedRole]
    );

    res.status(201).json({
      message: 'Registration successful.',
      userId: result.lastID,
      role: normalisedRole,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Failed to register user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await get(
      'SELECT id, username, password_hash, role FROM users WHERE LOWER(username) = LOWER(?)',
      [username.trim()]
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        role: normaliseStoredRole(user.role),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to login.' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { sellerId, name, price, imageUrl, description, hasSize } = req.body || {};

    const numericSellerId = Number.parseInt(sellerId, 10);
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const numericPrice = Number.parseFloat(price);
    const trimmedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    const trimmedDescription = typeof description === 'string' ? description.trim() : '';
    const normalisedHasSize = (
      typeof hasSize === 'boolean'
        ? hasSize
        : typeof hasSize === 'string'
          ? ['true', '1', 'yes', 'on'].includes(hasSize.trim().toLowerCase())
          : typeof hasSize === 'number'
            ? hasSize != 0
            : true
    );

    if (!Number.isInteger(numericSellerId) || numericSellerId <= 0) {
      return res.status(400).json({ message: 'Valid sellerId is required.' });
    }

    if (!trimmedName) {
      return res.status(400).json({ message: 'Product name is required.' });
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ message: 'Price must be a positive number.' });
    }

    const seller = await get('SELECT id, role FROM users WHERE id = ?', [numericSellerId]);

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found.' });
    }

    if (normaliseStoredRole(seller.role) !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can add products.' });
    }

    const result = await run(
      'INSERT INTO products (seller_id, name, price, image_url, description, has_size) VALUES (?, ?, ?, ?, ?, ?)',
      [numericSellerId, trimmedName, numericPrice, trimmedImageUrl || null, trimmedDescription || null, normalisedHasSize ? 1 : 0]
    );

    const product = await get(
      'SELECT id, name, price, image_url AS imageUrl, description, has_size AS hasSize FROM products WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Failed to create product.' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await all(
      'SELECT id, name, price, image_url AS imageUrl, description, has_size AS hasSize FROM products ORDER BY created_at DESC'
    );

    res.json(products);
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ message: 'Failed to load products.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid product id supplied.' });
  }

  try {
    const product = await get(
      'SELECT id, name, price, image_url AS imageUrl, description, has_size AS hasSize FROM products WHERE id = ?',
      [id]
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json(product);
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ message: 'Failed to load product detail.' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const tables = await all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    res.json({
      status: 'ok',
      database: databaseFile,
      tables: tables.map((row) => row.name),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/table/:tableName', async (req, res) => {
  const { tableName } = req.params;

  if (!TABLE_NAME_REGEX.test(tableName)) {
    return res.status(400).json({ message: 'Invalid table name supplied.' });
  }

  try {
    const tableExists = await get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [tableName]
    );

    if (!tableExists) {
      return res.status(404).json({ message: `Table '${tableName}' not found.` });
    }

    const rows = await all(`SELECT * FROM "${tableName}" LIMIT 50`);

    res.json({
      table: tableName,
      count: rows.length,
      rows,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { all, get, run, initialize, databaseFile } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const TABLE_NAME_REGEX = /^[A-Za-z0-9_]+$/;

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

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body || {};

    const normalisedUsername = normaliseUsername(username);
    const normalisedEmail = normaliseEmail(email);

    if (!normalisedUsername || normalisedUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
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
      [normalisedUsername, normalisedEmail, passwordHash, 'customer']
    );

    res.status(201).json({
      message: 'Registration successful.',
      userId: result.lastID,
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
      'SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER(?)',
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
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to login.' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await all(
      'SELECT id, name, price, image_url AS imageUrl, description FROM products ORDER BY created_at DESC'
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
      'SELECT id, name, price, image_url AS imageUrl, description FROM products WHERE id = ?',
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
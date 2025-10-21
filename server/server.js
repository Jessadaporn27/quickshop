const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { all, get, run, initialize, databaseFile } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const TABLE_NAME_REGEX = /^[A-Za-z0-9_]+$/;
const VALID_ROLES = ['customer', 'seller'];
const ORDER_STATUS = {
  PENDING: 'pending',
  PACKING: 'packing',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
};
const VALID_ORDER_STATUSES = new Set(Object.values(ORDER_STATUS));
const ORDER_STATUS_FLOW = {
  [ORDER_STATUS.PENDING]: ORDER_STATUS.PACKING,
  [ORDER_STATUS.PACKING]: ORDER_STATUS.SHIPPED,
  [ORDER_STATUS.SHIPPED]: ORDER_STATUS.COMPLETED,
};

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
  if (!value || typeof value !== 'string') {
    return null;
  }

  const role = value.trim().toLowerCase();
  return VALID_ROLES.includes(role) ? role : null;
}

function parseSizeOptions(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item).trim();
        }
        return '';
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function serialiseSizeOptions(value) {
  if (!value) {
    return null;
  }

  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const cleaned = [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];

  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

function mapProductRow(row) {
  if (!row) {
    return null;
  }

  const sizeSource = row.sizeOptions ?? row.size_options ?? null;
  const imageSource = row.imageUrl ?? row.image_url ?? null;
  const sellerSource = row.sellerId ?? row.seller_id ?? null;
  const priceValue =
    typeof row.price === 'number' ? row.price : Number.parseFloat(row.price ?? 0) || 0;
  const stockValue =
    Number.isInteger(row.stock) ? row.stock : Number.parseInt(row.stock, 10) || 0;
  const totalSoldValue =
    Number.isFinite(row.totalSold)
      ? row.totalSold
      : Number.isFinite(row.total_sold)
        ? row.total_sold
        : Number.parseInt(row.totalSold ?? row.total_sold ?? 0, 10) || 0;

  return {
    id: row.id,
    sellerId: sellerSource,
    name: row.name,
    price: priceValue,
    stock: stockValue,
    sizeOptions: parseSizeOptions(sizeSource),
    imageUrl: imageSource,
    description: row.description ?? null,
    totalSold: totalSoldValue,
  };
}

function mapOrderRow(row) {
  if (!row) {
    return null;
  }

  const quantityValue = Number.isInteger(row.quantity)
    ? row.quantity
    : Number.parseInt(row.quantity ?? 0, 10) || 0;
  const customerSource = row.customerId ?? row.customer_id ?? null;

  return {
    id: row.id,
    productId: row.productId ?? row.product_id ?? null,
    sellerId: row.sellerId ?? row.seller_id ?? null,
    customerId: customerSource,
    quantity: quantityValue,
    status: row.status,
    buyerName: row.buyerName ?? row.buyer_name ?? null,
    shippingAddress: row.shippingAddress ?? row.shipping_address ?? null,
    paymentMethod: row.paymentMethod ?? row.payment_method ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    product: mapProductRow({
      id: row.product_id ?? row.productId,
      seller_id: row.seller_id ?? row.sellerId,
      name: row.product_name ?? row.name,
      price: row.product_price ?? row.price,
      stock: row.product_stock ?? row.stock,
      image_url: row.product_image_url ?? row.imageUrl ?? row.image_url,
      description: row.product_description ?? row.description,
      size_options: row.product_size_options ?? row.sizeOptions ?? row.size_options,
    }),
  };
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body || {};

    const normalisedUsername = normaliseUsername(username);
    const normalisedEmail = normaliseEmail(email);
    const normalisedRole = normaliseRole(role);

    if (role && !normalisedRole) {
      return res.status(400).json({ message: 'Invalid role supplied.' });
    }

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
      [normalisedUsername, normalisedEmail, passwordHash, normalisedRole || 'customer']
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
        role: normaliseRole(user.role) || 'customer',
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
      `SELECT id, seller_id AS sellerId, name, price, stock, size_options AS sizeOptions,
              image_url AS imageUrl, description
         FROM products
        ORDER BY created_at DESC`
    );

    res.json(products.map(mapProductRow));
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ message: 'Failed to load products.' });
  }
});

app.get('/api/products/top', async (req, res) => {
  try {
    const products = await all(
      `SELECT
         p.id,
         p.seller_id AS sellerId,
         p.name,
         p.price,
         p.stock,
         p.size_options AS sizeOptions,
         p.image_url AS imageUrl,
         p.description,
         COALESCE(SUM(o.quantity), 0) AS totalSold
       FROM products p
       LEFT JOIN orders o ON o.product_id = p.id
       GROUP BY p.id
       ORDER BY totalSold DESC, p.created_at DESC
       LIMIT 5`
    );

    res.json(products.map(mapProductRow));
  } catch (error) {
    console.error('Top products fetch error:', error);
    res.status(500).json({ message: 'Failed to load top products.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);

  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid product id supplied.' });
  }

  try {
    const product = await get(
      `SELECT id, seller_id AS sellerId, name, price, stock, size_options AS sizeOptions,
              image_url AS imageUrl, description
         FROM products
        WHERE id = ?`,
      [id]
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.json(mapProductRow(product));
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ message: 'Failed to load product detail.' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { sellerId, name, price, stock, sizeOptions, imageUrl, description } = req.body || {};

    const numericSellerId = Number.parseInt(sellerId, 10);
    if (!Number.isInteger(numericSellerId) || numericSellerId <= 0) {
      return res.status(400).json({ message: 'Invalid seller id supplied.' });
    }

    const seller = await get('SELECT id, role FROM users WHERE id = ?', [numericSellerId]);
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found.' });
    }

    const sellerRole = normaliseRole(seller.role) || 'customer';
    if (sellerRole !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can add products.' });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ message: 'Product name is required.' });
    }

    const priceValue = Number.parseFloat(price);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      return res.status(400).json({ message: 'Product price must be a positive number.' });
    }

    const stockValue = Number.parseInt(stock, 10);
    if (!Number.isInteger(stockValue) || stockValue < 0) {
      return res.status(400).json({ message: 'Product stock must be zero or a positive integer.' });
    }

    const serializedSizes = serialiseSizeOptions(sizeOptions);
    const normalisedImageUrl =
      typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null;
    const normalisedDescription =
      typeof description === 'string' && description.trim() ? description.trim() : null;

    const result = await run(
      `INSERT INTO products (seller_id, name, price, stock, size_options, image_url, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        numericSellerId,
        trimmedName,
        priceValue,
        stockValue,
        serializedSizes,
        normalisedImageUrl,
        normalisedDescription,
      ]
    );

    const product = await get(
      `SELECT id, seller_id AS sellerId, name, price, stock, size_options AS sizeOptions,
              image_url AS imageUrl, description
         FROM products
        WHERE id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      message: 'Product created successfully.',
      product: mapProductRow(product),
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ message: 'Failed to create product.' });
  }
});

app.get('/api/sellers/:sellerId/products', async (req, res) => {
  const sellerId = Number.parseInt(req.params.sellerId, 10);

  if (!Number.isInteger(sellerId) || sellerId <= 0) {
    return res.status(400).json({ message: 'Invalid seller id supplied.' });
  }

  try {
    const seller = await get('SELECT id, role FROM users WHERE id = ?', [sellerId]);

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found.' });
    }

    const role = normaliseRole(seller.role) || 'customer';

    if (role !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can view their products.' });
    }

    const rows = await all(
      `SELECT id, seller_id AS sellerId, name, price, stock, size_options AS sizeOptions,
              image_url AS imageUrl, description
         FROM products
        WHERE seller_id = ?
        ORDER BY created_at DESC`,
      [sellerId]
    );

    res.json(rows.map(mapProductRow));
  } catch (error) {
    console.error('Seller products fetch error:', error);
    res.status(500).json({ message: 'Failed to load seller products.' });
  }
});

app.patch('/api/products/:productId', async (req, res) => {
  const productId = Number.parseInt(req.params.productId, 10);
  const { sellerId, name, price, stock, sizeOptions, imageUrl, description } = req.body || {};

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: 'Invalid product id supplied.' });
  }

  const numericSellerId = Number.parseInt(sellerId, 10);
  if (!Number.isInteger(numericSellerId) || numericSellerId <= 0) {
    return res.status(400).json({ message: 'Invalid seller id supplied.' });
  }

  try {
    const existing = await get(
      `SELECT id, seller_id AS sellerId, name, price, stock, size_options AS sizeOptions,
              image_url AS imageUrl, description
         FROM products
        WHERE id = ?`,
      [productId]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (existing.sellerId !== numericSellerId) {
      return res.status(403).json({ message: 'You do not have permission to update this product.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName) {
        return res.status(400).json({ message: 'Product name is required.' });
      }
      updates.push('name = ?');
      params.push(trimmedName);
    }

    if (price !== undefined) {
      const parsedPrice = Number.parseFloat(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({ message: 'Price must be a positive number.' });
      }
      updates.push('price = ?');
      params.push(parsedPrice);
    }

    if (stock !== undefined) {
      const parsedStock = Number.parseInt(stock, 10);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return res.status(400).json({ message: 'Stock must be zero or a positive integer.' });
      }
      updates.push('stock = ?');
      params.push(parsedStock);
    }

    if (sizeOptions !== undefined) {
      const serialisedSizes = serialiseSizeOptions(sizeOptions);
      updates.push('size_options = ?');
      params.push(serialisedSizes);
    }

    if (imageUrl !== undefined) {
      const cleanedImage =
        typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null;
      updates.push('image_url = ?');
      params.push(cleanedImage);
    }

    if (description !== undefined) {
      const cleanedDescription =
        typeof description === 'string' && description.trim() ? description.trim() : null;
      updates.push('description = ?');
      params.push(cleanedDescription);
    }

    if (updates.length === 0) {
      return res.json({ message: 'No changes supplied.', product: mapProductRow(existing) });
    }

    params.push(productId);

    await run(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await get(
      `SELECT id, seller_id AS sellerId, name, price, stock, size_options AS sizeOptions,
              image_url AS imageUrl, description
         FROM products
        WHERE id = ?`,
      [productId]
    );

    res.json({
      message: 'Product updated successfully.',
      product: mapProductRow(updated),
    });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({ message: 'Failed to update product.' });
  }
});

app.post('/api/orders', async (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const customer = req.body?.customer ?? {};
  const customerUserIdRaw =
    Object.prototype.hasOwnProperty.call(customer, 'userId') && customer.userId !== undefined
      ? customer.userId
      : req.body?.customerId;
  const parsedCustomerId = Number.parseInt(customerUserIdRaw, 10);
  const customerIdGlobal =
    Number.isInteger(parsedCustomerId) && parsedCustomerId > 0 ? parsedCustomerId : null;

  if (rawItems.length === 0) {
    return res.status(400).json({ message: 'At least one item is required.' });
  }

  const items = [];

  for (const entry of rawItems) {
    const productId = Number.parseInt(entry?.productId, 10);
    const quantity = Number.parseInt(entry?.quantity, 10);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'Invalid product id supplied.' });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive whole number.' });
    }

    items.push({ productId, quantity });
  }

  try {
    await run('BEGIN TRANSACTION');

    const updatedProducts = [];
    const createdOrders = [];

    for (const item of items) {
      const product = await get(
        'SELECT id, seller_id AS sellerId, stock FROM products WHERE id = ?',
        [item.productId]
      );

      if (!product) {
        await run('ROLLBACK');
        return res.status(404).json({ message: `Product ${item.productId} not found.` });
      }

      const currentStock = Number.parseInt(product.stock, 10) || 0;

      if (currentStock < item.quantity) {
        await run('ROLLBACK');
        return res.status(400).json({
          message: `Insufficient stock for product ${item.productId}.`,
        });
      }

      await run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.productId]);
      const customerId = customerIdGlobal;


      const updatedRow = await get(
        `SELECT id, seller_id AS sellerId, name, price, stock, size_options AS sizeOptions,
                image_url AS imageUrl, description
           FROM products
          WHERE id = ?`,
        [item.productId]
      );

      if (updatedRow) {
        updatedProducts.push(mapProductRow(updatedRow));
      }

      const orderInsert = await run(
        `INSERT INTO orders (product_id, seller_id, customer_id, quantity, status, buyer_name, shipping_address, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id,
          product.sellerId || null,
          customerId,
          item.quantity,
          ORDER_STATUS.PENDING,
          typeof customer.fullName === 'string' ? customer.fullName.trim() : null,
          typeof customer.address === 'string' ? customer.address.trim() : null,
          typeof customer.paymentMethod === 'string' ? customer.paymentMethod.trim() : null,
        ]
      );

      const orderRow = await get(
        `SELECT
           o.id,
           o.product_id,
           o.seller_id,
           o.customer_id,
           o.quantity,
           o.status,
           o.buyer_name,
           o.shipping_address,
           o.payment_method,
           o.created_at,
           o.updated_at,
           p.name AS product_name,
           p.price AS product_price,
           p.image_url AS product_image_url,
           p.description AS product_description,
           p.size_options AS product_size_options,
           p.stock AS product_stock
         FROM orders o
         JOIN products p ON p.id = o.product_id
        WHERE o.id = ?`,
        [orderInsert.lastID]
      );

      if (orderRow) {
        createdOrders.push(mapOrderRow(orderRow));
      }
    }

    await run('COMMIT');

    res.status(201).json({
      message: 'Order placed successfully.',
      products: updatedProducts,
      orders: createdOrders,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    try {
      await run('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback after order failure failed:', rollbackError);
    }
    res.status(500).json({ message: 'Failed to place order.' });
  }
});

app.get('/api/sellers/:sellerId/orders', async (req, res) => {
  const sellerId = Number.parseInt(req.params.sellerId, 10);

  if (!Number.isInteger(sellerId) || sellerId <= 0) {
    return res.status(400).json({ message: 'Invalid seller id supplied.' });
  }

  try {
    const seller = await get('SELECT id, role FROM users WHERE id = ?', [sellerId]);

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found.' });
    }

    const role = normaliseRole(seller.role) || 'customer';

    if (role !== 'seller') {
      return res.status(403).json({ message: 'Only sellers can view orders.' });
    }

    const rows = await all(
      `SELECT
         o.id,
         o.product_id,
         o.seller_id,
         o.customer_id,
         o.quantity,
         o.status,
         o.buyer_name,
         o.shipping_address,
         o.payment_method,
         o.created_at,
         o.updated_at,
         p.name AS product_name,
         p.price AS product_price,
         p.image_url AS product_image_url,
         p.description AS product_description,
         p.size_options AS product_size_options,
         p.stock AS product_stock
       FROM orders o
       JOIN products p ON p.id = o.product_id
      WHERE o.seller_id = ?
      ORDER BY o.created_at DESC`,
      [sellerId]
    );

    res.json(rows.map(mapOrderRow));
  } catch (error) {
    console.error('Seller orders fetch error:', error);
    res.status(500).json({ message: 'Failed to load orders.' });
  }
});

app.get('/api/users/:userId/orders', async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id supplied.' });
  }

  try {
    const userRecord = await get('SELECT id FROM users WHERE id = ?', [userId]);

    if (!userRecord) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const rows = await all(
      `SELECT
         o.id,
         o.product_id,
         o.seller_id,
         o.customer_id,
         o.quantity,
         o.status,
         o.buyer_name,
         o.shipping_address,
         o.payment_method,
         o.created_at,
         o.updated_at,
         p.name AS product_name,
         p.price AS product_price,
         p.image_url AS product_image_url,
         p.description AS product_description,
         p.size_options AS product_size_options,
         p.stock AS product_stock
       FROM orders o
       JOIN products p ON p.id = o.product_id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json(rows.map(mapOrderRow));
  } catch (error) {
    console.error('Customer orders fetch error:', error);
    res.status(500).json({ message: 'Failed to load orders.' });
  }
});

app.post('/api/orders/:orderId/receive', async (req, res) => {
  const orderId = Number.parseInt(req.params.orderId, 10);
  const customerId = Number.parseInt(req.body?.customerId, 10);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'Invalid order id supplied.' });
  }

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ message: 'Invalid customer id supplied.' });
  }

  try {
    const existing = await get(
      `SELECT
         o.id,
         o.product_id,
         o.seller_id,
         o.customer_id,
         o.quantity,
         o.status,
         o.buyer_name,
         o.shipping_address,
         o.payment_method,
         o.created_at,
         o.updated_at,
         p.name AS product_name,
         p.price AS product_price,
         p.image_url AS product_image_url,
         p.description AS product_description,
         p.size_options AS product_size_options,
         p.stock AS product_stock
       FROM orders o
       JOIN products p ON p.id = o.product_id
      WHERE o.id = ?`,
      [orderId]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (existing.customer_id && existing.customer_id !== customerId) {
      return res.status(403).json({ message: 'You do not have permission to update this order.' });
    }

    if (existing.status !== ORDER_STATUS.SHIPPED) {
      return res.status(400).json({ message: 'Order cannot be confirmed in the current status.' });
    }

    await run('UPDATE orders SET status = ?, customer_id = COALESCE(customer_id, ?) WHERE id = ?', [
      ORDER_STATUS.COMPLETED,
      customerId,
      orderId,
    ]);

    const updated = await get(
      `SELECT
         o.id,
         o.product_id,
         o.seller_id,
         o.customer_id,
         o.quantity,
         o.status,
         o.buyer_name,
         o.shipping_address,
         o.payment_method,
         o.created_at,
         o.updated_at,
         p.name AS product_name,
         p.price AS product_price,
         p.image_url AS product_image_url,
         p.description AS product_description,
         p.size_options AS product_size_options,
         p.stock AS product_stock
       FROM orders o
       JOIN products p ON p.id = o.product_id
      WHERE o.id = ?`,
      [orderId]
    );

    res.json({
      message: 'Order marked as received.',
      order: mapOrderRow(updated),
    });
  } catch (error) {
    console.error('Order receipt confirmation error:', error);
    res.status(500).json({ message: 'Failed to confirm order receipt.' });
  }
});


app.patch('/api/orders/:orderId/status', async (req, res) => {
  const orderId = Number.parseInt(req.params.orderId, 10);
  const rawStatus = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'Invalid order id supplied.' });
  }

  if (!VALID_ORDER_STATUSES.has(rawStatus)) {
    return res.status(400).json({ message: 'Invalid status supplied.' });
  }

  try {
    const existing = await get(
      `SELECT
         o.id,
         o.product_id,
         o.seller_id,
         o.customer_id,
         o.quantity,
         o.status,
         o.buyer_name,
         o.shipping_address,
         o.payment_method,
         o.created_at,
         o.updated_at,
         p.name AS product_name,
         p.price AS product_price,
         p.image_url AS product_image_url,
         p.description AS product_description,
         p.size_options AS product_size_options,
         p.stock AS product_stock
       FROM orders o
       JOIN products p ON p.id = o.product_id
      WHERE o.id = ?`,
      [orderId]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const currentStatus = existing.status;

    if (currentStatus === rawStatus) {
      return res.json({ message: 'Status unchanged.', order: mapOrderRow(existing) });
    }

    const allowedNext = ORDER_STATUS_FLOW[currentStatus] || null;

    if (!allowedNext || allowedNext !== rawStatus) {
      return res.status(400).json({
        message: `Cannot change status from '${currentStatus}' to '${rawStatus}'.`,
      });
    }

    await run('UPDATE orders SET status = ? WHERE id = ?', [rawStatus, orderId]);

    const updated = await get(
      `SELECT
         o.id,
         o.product_id,
         o.seller_id,
         o.customer_id,
         o.quantity,
         o.status,
         o.buyer_name,
         o.shipping_address,
         o.payment_method,
         o.created_at,
         o.updated_at,
         p.name AS product_name,
         p.price AS product_price,
         p.image_url AS product_image_url,
         p.description AS product_description,
         p.size_options AS product_size_options,
         p.stock AS product_stock
       FROM orders o
       JOIN products p ON p.id = o.product_id
      WHERE o.id = ?`,
      [orderId]
    );

    res.json({
      message: 'Order status updated.',
      order: mapOrderRow(updated),
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ message: 'Failed to update order status.' });
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


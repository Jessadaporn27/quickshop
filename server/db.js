const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databaseFile = process.env.SQLITE_FILE || path.join(__dirname, 'db.db');

const db = new sqlite3.Database(databaseFile, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at ${databaseFile}`);
  }
});

db.configure('busyTimeout', 5000);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ changes: this.changes, lastID: this.lastID });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function createUsersTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await run(sql);
}

async function createProductsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      size_options TEXT,
      image_url TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  await run(sql);
}

async function createOrdersTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      buyer_name TEXT,
      shipping_address TEXT,
      payment_method TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  await run(sql);
}

async function migrateLegacyOrdersTableIfNeeded(columns) {
  if (!columns || columns.length === 0) {
    return;
  }

  await run('DROP TRIGGER IF EXISTS orders_updated_at_trigger');

  const hasModernId = columns.some((column) => column.name === 'id');

  if (hasModernId) {
    return;
  }

  const backupTable = `orders_backup_${Date.now()}`;

  await run(`ALTER TABLE orders RENAME TO ${backupTable}`);
  await createOrdersTable();

  const legacyColumns = await all(`PRAGMA table_info(${backupTable})`);
  const legacyNames = legacyColumns.map((column) => column.name);

  const selectIdPart = legacyNames.includes('id')
    ? 'id'
    : legacyNames.includes('order_id')
      ? 'order_id AS id'
      : 'NULL AS id';

  const selectProductPart = legacyNames.includes('product_id')
    ? 'product_id'
    : legacyNames.includes('productId')
      ? 'productId AS product_id'
      : 'NULL AS product_id';

  const selectSellerPart = legacyNames.includes('seller_id')
    ? 'seller_id'
    : legacyNames.includes('sellerId')
      ? 'sellerId AS seller_id'
      : 'NULL AS seller_id';

  const selectQuantityPart = legacyNames.includes('quantity')
    ? 'quantity'
    : '1 AS quantity';

  const selectStatusPart = legacyNames.includes('status')
    ? 'status'
    : `'pending' AS status`;

  const selectBuyerNamePart = legacyNames.includes('buyer_name')
    ? 'buyer_name'
    : legacyNames.includes('buyerName')
      ? 'buyerName AS buyer_name'
      : 'NULL AS buyer_name';

  const selectAddressPart = legacyNames.includes('shipping_address')
    ? 'shipping_address'
    : legacyNames.includes('shippingAddress')
      ? 'shippingAddress AS shipping_address'
      : 'NULL AS shipping_address';

  const selectPaymentPart = legacyNames.includes('payment_method')
    ? 'payment_method'
    : legacyNames.includes('paymentMethod')
      ? 'paymentMethod AS payment_method'
      : 'NULL AS payment_method';

  const selectCreatedPart = legacyNames.includes('created_at')
    ? 'created_at'
    : legacyNames.includes('createdAt')
      ? 'createdAt AS created_at'
      : 'CURRENT_TIMESTAMP AS created_at';

  const selectUpdatedPart = legacyNames.includes('updated_at')
    ? 'updated_at'
    : legacyNames.includes('updatedAt')
      ? 'updatedAt AS updated_at'
      : 'CURRENT_TIMESTAMP AS updated_at';

  const selectParts = [
    selectIdPart,
    selectProductPart,
    selectSellerPart,
    selectQuantityPart,
    selectStatusPart,
    selectBuyerNamePart,
    selectAddressPart,
    selectPaymentPart,
    selectCreatedPart,
    selectUpdatedPart,
  ];

  await run(
    `INSERT INTO orders (id, product_id, seller_id, quantity, status, buyer_name, shipping_address, payment_method, created_at, updated_at)
     SELECT ${selectParts.join(', ')}
     FROM ${backupTable}`
  );

  await run(`DROP TABLE ${backupTable}`);
}

async function ensureOrdersUpdatedAtTrigger() {
  const columns = await all('PRAGMA table_info(orders)');
  const hasId = columns.some((column) => column.name === 'id');
  const hasUpdatedAt = columns.some((column) => column.name === 'updated_at');

  await run('DROP TRIGGER IF EXISTS orders_updated_at_trigger');

  if (!hasId || !hasUpdatedAt) {
    return;
  }

  await run(
    `CREATE TRIGGER orders_updated_at_trigger
     AFTER UPDATE ON orders
     FOR EACH ROW
     BEGIN
       UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
     END`
  );
}

async function seedProductsIfEmpty() {
  const countRow = await get('SELECT COUNT(*) AS total FROM products');

  if (countRow?.total && countRow.total > 0) {
    return;
  }

  const seedData = [
    {
      name: 'Classic Tee',
      price: 10,
      stock: 42,
      sizeOptions: ['S', 'M', 'L'],
      image:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
      description: 'Soft cotton t-shirt available in multiple colors.',
    },
    {
      name: 'Cardboard Box',
      price: 1,
      stock: 120,
      sizeOptions: [],
      image:
        'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=600&q=80',
      description: 'Sturdy medium size box for shipping or storage.',
    },
    {
      name: 'Toy Bundle',
      price: 12,
      stock: 30,
      sizeOptions: [],
      image:
        'https://images.unsplash.com/photo-1601758003122-58c0fef13782?auto=format&fit=crop&w=600&q=80',
      description: 'Assorted toys for kids, perfect for parties.',
    },
    {
      name: 'Instant Noodles Pack',
      price: 1,
      stock: 200,
      sizeOptions: [],
      image:
        'https://images.unsplash.com/photo-1512058454905-109598bd0cad?auto=format&fit=crop&w=600&q=80',
      description: 'Quick meal ready in minutes with authentic flavor.',
    },
    {
      name: 'Cooking Manual',
      price: 15,
      stock: 18,
      sizeOptions: [],
      image:
        'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=600&q=80',
      description: 'Comprehensive cooking guide for beginners.',
    },
    {
      name: 'Chocolate Cereal',
      price: 4,
      stock: 65,
      sizeOptions: [],
      image:
        'https://images.unsplash.com/photo-1613478881183-b3a7c633c8e1?auto=format&fit=crop&w=600&q=80',
      description: 'Crunchy breakfast cereal with chocolate flavor.',
    },
  ];

  const insertSql = `
    INSERT INTO products (seller_id, name, price, stock, size_options, image_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  for (const product of seedData) {
    const sizeOptions = Array.isArray(product.sizeOptions) && product.sizeOptions.length > 0
      ? JSON.stringify(product.sizeOptions)
      : null;

    await run(insertSql, [
      null,
      product.name,
      product.price,
      Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : 0,
      sizeOptions,
      product.image,
      product.description,
    ]);
  }
}

async function migrateLegacyUsersTableIfNeeded(columns) {
  const hasModernId = columns.some((column) => column.name === 'id');
  const hasLegacyUserId = columns.some((column) => column.name === 'user_id');

  if (hasModernId || !hasLegacyUserId) {
    return;
  }

  const backupTable = `users_backup_${Date.now()}`;

  await run(`ALTER TABLE users RENAME TO ${backupTable}`);
  await createUsersTable();

  await run(
    `INSERT INTO users (id, username, email, password_hash, role, created_at)
     SELECT user_id, username, email, password_hash, COALESCE(role, 'customer'), COALESCE(created_at, CURRENT_TIMESTAMP)
     FROM ${backupTable}`
  );

  await run(`DROP TABLE ${backupTable}`);
}

async function migrateLegacyProductsTableIfNeeded(columns) {
  const hasModernId = columns.some((column) => column.name === 'id');
  const hasLegacyProductId = columns.some((column) => column.name === 'product_id');
  const sellerColumn = columns.find((column) => column.name === 'seller_id');
  const sellerNotNullable = sellerColumn && sellerColumn.notnull !== 0;
  const hasStock = columns.some((column) => column.name === 'stock');
  const hasSizeOptions = columns.some((column) => column.name === 'size_options');

  if (hasModernId && !hasLegacyProductId && !sellerNotNullable && hasStock && hasSizeOptions) {
    return;
  }

  const backupTable = `products_backup_${Date.now()}`;

  await run(`ALTER TABLE products RENAME TO ${backupTable}`);
  await createProductsTable();

  const legacyColumns = await all(`PRAGMA table_info(${backupTable})`);
  const legacyNames = legacyColumns.map((column) => column.name);

  const selectIdPart = legacyNames.includes('id')
    ? 'id'
    : legacyNames.includes('product_id')
      ? 'product_id AS id'
      : 'NULL AS id';

  const selectSellerPart = legacyNames.includes('seller_id') ? 'seller_id' : 'NULL AS seller_id';
  const selectNamePart = legacyNames.includes('name') ? 'name' : "'' AS name";
  const selectPricePart = legacyNames.includes('price') ? 'price' : '0 AS price';
  const selectStockPart = legacyNames.includes('stock') ? 'stock' : '0 AS stock';
  const selectSizeOptionsPart = legacyNames.includes('size_options')
    ? 'size_options'
    : 'NULL AS size_options';
  const selectImagePart = legacyNames.includes('image_url') ? 'image_url' : 'NULL AS image_url';
  const selectDescriptionPart = legacyNames.includes('description') ? 'description' : 'NULL AS description';
  const selectCreatedAtPart = legacyNames.includes('created_at')
    ? 'created_at'
    : 'CURRENT_TIMESTAMP AS created_at';

  const selectParts = [
    selectIdPart,
    selectSellerPart,
    selectNamePart,
    selectPricePart,
    selectStockPart,
    selectSizeOptionsPart,
    selectImagePart,
    selectDescriptionPart,
    selectCreatedAtPart,
  ];

  await run(
    `INSERT INTO products (id, seller_id, name, price, stock, size_options, image_url, description, created_at)
     SELECT ${selectParts.join(', ')}
     FROM ${backupTable}`
  );

  await run(`DROP TABLE ${backupTable}`);
}

async function initialize() {
  await createUsersTable();
  await createProductsTable();
  await createOrdersTable();

  const userColumns = await all('PRAGMA table_info(users)');
  await migrateLegacyUsersTableIfNeeded(userColumns);

  const productColumns = await all('PRAGMA table_info(products)');
  await migrateLegacyProductsTableIfNeeded(productColumns);

  const orderColumns = await all('PRAGMA table_info(orders)');
  await migrateLegacyOrdersTableIfNeeded(orderColumns);
  await ensureOrdersUpdatedAtTrigger();

  await seedProductsIfEmpty();
}

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing SQLite connection:', err.message);
    }
    process.exit(err ? 1 : 0);
  });
});

module.exports = {
  db,
  run,
  get,
  all,
  initialize,
  databaseFile,
};

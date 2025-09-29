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
      image_url TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  await run(sql);
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
      image:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
      description: 'Soft cotton t-shirt available in multiple colors.',
    },
    {
      name: 'Cardboard Box',
      price: 1,
      image:
        'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=600&q=80',
      description: 'Sturdy medium size box for shipping or storage.',
    },
    {
      name: 'Toy Bundle',
      price: 12,
      image:
        'https://images.unsplash.com/photo-1601758003122-58c0fef13782?auto=format&fit=crop&w=600&q=80',
      description: 'Assorted toys for kids, perfect for parties.',
    },
    {
      name: 'Instant Noodles Pack',
      price: 1,
      image:
        'https://images.unsplash.com/photo-1512058454905-109598bd0cad?auto=format&fit=crop&w=600&q=80',
      description: 'Quick meal ready in minutes with authentic flavor.',
    },
    {
      name: 'Cooking Manual',
      price: 15,
      image:
        'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=600&q=80',
      description: 'Comprehensive cooking guide for beginners.',
    },
    {
      name: 'Chocolate Cereal',
      price: 4,
      image:
        'https://images.unsplash.com/photo-1613478881183-b3a7c633c8e1?auto=format&fit=crop&w=600&q=80',
      description: 'Crunchy breakfast cereal with chocolate flavor.',
    },
  ];

  const insertSql = 'INSERT INTO products (seller_id, name, price, image_url, description) VALUES (?, ?, ?, ?, ?)';

  for (const product of seedData) {
    await run(insertSql, [null, product.name, product.price, product.image, product.description]);
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

  if (hasModernId && !hasLegacyProductId && !sellerNotNullable) {
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
    selectImagePart,
    selectDescriptionPart,
    selectCreatedAtPart,
  ];

  await run(
    `INSERT INTO products (id, seller_id, name, price, image_url, description, created_at)
     SELECT ${selectParts.join(', ')}
     FROM ${backupTable}`
  );

  await run(`DROP TABLE ${backupTable}`);
}

async function initialize() {
  await createUsersTable();
  await createProductsTable();

  const userColumns = await all('PRAGMA table_info(users)');
  await migrateLegacyUsersTableIfNeeded(userColumns);

  const productColumns = await all('PRAGMA table_info(products)');
  await migrateLegacyProductsTableIfNeeded(productColumns);

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
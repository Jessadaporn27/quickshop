const { URL } = require('url');
const { Pool } = require('pg');

function parseBoolean(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalised = String(value).trim().toLowerCase();
  if (!normalised) {
    return undefined;
  }

  return ['1', 'true', 'yes', 'on', 'require'].includes(normalised);
}

function buildPoolConfig() {
  const config = {};

  if (process.env.DATABASE_URL) {
    config.connectionString = process.env.DATABASE_URL;
  }

  if (process.env.DB_HOST) {
    config.host = process.env.DB_HOST;
  }

  if (process.env.DB_PORT) {
    const port = Number(process.env.DB_PORT);
    if (!Number.isNaN(port)) {
      config.port = port;
    }
  }

  if (process.env.DB_NAME) {
    config.database = process.env.DB_NAME;
  }

  if (process.env.DB_USER) {
    config.user = process.env.DB_USER;
  }

  if (process.env.DB_PASSWORD) {
    config.password = process.env.DB_PASSWORD;
  }

  const shouldEnableSsl = parseBoolean(process.env.DB_SSL);
  if (shouldEnableSsl) {
    config.ssl = {
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_STRICT) ?? false,
    };
  }

  return config;
}

function deriveConnectionInfo(config) {
  if (config.connectionString) {
    try {
      const url = new URL(config.connectionString);
      return {
        host: url.hostname || null,
        database: url.pathname ? url.pathname.slice(1) : null,
        port: url.port ? Number(url.port) : null,
        user: url.username || null,
        ssl: url.searchParams.get('sslmode')
          ? url.searchParams.get('sslmode').toLowerCase() !== 'disable'
          : Boolean(config.ssl),
      };
    } catch (error) {
      console.warn('Failed to parse DATABASE_URL:', error.message);
    }
  }

  return {
    host: config.host ?? null,
    database: config.database ?? null,
    port: config.port ?? null,
    user: config.user ?? null,
    ssl: Boolean(config.ssl),
  };
}

const poolConfig = buildPoolConfig();
const connectionInfo = deriveConnectionInfo(poolConfig);

const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL error on idle client:', error);
});

function prepareQuery(sql, params) {
  if (!params || params.length === 0) {
    return { text: sql, values: [] };
  }

  let index = 0;
  const text = sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });

  return { text, values: params };
}

async function run(sql, params = []) {
  const query = prepareQuery(sql, params);
  const result = await pool.query(query.text, query.values);

  const rows = result?.rows ?? [];
  const firstRow = rows[0] ?? null;
  const lastID =
    firstRow && typeof firstRow.id !== 'undefined'
      ? Number.parseInt(firstRow.id, 10) || firstRow.id
      : null;

  const rowCount = typeof result.rowCount === 'number' ? result.rowCount : 0;

  return {
    rowCount,
    changes: rowCount,
    rows,
    lastID,
  };
}

async function get(sql, params = []) {
  const query = prepareQuery(sql, params);
  const result = await pool.query(query.text, query.values);
  return result.rows[0] ?? null;
}

async function all(sql, params = []) {
  const query = prepareQuery(sql, params);
  const result = await pool.query(query.text, query.values);
  return result.rows;
}

async function createUsersTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

async function createProductsTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      size_options TEXT,
      image_url TEXT,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

async function createOrdersTable() {
  await run(
    `CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      buyer_name TEXT,
      shipping_address TEXT,
      buyer_phone TEXT,
      payment_method TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

async function ensureOrdersUpdatedAtTrigger() {
  await run(
    `CREATE OR REPLACE FUNCTION set_orders_updated_at()
     RETURNS TRIGGER AS $$
     BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;`
  );

  await run(
    `DO $$
     BEGIN
       IF NOT EXISTS (
         SELECT 1 FROM pg_trigger WHERE tgname = 'orders_updated_at_trigger'
       ) THEN
         CREATE TRIGGER orders_updated_at_trigger
         BEFORE UPDATE ON orders
         FOR EACH ROW
         EXECUTE FUNCTION set_orders_updated_at();
       END IF;
     END;
     $$;`
  );
}

async function seedProductsIfEmpty() {
  const countRow = await get('SELECT COUNT(*)::INTEGER AS total FROM products');

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
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;

  for (const product of seedData) {
    const sizeOptions =
      Array.isArray(product.sizeOptions) && product.sizeOptions.length > 0
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

async function initialize() {
  await run('SELECT 1');
  await createUsersTable();
  await createProductsTable();
  await createOrdersTable();
  await ensureOrdersUpdatedAtTrigger();
  await seedProductsIfEmpty();
}

process.on('SIGINT', async () => {
  try {
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error closing PostgreSQL pool:', error.message);
    process.exit(1);
  }
});

module.exports = {
  pool,
  run,
  get,
  all,
  initialize,
  connectionInfo,
};

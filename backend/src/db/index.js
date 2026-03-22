const { Pool } = require('pg');

let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else {
  console.warn('DATABASE_URL not set – DB queries will return null (mock mode)');
}

async function query(text, params) {
  if (!pool) return null;
  return pool.query(text, params);
}

module.exports = { query };

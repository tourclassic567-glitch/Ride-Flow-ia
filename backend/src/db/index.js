const { Pool } = require('pg');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

function log(event, input, output, status) {
  console.log(JSON.stringify({
    event,
    input,
    output,
    status,
    timestamp: new Date().toISOString()
  }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function query(text, params = [], attempt = 1) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    log('db_query', { text, params, attempt }, { message: error.message }, 'error');

    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS);
      return query(text, params, attempt + 1);
    }

    throw error;
  }
}

async function checkConnection() {
  await query('SELECT 1');
  return true;
}

async function initDbOrFail() {
  try {
    await checkConnection();
    log('db_init', {}, { connected: true }, 'success');
  } catch (error) {
    log('db_init', {}, { message: error.message }, 'error');
    process.exit(1);
  }
}

module.exports = {
  pool,
  query,
  checkConnection,
  initDbOrFail,
  log
};

const { Pool } = require('pg');
const ssl = process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined;
const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL, ssl } : { ssl });
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
module.exports = { pool, query: (t, p) => pool.query(t, p), tx };

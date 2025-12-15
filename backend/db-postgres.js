import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ideation',
  user: process.env.DB_USER || 'ideation_app',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const dbWrapper = {
  prepare: (sql) => ({
    run: async (...params) => {
      const result = await pool.query(sql, params);
      return { changes: result.rowCount };
    },
    get: async (...params) => {
      const result = await pool.query(sql, params);
      return result.rows[0];
    },
    all: async (...params) => {
      const result = await pool.query(sql, params);
      return result.rows;
    }
  }),
  exec: async (sql) => {
    await pool.query(sql);
  }
};

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err));

export default dbWrapper;


const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_HOST?.includes('railway') 
        ? { rejectUnauthorized: false } 
        : false
    });

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
});

module.exports = pool;

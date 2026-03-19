import knex, { Knex } from 'knex';

let config: Knex.Config;

if (process.env.DATABASE_URL) {
  // Production: use DATABASE_URL directly (Railway, Render, etc.)
  config = {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    },
    pool: { min: 2, max: 20 },
  };
} else {
  // Local development: use knexfile
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const knexConfig = require('../../knexfile');
  const env = process.env.NODE_ENV || 'development';
  config = (knexConfig.default || knexConfig)[env];
  if (!config) {
    throw new Error(`No database configuration found for environment: ${env}`);
  }
}

const db: Knex = knex(config);

export default db;

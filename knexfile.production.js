// Production knexfile — plain JS so ts-node is not needed at runtime.
// Used by Docker CMD for migrations and seeds.
require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      },
  migrations: {
    directory: './migrations-compiled',
    extension: 'js',
  },
  seeds: {
    directory: './seeds-compiled',
    extension: 'js',
  },
  pool: {
    min: 2,
    max: 20,
  },
};

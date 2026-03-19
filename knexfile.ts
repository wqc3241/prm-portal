import dotenv from 'dotenv';
import type { Knex } from 'knex';

dotenv.config();

const baseConfig: Knex.Config = {
  client: 'pg',
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './seeds',
    extension: 'ts',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...baseConfig,
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'prm_portal',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
  },
  test: {
    ...baseConfig,
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME ? `${process.env.DB_NAME}_test` : 'prm_portal_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
  },
  production: {
    ...baseConfig,
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: 2,
      max: 20,
    },
  },
};

export default config;
module.exports = config;

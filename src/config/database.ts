import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';

const env = process.env.NODE_ENV || 'development';
const config = (knexConfig as Record<string, Knex.Config>)[env];

if (!config) {
  throw new Error(`No database configuration found for environment: ${env}`);
}

const db: Knex = knex(config);

export default db;

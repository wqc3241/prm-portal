import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP EXTENSION IF EXISTS "pg_trgm"');
  await knex.raw('DROP EXTENSION IF EXISTS "pgcrypto"');
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
}

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE SEQUENCE deal_number_seq START 1;
    CREATE SEQUENCE quote_number_seq START 1;
    CREATE SEQUENCE lead_number_seq START 1;
    CREATE SEQUENCE mdf_number_seq START 1;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP SEQUENCE IF EXISTS mdf_number_seq;
    DROP SEQUENCE IF EXISTS lead_number_seq;
    DROP SEQUENCE IF EXISTS quote_number_seq;
    DROP SEQUENCE IF EXISTS deal_number_seq;
  `);
}

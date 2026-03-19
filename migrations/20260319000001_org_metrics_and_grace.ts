import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS active_deals_count      INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_pipeline_value     NUMERIC(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tier_downgrade_grace_at  TIMESTAMPTZ;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE organizations
      DROP COLUMN IF EXISTS active_deals_count,
      DROP COLUMN IF EXISTS total_pipeline_value,
      DROP COLUMN IF EXISTS tier_downgrade_grace_at;
  `);
}

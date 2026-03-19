import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE partner_tiers (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name            VARCHAR(100) NOT NULL UNIQUE,
      rank            INT NOT NULL UNIQUE,
      color_hex       VARCHAR(7),
      min_annual_revenue      NUMERIC(15,2) DEFAULT 0,
      min_deals_closed        INT DEFAULT 0,
      min_certified_reps      INT DEFAULT 0,
      min_csat_score          NUMERIC(3,2) DEFAULT 0,
      default_discount_pct    NUMERIC(5,2) DEFAULT 0,
      max_discount_pct        NUMERIC(5,2) DEFAULT 0,
      mdf_budget_pct          NUMERIC(5,2) DEFAULT 0,
      lead_priority           INT DEFAULT 0,
      dedicated_channel_mgr   BOOLEAN DEFAULT FALSE,
      description     TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('partner_tiers');
}

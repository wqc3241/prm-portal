import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE organizations (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name            VARCHAR(255) NOT NULL,
      legal_name      VARCHAR(255),
      domain          VARCHAR(255),
      tier_id         UUID REFERENCES partner_tiers(id),
      status          org_status NOT NULL DEFAULT 'prospect',
      industry        VARCHAR(100),
      employee_count  INT,
      website         VARCHAR(500),
      phone           VARCHAR(50),
      address_line1   VARCHAR(255),
      address_line2   VARCHAR(255),
      city            VARCHAR(100),
      state_province  VARCHAR(100),
      postal_code     VARCHAR(20),
      country         VARCHAR(100) DEFAULT 'US',
      agreement_signed_at     TIMESTAMPTZ,
      agreement_expires_at    TIMESTAMPTZ,
      nda_signed_at           TIMESTAMPTZ,
      channel_manager_id      UUID,
      ytd_revenue             NUMERIC(15,2) DEFAULT 0,
      lifetime_revenue        NUMERIC(15,2) DEFAULT 0,
      ytd_deals_closed        INT DEFAULT 0,
      certified_rep_count     INT DEFAULT 0,
      logo_url        VARCHAR(500),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_organizations_status ON organizations(status);
    CREATE INDEX idx_organizations_tier ON organizations(tier_id);
    CREATE INDEX idx_organizations_domain ON organizations(domain);
    CREATE INDEX idx_organizations_channel_mgr ON organizations(channel_manager_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('organizations');
}

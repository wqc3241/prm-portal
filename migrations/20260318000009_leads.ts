import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE leads (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      lead_number     VARCHAR(20) NOT NULL UNIQUE,
      source          VARCHAR(50),
      campaign_name   VARCHAR(200),
      first_name      VARCHAR(100) NOT NULL,
      last_name       VARCHAR(100) NOT NULL,
      email           VARCHAR(255),
      phone           VARCHAR(50),
      company_name    VARCHAR(255),
      title           VARCHAR(200),
      industry        VARCHAR(100),
      company_size    VARCHAR(50),
      city            VARCHAR(100),
      state_province  VARCHAR(100),
      country         VARCHAR(100),
      status          lead_status NOT NULL DEFAULT 'new',
      assigned_org_id UUID REFERENCES organizations(id),
      assigned_user_id UUID REFERENCES users(id),
      assigned_at     TIMESTAMPTZ,
      accepted_at     TIMESTAMPTZ,
      sla_deadline    TIMESTAMPTZ,
      score           INT DEFAULT 0,
      budget          NUMERIC(15,2),
      timeline        VARCHAR(100),
      interest_notes  TEXT,
      converted_deal_id UUID REFERENCES deals(id),
      converted_at    TIMESTAMPTZ,
      return_reason   TEXT,
      disqualify_reason TEXT,
      tags            TEXT[],
      custom_fields   JSONB DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_leads_status ON leads(status);
    CREATE INDEX idx_leads_org ON leads(assigned_org_id);
    CREATE INDEX idx_leads_user ON leads(assigned_user_id);
    CREATE INDEX idx_leads_score ON leads(score DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('leads');
}

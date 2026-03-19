import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE deals (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      deal_number     VARCHAR(20) NOT NULL UNIQUE,
      organization_id UUID NOT NULL REFERENCES organizations(id),
      submitted_by    UUID NOT NULL REFERENCES users(id),
      assigned_to     UUID REFERENCES users(id),
      customer_company_name   VARCHAR(255) NOT NULL,
      customer_contact_name   VARCHAR(255),
      customer_contact_email  VARCHAR(255),
      customer_contact_phone  VARCHAR(50),
      customer_industry       VARCHAR(100),
      customer_address        TEXT,
      deal_name       VARCHAR(300) NOT NULL,
      description     TEXT,
      status          deal_status NOT NULL DEFAULT 'draft',
      estimated_value NUMERIC(15,2) NOT NULL,
      actual_value    NUMERIC(15,2),
      currency        VARCHAR(3) DEFAULT 'USD',
      win_probability INT CHECK (win_probability BETWEEN 0 AND 100),
      expected_close_date     DATE,
      actual_close_date       DATE,
      registration_expires_at TIMESTAMPTZ,
      primary_product_id      UUID REFERENCES products(id),
      is_conflicting  BOOLEAN DEFAULT FALSE,
      conflict_deal_id UUID REFERENCES deals(id),
      conflict_notes  TEXT,
      approved_by     UUID REFERENCES users(id),
      approved_at     TIMESTAMPTZ,
      rejection_reason TEXT,
      source          VARCHAR(50),
      tags            TEXT[],
      custom_fields   JSONB DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_deals_org ON deals(organization_id);
    CREATE INDEX idx_deals_status ON deals(status);
    CREATE INDEX idx_deals_customer ON deals(customer_company_name);
    CREATE INDEX idx_deals_customer_email ON deals(customer_contact_email);
    CREATE INDEX idx_deals_submitted_by ON deals(submitted_by);
    CREATE INDEX idx_deals_expires ON deals(registration_expires_at) WHERE status = 'approved';
    CREATE INDEX idx_deals_customer_trgm ON deals USING gin(customer_company_name gin_trgm_ops);

    CREATE TABLE deal_status_history (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      from_status     deal_status,
      to_status       deal_status NOT NULL,
      changed_by      UUID NOT NULL REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_deal_history_deal ON deal_status_history(deal_id);

    CREATE TABLE deal_products (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      product_id      UUID NOT NULL REFERENCES products(id),
      quantity        INT NOT NULL DEFAULT 1,
      unit_price      NUMERIC(12,2) NOT NULL,
      discount_pct    NUMERIC(5,2) DEFAULT 0,
      line_total      NUMERIC(15,2) GENERATED ALWAYS AS (
        quantity * unit_price * (1 - COALESCE(discount_pct, 0) / 100)
      ) STORED,
      UNIQUE(deal_id, product_id)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('deal_products');
  await knex.schema.dropTableIfExists('deal_status_history');
  await knex.schema.dropTableIfExists('deals');
}

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE quotes (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      quote_number    VARCHAR(20) NOT NULL UNIQUE,
      deal_id         UUID REFERENCES deals(id),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      created_by      UUID NOT NULL REFERENCES users(id),
      customer_name   VARCHAR(255) NOT NULL,
      customer_email  VARCHAR(255),
      subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
      total_discount  NUMERIC(15,2) NOT NULL DEFAULT 0,
      tax_amount      NUMERIC(15,2) DEFAULT 0,
      total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
      currency        VARCHAR(3) DEFAULT 'USD',
      status          quote_status NOT NULL DEFAULT 'draft',
      requires_approval BOOLEAN DEFAULT FALSE,
      approved_by     UUID REFERENCES users(id),
      approved_at     TIMESTAMPTZ,
      rejection_reason TEXT,
      valid_from      DATE DEFAULT CURRENT_DATE,
      valid_until     DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
      payment_terms   VARCHAR(100) DEFAULT 'Net 30',
      notes           TEXT,
      terms_and_conditions TEXT,
      pdf_url         VARCHAR(500),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_quotes_deal ON quotes(deal_id);
    CREATE INDEX idx_quotes_org ON quotes(organization_id);
    CREATE INDEX idx_quotes_status ON quotes(status);

    CREATE TABLE quote_line_items (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      product_id      UUID NOT NULL REFERENCES products(id),
      sort_order      INT DEFAULT 0,
      quantity        INT NOT NULL DEFAULT 1,
      list_price      NUMERIC(12,2) NOT NULL,
      discount_type   discount_type DEFAULT 'percentage',
      discount_value  NUMERIC(12,2) DEFAULT 0,
      unit_price      NUMERIC(12,2) NOT NULL,
      line_total      NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
      discount_approved       BOOLEAN DEFAULT FALSE,
      discount_approved_by    UUID REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_quote_items_quote ON quote_line_items(quote_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('quote_line_items');
  await knex.schema.dropTableIfExists('quotes');
}

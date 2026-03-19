import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE product_categories (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name            VARCHAR(200) NOT NULL,
      parent_id       UUID REFERENCES product_categories(id),
      sort_order      INT DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE products (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      sku             VARCHAR(100) NOT NULL UNIQUE,
      name            VARCHAR(300) NOT NULL,
      description     TEXT,
      category_id     UUID REFERENCES product_categories(id),
      list_price      NUMERIC(12,2) NOT NULL,
      cost            NUMERIC(12,2),
      currency        VARCHAR(3) DEFAULT 'USD',
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      available_to_partners   BOOLEAN NOT NULL DEFAULT TRUE,
      product_type    VARCHAR(50),
      billing_cycle   VARCHAR(20),
      image_url       VARCHAR(500),
      spec_sheet_url  VARCHAR(500),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_products_sku ON products(sku);
    CREATE INDEX idx_products_category ON products(category_id);
    CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;

    CREATE TABLE tier_product_pricing (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tier_id         UUID NOT NULL REFERENCES partner_tiers(id),
      product_id      UUID NOT NULL REFERENCES products(id),
      discount_pct    NUMERIC(5,2),
      special_price   NUMERIC(12,2),
      UNIQUE(tier_id, product_id)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tier_product_pricing');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('product_categories');
}

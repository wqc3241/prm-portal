import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Auto-update updated_at trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Deal number generator
  await knex.raw(`
    CREATE OR REPLACE FUNCTION generate_deal_number()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.deal_number := 'DR-' || EXTRACT(YEAR FROM NOW()) || '-' ||
        LPAD(nextval('deal_number_seq')::TEXT, 5, '0');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Quote number generator
  await knex.raw(`
    CREATE OR REPLACE FUNCTION generate_quote_number()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.quote_number := 'QT-' || EXTRACT(YEAR FROM NOW()) || '-' ||
        LPAD(nextval('quote_number_seq')::TEXT, 5, '0');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Lead number generator
  await knex.raw(`
    CREATE OR REPLACE FUNCTION generate_lead_number()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.lead_number := 'LD-' || EXTRACT(YEAR FROM NOW()) || '-' ||
        LPAD(nextval('lead_number_seq')::TEXT, 5, '0');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // MDF number generator
  await knex.raw(`
    CREATE OR REPLACE FUNCTION generate_mdf_number()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.request_number := 'MDF-' || EXTRACT(YEAR FROM NOW()) || '-' ||
        LPAD(nextval('mdf_number_seq')::TEXT, 5, '0');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Deal conflict detection function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION find_deal_conflicts(
      p_customer_company VARCHAR,
      p_customer_email VARCHAR,
      p_product_id UUID,
      p_exclude_deal_id UUID DEFAULT NULL
    )
    RETURNS TABLE(
      conflicting_deal_id UUID,
      conflicting_deal_number VARCHAR,
      conflicting_org_name VARCHAR,
      match_type VARCHAR,
      similarity_score REAL
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        d.id,
        d.deal_number,
        o.name,
        CASE
          WHEN d.customer_contact_email = p_customer_email THEN 'exact_email'
          WHEN LOWER(d.customer_company_name) = LOWER(p_customer_company) THEN 'exact_company'
          WHEN similarity(d.customer_company_name, p_customer_company) > 0.4 THEN 'fuzzy_company'
          WHEN d.primary_product_id = p_product_id THEN 'same_product_customer'
        END::VARCHAR AS match_type,
        similarity(d.customer_company_name, p_customer_company) AS sim_score
      FROM deals d
      JOIN organizations o ON d.organization_id = o.id
      WHERE d.status IN ('submitted', 'under_review', 'approved', 'won')
        AND (d.registration_expires_at IS NULL OR d.registration_expires_at > NOW())
        AND (p_exclude_deal_id IS NULL OR d.id != p_exclude_deal_id)
        AND (
          d.customer_contact_email = p_customer_email
          OR similarity(d.customer_company_name, p_customer_company) > 0.4
          OR (d.primary_product_id = p_product_id
              AND similarity(d.customer_company_name, p_customer_company) > 0.3)
        )
      ORDER BY sim_score DESC;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Tier auto-calculation function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION calculate_partner_tier(p_org_id UUID)
    RETURNS UUID AS $$
    DECLARE
      v_revenue NUMERIC;
      v_deals INT;
      v_certs INT;
      v_new_tier_id UUID;
    BEGIN
      SELECT ytd_revenue, ytd_deals_closed, certified_rep_count
      INTO v_revenue, v_deals, v_certs
      FROM organizations WHERE id = p_org_id;

      SELECT id INTO v_new_tier_id
      FROM partner_tiers
      WHERE min_annual_revenue <= COALESCE(v_revenue, 0)
        AND min_deals_closed <= COALESCE(v_deals, 0)
        AND min_certified_reps <= COALESCE(v_certs, 0)
      ORDER BY rank DESC
      LIMIT 1;

      RETURN v_new_tier_id;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP FUNCTION IF EXISTS calculate_partner_tier(UUID)');
  await knex.raw('DROP FUNCTION IF EXISTS find_deal_conflicts(VARCHAR, VARCHAR, UUID, UUID)');
  await knex.raw('DROP FUNCTION IF EXISTS generate_mdf_number()');
  await knex.raw('DROP FUNCTION IF EXISTS generate_lead_number()');
  await knex.raw('DROP FUNCTION IF EXISTS generate_quote_number()');
  await knex.raw('DROP FUNCTION IF EXISTS generate_deal_number()');
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at()');
}

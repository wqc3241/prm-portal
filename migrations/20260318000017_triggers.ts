import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // updated_at triggers
  const tablesWithUpdatedAt = [
    'organizations', 'users', 'products', 'deals', 'quotes',
    'leads', 'mdf_requests', 'partner_tiers', 'mdf_allocations',
    'courses', 'user_certifications', 'documents',
  ];

  for (const table of tablesWithUpdatedAt) {
    await knex.raw(`
      CREATE TRIGGER trg_${table}_updated
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);
  }

  // Number generation triggers
  await knex.raw(`
    CREATE TRIGGER trg_deal_number BEFORE INSERT ON deals
    FOR EACH ROW WHEN (NEW.deal_number IS NULL)
    EXECUTE FUNCTION generate_deal_number();
  `);

  await knex.raw(`
    CREATE TRIGGER trg_quote_number BEFORE INSERT ON quotes
    FOR EACH ROW WHEN (NEW.quote_number IS NULL)
    EXECUTE FUNCTION generate_quote_number();
  `);

  await knex.raw(`
    CREATE TRIGGER trg_lead_number BEFORE INSERT ON leads
    FOR EACH ROW WHEN (NEW.lead_number IS NULL)
    EXECUTE FUNCTION generate_lead_number();
  `);

  await knex.raw(`
    CREATE TRIGGER trg_mdf_number BEFORE INSERT ON mdf_requests
    FOR EACH ROW WHEN (NEW.request_number IS NULL)
    EXECUTE FUNCTION generate_mdf_number();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TRIGGER IF EXISTS trg_mdf_number ON mdf_requests');
  await knex.raw('DROP TRIGGER IF EXISTS trg_lead_number ON leads');
  await knex.raw('DROP TRIGGER IF EXISTS trg_quote_number ON quotes');
  await knex.raw('DROP TRIGGER IF EXISTS trg_deal_number ON deals');

  const tablesWithUpdatedAt = [
    'organizations', 'users', 'products', 'deals', 'quotes',
    'leads', 'mdf_requests', 'partner_tiers', 'mdf_allocations',
    'courses', 'user_certifications', 'documents',
  ];

  for (const table of tablesWithUpdatedAt) {
    await knex.raw(`DROP TRIGGER IF EXISTS trg_${table}_updated ON ${table}`);
  }
}

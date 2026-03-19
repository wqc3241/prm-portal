import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE quote_status_history (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      from_status     quote_status,
      to_status       quote_status NOT NULL,
      changed_by      UUID NOT NULL REFERENCES users(id),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_quote_history_quote ON quote_status_history(quote_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('quote_status_history');
}

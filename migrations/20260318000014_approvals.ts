import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE approval_requests (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      entity_type     VARCHAR(50) NOT NULL,
      entity_id       UUID NOT NULL,
      requested_by    UUID NOT NULL REFERENCES users(id),
      assigned_to     UUID NOT NULL REFERENCES users(id),
      action          approval_action,
      decided_at      TIMESTAMPTZ,
      comments        TEXT,
      escalated       BOOLEAN DEFAULT FALSE,
      escalation_deadline TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_approvals_assignee ON approval_requests(assigned_to) WHERE action IS NULL;
    CREATE INDEX idx_approvals_entity ON approval_requests(entity_type, entity_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('approval_requests');
}

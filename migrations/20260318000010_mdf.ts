import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE mdf_allocations (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      fiscal_year     INT NOT NULL,
      fiscal_quarter  INT NOT NULL CHECK (fiscal_quarter BETWEEN 1 AND 4),
      allocated_amount NUMERIC(12,2) NOT NULL,
      spent_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
      remaining_amount NUMERIC(12,2) GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
      currency        VARCHAR(3) DEFAULT 'USD',
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(organization_id, fiscal_year, fiscal_quarter)
    );

    CREATE TABLE mdf_requests (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      request_number  VARCHAR(20) NOT NULL UNIQUE,
      allocation_id   UUID NOT NULL REFERENCES mdf_allocations(id),
      organization_id UUID NOT NULL REFERENCES organizations(id),
      submitted_by    UUID NOT NULL REFERENCES users(id),
      activity_type   mdf_activity_type NOT NULL,
      activity_name   VARCHAR(300) NOT NULL,
      description     TEXT,
      start_date      DATE NOT NULL,
      end_date        DATE NOT NULL,
      requested_amount NUMERIC(12,2) NOT NULL,
      approved_amount  NUMERIC(12,2),
      actual_spend     NUMERIC(12,2),
      status          mdf_request_status NOT NULL DEFAULT 'draft',
      reviewed_by     UUID REFERENCES users(id),
      reviewed_at     TIMESTAMPTZ,
      rejection_reason TEXT,
      claim_submitted_at   TIMESTAMPTZ,
      claim_amount         NUMERIC(12,2),
      proof_of_execution   TEXT[],
      claim_notes          TEXT,
      reimbursement_amount NUMERIC(12,2),
      reimbursed_at        TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_mdf_requests_org ON mdf_requests(organization_id);
    CREATE INDEX idx_mdf_requests_status ON mdf_requests(status);
    CREATE INDEX idx_mdf_alloc_org ON mdf_allocations(organization_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mdf_requests');
  await knex.schema.dropTableIfExists('mdf_allocations');
}

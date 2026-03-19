import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE courses (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name            VARCHAR(300) NOT NULL,
      description     TEXT,
      course_type     VARCHAR(50),
      duration_hours  NUMERIC(5,1),
      passing_score   INT DEFAULT 70,
      certification_valid_months INT DEFAULT 12,
      is_required     BOOLEAN DEFAULT FALSE,
      required_for_tier_id UUID REFERENCES partner_tiers(id),
      content_url     VARCHAR(500),
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE user_certifications (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id         UUID NOT NULL REFERENCES users(id),
      course_id       UUID NOT NULL REFERENCES courses(id),
      status          VARCHAR(30) NOT NULL DEFAULT 'enrolled',
      score           INT,
      completed_at    TIMESTAMPTZ,
      certified_at    TIMESTAMPTZ,
      expires_at      TIMESTAMPTZ,
      certificate_url VARCHAR(500),
      attempts        INT DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, course_id)
    );

    CREATE INDEX idx_user_certs_user ON user_certifications(user_id);
    CREATE INDEX idx_user_certs_expires ON user_certifications(expires_at) WHERE status = 'passed';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_certifications');
  await knex.schema.dropTableIfExists('courses');
}

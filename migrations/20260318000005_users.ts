import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE users (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email           VARCHAR(255) NOT NULL UNIQUE,
      password_hash   VARCHAR(255),
      role            user_role NOT NULL,
      first_name      VARCHAR(100) NOT NULL,
      last_name       VARCHAR(100) NOT NULL,
      title           VARCHAR(200),
      phone           VARCHAR(50),
      avatar_url      VARCHAR(500),
      organization_id UUID REFERENCES organizations(id),
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
      last_login_at   TIMESTAMPTZ,
      password_reset_token    VARCHAR(255),
      password_reset_expires  TIMESTAMPTZ,
      refresh_token           VARCHAR(500),
      notification_prefs      JSONB DEFAULT '{"email": true, "in_app": true}'::jsonb,
      timezone                VARCHAR(50) DEFAULT 'America/New_York',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_org ON users(organization_id);
    CREATE INDEX idx_users_role ON users(role);

    ALTER TABLE organizations
      ADD CONSTRAINT fk_org_channel_manager
      FOREIGN KEY (channel_manager_id) REFERENCES users(id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE organizations DROP CONSTRAINT IF EXISTS fk_org_channel_manager');
  await knex.schema.dropTableIfExists('users');
}

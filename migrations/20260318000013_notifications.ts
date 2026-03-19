import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE notifications (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id         UUID NOT NULL REFERENCES users(id),
      type            notification_type NOT NULL,
      title           VARCHAR(300) NOT NULL,
      body            TEXT,
      entity_type     VARCHAR(50),
      entity_id       UUID,
      is_read         BOOLEAN DEFAULT FALSE,
      read_at         TIMESTAMPTZ,
      email_sent      BOOLEAN DEFAULT FALSE,
      email_sent_at   TIMESTAMPTZ,
      action_url      VARCHAR(500),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_notifications_user ON notifications(user_id);
    CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

    CREATE TABLE activity_feed (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      actor_id        UUID NOT NULL REFERENCES users(id),
      organization_id UUID REFERENCES organizations(id),
      action          VARCHAR(50) NOT NULL,
      entity_type     VARCHAR(50) NOT NULL,
      entity_id       UUID NOT NULL,
      summary         VARCHAR(500) NOT NULL,
      changes         JSONB,
      ip_address      INET,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_activity_org ON activity_feed(organization_id, created_at DESC);
    CREATE INDEX idx_activity_entity ON activity_feed(entity_type, entity_id);
    CREATE INDEX idx_activity_actor ON activity_feed(actor_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('activity_feed');
  await knex.schema.dropTableIfExists('notifications');
}

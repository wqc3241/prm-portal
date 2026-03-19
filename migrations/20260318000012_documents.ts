import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE document_folders (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name            VARCHAR(200) NOT NULL,
      parent_id       UUID REFERENCES document_folders(id),
      visible_to_tiers UUID[],
      internal_only   BOOLEAN DEFAULT FALSE,
      sort_order      INT DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE documents (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      folder_id       UUID REFERENCES document_folders(id),
      title           VARCHAR(300) NOT NULL,
      description     TEXT,
      file_url        VARCHAR(500) NOT NULL,
      file_type       VARCHAR(20),
      file_size_bytes BIGINT,
      visible_to_tiers UUID[],
      internal_only   BOOLEAN DEFAULT FALSE,
      is_featured     BOOLEAN DEFAULT FALSE,
      version         INT DEFAULT 1,
      tags            TEXT[],
      download_count  INT DEFAULT 0,
      uploaded_by     UUID REFERENCES users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_documents_folder ON documents(folder_id);
    CREATE INDEX idx_documents_tags ON documents USING gin(tags);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('documents');
  await knex.schema.dropTableIfExists('document_folders');
}

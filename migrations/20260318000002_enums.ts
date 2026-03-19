import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE user_role AS ENUM ('admin', 'channel_manager', 'partner_admin', 'partner_rep');
    CREATE TYPE org_status AS ENUM ('prospect', 'pending_approval', 'active', 'suspended', 'churned');
    CREATE TYPE deal_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'won', 'lost', 'expired');
    CREATE TYPE lead_status AS ENUM ('new', 'assigned', 'accepted', 'contacted', 'qualified', 'converted', 'disqualified', 'returned');
    CREATE TYPE quote_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'sent_to_customer', 'accepted', 'expired');
    CREATE TYPE mdf_request_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'completed', 'claim_submitted', 'claim_approved', 'claim_rejected', 'reimbursed');
    CREATE TYPE mdf_activity_type AS ENUM ('event', 'webinar', 'digital_campaign', 'print_collateral', 'trade_show', 'training', 'other');
    CREATE TYPE notification_type AS ENUM ('deal_update', 'lead_assigned', 'quote_approval', 'mdf_update', 'tier_change', 'certification_expiring', 'document_shared', 'system_announcement');
    CREATE TYPE approval_action AS ENUM ('approve', 'reject', 'request_changes');
    CREATE TYPE discount_type AS ENUM ('percentage', 'fixed_amount');
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP TYPE IF EXISTS discount_type;
    DROP TYPE IF EXISTS approval_action;
    DROP TYPE IF EXISTS notification_type;
    DROP TYPE IF EXISTS mdf_activity_type;
    DROP TYPE IF EXISTS mdf_request_status;
    DROP TYPE IF EXISTS quote_status;
    DROP TYPE IF EXISTS lead_status;
    DROP TYPE IF EXISTS deal_status;
    DROP TYPE IF EXISTS org_status;
    DROP TYPE IF EXISTS user_role;
  `);
}

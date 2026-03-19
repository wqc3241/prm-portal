-- ============================================================================
-- PRM Portal — PostgreSQL Schema
-- Partner Relationship Management (Salesforce PRC Clone)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search on deals/leads

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM (
  'admin',              -- internal super-admin
  'channel_manager',    -- internal channel/alliance manager
  'partner_admin',      -- external: manages their own partner org
  'partner_rep'         -- external: individual contributor at partner
);

CREATE TYPE org_status AS ENUM (
  'prospect', 'pending_approval', 'active', 'suspended', 'churned'
);

CREATE TYPE deal_status AS ENUM (
  'draft', 'submitted', 'under_review', 'approved', 'rejected',
  'won', 'lost', 'expired'
);

CREATE TYPE lead_status AS ENUM (
  'new', 'assigned', 'accepted', 'contacted', 'qualified',
  'converted', 'disqualified', 'returned'
);

CREATE TYPE quote_status AS ENUM (
  'draft', 'pending_approval', 'approved', 'rejected',
  'sent_to_customer', 'accepted', 'expired'
);

CREATE TYPE mdf_request_status AS ENUM (
  'draft', 'submitted', 'approved', 'rejected', 'completed',
  'claim_submitted', 'claim_approved', 'claim_rejected', 'reimbursed'
);

CREATE TYPE mdf_activity_type AS ENUM (
  'event', 'webinar', 'digital_campaign', 'print_collateral',
  'trade_show', 'training', 'other'
);

CREATE TYPE notification_type AS ENUM (
  'deal_update', 'lead_assigned', 'quote_approval', 'mdf_update',
  'tier_change', 'certification_expiring', 'document_shared',
  'system_announcement'
);

CREATE TYPE approval_action AS ENUM (
  'approve', 'reject', 'request_changes'
);

CREATE TYPE discount_type AS ENUM (
  'percentage', 'fixed_amount'
);

-- ============================================================================
-- PARTNER TIERS
-- ============================================================================

CREATE TABLE partner_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(100) NOT NULL UNIQUE,       -- e.g. Registered, Silver, Gold, Platinum
  rank            INT NOT NULL UNIQUE,                 -- 1 = lowest, ascending
  color_hex       VARCHAR(7),                          -- for UI badge
  -- Requirements to achieve/maintain
  min_annual_revenue      NUMERIC(15,2) DEFAULT 0,
  min_deals_closed        INT DEFAULT 0,
  min_certified_reps      INT DEFAULT 0,
  min_csat_score          NUMERIC(3,2) DEFAULT 0,      -- 0.00–5.00
  -- Benefits
  default_discount_pct    NUMERIC(5,2) DEFAULT 0,      -- base discount for this tier
  max_discount_pct        NUMERIC(5,2) DEFAULT 0,      -- max they can self-approve
  mdf_budget_pct          NUMERIC(5,2) DEFAULT 0,      -- % of revenue allocated as MDF
  lead_priority           INT DEFAULT 0,                -- higher = gets leads first
  dedicated_channel_mgr   BOOLEAN DEFAULT FALSE,
  -- Metadata
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ORGANIZATIONS (Partner Accounts)
-- ============================================================================

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(255) NOT NULL,
  legal_name      VARCHAR(255),
  domain          VARCHAR(255),                        -- company domain for SSO matching
  tier_id         UUID REFERENCES partner_tiers(id),
  status          org_status NOT NULL DEFAULT 'prospect',
  -- Company details
  industry        VARCHAR(100),
  employee_count  INT,
  website         VARCHAR(500),
  phone           VARCHAR(50),
  -- Address
  address_line1   VARCHAR(255),
  address_line2   VARCHAR(255),
  city            VARCHAR(100),
  state_province  VARCHAR(100),
  postal_code     VARCHAR(20),
  country         VARCHAR(100) DEFAULT 'US',
  -- Partner agreement
  agreement_signed_at     TIMESTAMPTZ,
  agreement_expires_at    TIMESTAMPTZ,
  nda_signed_at           TIMESTAMPTZ,
  -- Channel manager assignment
  channel_manager_id      UUID,  -- FK added after users table
  -- Performance tracking (denormalized for fast reads)
  ytd_revenue             NUMERIC(15,2) DEFAULT 0,
  lifetime_revenue        NUMERIC(15,2) DEFAULT 0,
  ytd_deals_closed        INT DEFAULT 0,
  certified_rep_count     INT DEFAULT 0,
  -- Metadata
  logo_url        VARCHAR(500),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_tier ON organizations(tier_id);
CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organizations_channel_mgr ON organizations(channel_manager_id);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255),                        -- null if SSO-only
  role            user_role NOT NULL,
  -- Profile
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  title           VARCHAR(200),
  phone           VARCHAR(50),
  avatar_url      VARCHAR(500),
  -- Organization link (null for internal users: admin, channel_manager)
  organization_id UUID REFERENCES organizations(id),
  -- Auth
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  password_reset_token    VARCHAR(255),
  password_reset_expires  TIMESTAMPTZ,
  refresh_token           VARCHAR(500),
  -- Preferences
  notification_prefs      JSONB DEFAULT '{"email": true, "in_app": true}'::jsonb,
  timezone                VARCHAR(50) DEFAULT 'America/New_York',
  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);

-- Add FK from organizations back to users for channel_manager
ALTER TABLE organizations
  ADD CONSTRAINT fk_org_channel_manager
  FOREIGN KEY (channel_manager_id) REFERENCES users(id);

-- ============================================================================
-- PRODUCTS / SKUs
-- ============================================================================

CREATE TABLE product_categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  parent_id       UUID REFERENCES product_categories(id),
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku             VARCHAR(100) NOT NULL UNIQUE,
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES product_categories(id),
  -- Pricing
  list_price      NUMERIC(12,2) NOT NULL,
  cost            NUMERIC(12,2),                       -- internal cost for margin calcs
  currency        VARCHAR(3) DEFAULT 'USD',
  -- Availability
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  available_to_partners   BOOLEAN NOT NULL DEFAULT TRUE,
  -- Classification
  product_type    VARCHAR(50),                         -- 'hardware', 'software', 'service', 'subscription'
  billing_cycle   VARCHAR(20),                         -- 'one_time', 'monthly', 'annual'
  -- Metadata
  image_url       VARCHAR(500),
  spec_sheet_url  VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = TRUE;

-- Tier-specific pricing overrides
CREATE TABLE tier_product_pricing (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_id         UUID NOT NULL REFERENCES partner_tiers(id),
  product_id      UUID NOT NULL REFERENCES products(id),
  discount_pct    NUMERIC(5,2),                        -- override discount for this product+tier
  special_price   NUMERIC(12,2),                       -- or a flat special price
  UNIQUE(tier_id, product_id)
);

-- ============================================================================
-- DEAL REGISTRATION
-- ============================================================================

CREATE TABLE deals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_number     VARCHAR(20) NOT NULL UNIQUE,         -- human-readable: DR-2026-00001
  -- Who
  organization_id UUID NOT NULL REFERENCES organizations(id),
  submitted_by    UUID NOT NULL REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),           -- channel manager reviewer
  -- Customer info
  customer_company_name   VARCHAR(255) NOT NULL,
  customer_contact_name   VARCHAR(255),
  customer_contact_email  VARCHAR(255),
  customer_contact_phone  VARCHAR(50),
  customer_industry       VARCHAR(100),
  customer_address        TEXT,
  -- Deal details
  deal_name       VARCHAR(300) NOT NULL,
  description     TEXT,
  status          deal_status NOT NULL DEFAULT 'draft',
  estimated_value NUMERIC(15,2) NOT NULL,
  actual_value    NUMERIC(15,2),
  currency        VARCHAR(3) DEFAULT 'USD',
  win_probability INT CHECK (win_probability BETWEEN 0 AND 100),
  -- Timeline
  expected_close_date     DATE,
  actual_close_date       DATE,
  registration_expires_at TIMESTAMPTZ,                 -- typically 90 days from approval
  -- Products
  primary_product_id      UUID REFERENCES products(id),
  -- Conflict detection
  is_conflicting  BOOLEAN DEFAULT FALSE,
  conflict_deal_id UUID REFERENCES deals(id),
  conflict_notes  TEXT,
  -- Approval
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Metadata
  source          VARCHAR(50),                         -- 'direct', 'referral', 'marketplace'
  tags            TEXT[],
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deals_org ON deals(organization_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_customer ON deals(customer_company_name);
CREATE INDEX idx_deals_customer_email ON deals(customer_contact_email);
CREATE INDEX idx_deals_submitted_by ON deals(submitted_by);
CREATE INDEX idx_deals_expires ON deals(registration_expires_at)
  WHERE status = 'approved';
-- Trigram index for fuzzy conflict matching
CREATE INDEX idx_deals_customer_trgm ON deals
  USING gin(customer_company_name gin_trgm_ops);

-- Deal status history / audit log
CREATE TABLE deal_status_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_status     deal_status,
  to_status       deal_status NOT NULL,
  changed_by      UUID NOT NULL REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deal_history_deal ON deal_status_history(deal_id);

-- Deal-product junction (multi-product deals)
CREATE TABLE deal_products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  quantity        INT NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  line_total      NUMERIC(15,2) GENERATED ALWAYS AS (
    quantity * unit_price * (1 - COALESCE(discount_pct, 0) / 100)
  ) STORED,
  UNIQUE(deal_id, product_id)
);

-- ============================================================================
-- CPQ QUOTES
-- ============================================================================

CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number    VARCHAR(20) NOT NULL UNIQUE,         -- QT-2026-00001
  deal_id         UUID REFERENCES deals(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  -- Customer
  customer_name   VARCHAR(255) NOT NULL,
  customer_email  VARCHAR(255),
  -- Financials (denormalized totals)
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_discount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(15,2) DEFAULT 0,
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(3) DEFAULT 'USD',
  -- Status & approval
  status          quote_status NOT NULL DEFAULT 'draft',
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Validity
  valid_from      DATE DEFAULT CURRENT_DATE,
  valid_until     DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  -- Terms
  payment_terms   VARCHAR(100) DEFAULT 'Net 30',
  notes           TEXT,
  terms_and_conditions TEXT,
  -- Metadata
  pdf_url         VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_deal ON quotes(deal_id);
CREATE INDEX idx_quotes_org ON quotes(organization_id);
CREATE INDEX idx_quotes_status ON quotes(status);

CREATE TABLE quote_line_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  sort_order      INT DEFAULT 0,
  -- Pricing
  quantity        INT NOT NULL DEFAULT 1,
  list_price      NUMERIC(12,2) NOT NULL,              -- snapshot of list price at quote time
  discount_type   discount_type DEFAULT 'percentage',
  discount_value  NUMERIC(12,2) DEFAULT 0,
  unit_price      NUMERIC(12,2) NOT NULL,              -- after discount
  line_total      NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  -- Approval
  discount_approved       BOOLEAN DEFAULT FALSE,
  discount_approved_by    UUID REFERENCES users(id),
  -- Notes
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quote_items_quote ON quote_line_items(quote_id);

-- ============================================================================
-- LEADS
-- ============================================================================

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_number     VARCHAR(20) NOT NULL UNIQUE,         -- LD-2026-00001
  -- Source
  source          VARCHAR(50),                          -- 'marketing', 'website', 'event', 'manual'
  campaign_name   VARCHAR(200),
  -- Contact
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  company_name    VARCHAR(255),
  title           VARCHAR(200),
  industry        VARCHAR(100),
  company_size    VARCHAR(50),
  -- Location
  city            VARCHAR(100),
  state_province  VARCHAR(100),
  country         VARCHAR(100),
  -- Assignment
  status          lead_status NOT NULL DEFAULT 'new',
  assigned_org_id UUID REFERENCES organizations(id),
  assigned_user_id UUID REFERENCES users(id),
  assigned_at     TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  sla_deadline    TIMESTAMPTZ,                         -- must accept/return by this time
  -- Qualification
  score           INT DEFAULT 0,                       -- lead score 0–100
  budget          NUMERIC(15,2),
  timeline        VARCHAR(100),
  interest_notes  TEXT,
  -- Conversion
  converted_deal_id UUID REFERENCES deals(id),
  converted_at    TIMESTAMPTZ,
  -- Rejection
  return_reason   TEXT,
  disqualify_reason TEXT,
  -- Metadata
  tags            TEXT[],
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_org ON leads(assigned_org_id);
CREATE INDEX idx_leads_user ON leads(assigned_user_id);
CREATE INDEX idx_leads_score ON leads(score DESC);

-- ============================================================================
-- MDF / CO-OP FUNDS
-- ============================================================================

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
  request_number  VARCHAR(20) NOT NULL UNIQUE,         -- MDF-2026-00001
  allocation_id   UUID NOT NULL REFERENCES mdf_allocations(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  submitted_by    UUID NOT NULL REFERENCES users(id),
  -- Activity details
  activity_type   mdf_activity_type NOT NULL,
  activity_name   VARCHAR(300) NOT NULL,
  description     TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  -- Financials
  requested_amount NUMERIC(12,2) NOT NULL,
  approved_amount  NUMERIC(12,2),
  actual_spend     NUMERIC(12,2),
  -- Status
  status          mdf_request_status NOT NULL DEFAULT 'draft',
  -- Approval
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Claim / Proof of execution
  claim_submitted_at   TIMESTAMPTZ,
  claim_amount         NUMERIC(12,2),
  proof_of_execution   TEXT[],                          -- array of document URLs
  claim_notes          TEXT,
  -- Reimbursement
  reimbursement_amount NUMERIC(12,2),
  reimbursed_at        TIMESTAMPTZ,
  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mdf_requests_org ON mdf_requests(organization_id);
CREATE INDEX idx_mdf_requests_status ON mdf_requests(status);
CREATE INDEX idx_mdf_alloc_org ON mdf_allocations(organization_id);

-- ============================================================================
-- TRAINING & CERTIFICATIONS
-- ============================================================================

CREATE TABLE courses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  course_type     VARCHAR(50),                         -- 'online', 'instructor_led', 'exam'
  duration_hours  NUMERIC(5,1),
  passing_score   INT DEFAULT 70,                      -- percentage
  -- Validity
  certification_valid_months INT DEFAULT 12,
  is_required     BOOLEAN DEFAULT FALSE,               -- required for any tier
  required_for_tier_id UUID REFERENCES partner_tiers(id), -- required for specific tier
  -- Content
  content_url     VARCHAR(500),
  -- Metadata
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_certifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  course_id       UUID NOT NULL REFERENCES courses(id),
  -- Completion
  status          VARCHAR(30) NOT NULL DEFAULT 'enrolled',  -- enrolled, in_progress, passed, failed, expired
  score           INT,
  completed_at    TIMESTAMPTZ,
  -- Validity
  certified_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  certificate_url VARCHAR(500),
  -- Metadata
  attempts        INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_user_certs_user ON user_certifications(user_id);
CREATE INDEX idx_user_certs_expires ON user_certifications(expires_at)
  WHERE status = 'passed';

-- ============================================================================
-- DOCUMENTS / CONTENT LIBRARY
-- ============================================================================

CREATE TABLE document_folders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(200) NOT NULL,
  parent_id       UUID REFERENCES document_folders(id),
  -- Access control
  visible_to_tiers UUID[],                              -- null = all tiers
  internal_only   BOOLEAN DEFAULT FALSE,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folder_id       UUID REFERENCES document_folders(id),
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  -- File
  file_url        VARCHAR(500) NOT NULL,
  file_type       VARCHAR(20),                          -- 'pdf', 'pptx', 'doc', 'video', 'link'
  file_size_bytes BIGINT,
  -- Access
  visible_to_tiers UUID[],                              -- null = all tiers
  internal_only   BOOLEAN DEFAULT FALSE,
  is_featured     BOOLEAN DEFAULT FALSE,
  -- Versioning
  version         INT DEFAULT 1,
  -- Metadata
  tags            TEXT[],
  download_count  INT DEFAULT 0,
  uploaded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_tags ON documents USING gin(tags);

-- ============================================================================
-- NOTIFICATIONS / ACTIVITY FEED
-- ============================================================================

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            notification_type NOT NULL,
  title           VARCHAR(300) NOT NULL,
  body            TEXT,
  -- Reference
  entity_type     VARCHAR(50),                          -- 'deal', 'lead', 'quote', 'mdf', etc.
  entity_id       UUID,
  -- State
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  -- Delivery
  email_sent      BOOLEAN DEFAULT FALSE,
  email_sent_at   TIMESTAMPTZ,
  -- Metadata
  action_url      VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read)
  WHERE is_read = FALSE;

-- Activity feed (global audit log)
CREATE TABLE activity_feed (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id        UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  -- What happened
  action          VARCHAR(50) NOT NULL,                 -- 'created', 'updated', 'approved', 'submitted'
  entity_type     VARCHAR(50) NOT NULL,                 -- 'deal', 'quote', 'lead', etc.
  entity_id       UUID NOT NULL,
  -- Details
  summary         VARCHAR(500) NOT NULL,                -- human-readable: "John submitted Deal DR-2026-00042"
  changes         JSONB,                                -- { field: { old: x, new: y } }
  -- Metadata
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_org ON activity_feed(organization_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_feed(entity_type, entity_id);
CREATE INDEX idx_activity_actor ON activity_feed(actor_id);

-- ============================================================================
-- APPROVAL WORKFLOWS
-- ============================================================================

CREATE TABLE approval_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- What needs approval
  entity_type     VARCHAR(50) NOT NULL,                 -- 'deal', 'quote', 'mdf_request'
  entity_id       UUID NOT NULL,
  -- Who
  requested_by    UUID NOT NULL REFERENCES users(id),
  assigned_to     UUID NOT NULL REFERENCES users(id),
  -- Decision
  action          approval_action,
  decided_at      TIMESTAMPTZ,
  comments        TEXT,
  -- Escalation
  escalated       BOOLEAN DEFAULT FALSE,
  escalation_deadline TIMESTAMPTZ,
  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approvals_assignee ON approval_requests(assigned_to)
  WHERE action IS NULL;  -- pending approvals
CREATE INDEX idx_approvals_entity ON approval_requests(entity_type, entity_id);

-- ============================================================================
-- SEQUENCE GENERATORS for human-readable IDs
-- ============================================================================

CREATE SEQUENCE deal_number_seq START 1;
CREATE SEQUENCE quote_number_seq START 1;
CREATE SEQUENCE lead_number_seq START 1;
CREATE SEQUENCE mdf_number_seq START 1;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_deals_updated BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mdf_requests_updated BEFORE UPDATE ON mdf_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_partner_tiers_updated BEFORE UPDATE ON partner_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate deal number: DR-YYYY-NNNNN
CREATE OR REPLACE FUNCTION generate_deal_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.deal_number := 'DR-' || EXTRACT(YEAR FROM NOW()) || '-' ||
    LPAD(nextval('deal_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deal_number BEFORE INSERT ON deals
  FOR EACH ROW WHEN (NEW.deal_number IS NULL)
  EXECUTE FUNCTION generate_deal_number();

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quote_number := 'QT-' || EXTRACT(YEAR FROM NOW()) || '-' ||
    LPAD(nextval('quote_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_number BEFORE INSERT ON quotes
  FOR EACH ROW WHEN (NEW.quote_number IS NULL)
  EXECUTE FUNCTION generate_quote_number();

CREATE OR REPLACE FUNCTION generate_lead_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.lead_number := 'LD-' || EXTRACT(YEAR FROM NOW()) || '-' ||
    LPAD(nextval('lead_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_number BEFORE INSERT ON leads
  FOR EACH ROW WHEN (NEW.lead_number IS NULL)
  EXECUTE FUNCTION generate_lead_number();

CREATE OR REPLACE FUNCTION generate_mdf_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'MDF-' || EXTRACT(YEAR FROM NOW()) || '-' ||
    LPAD(nextval('mdf_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mdf_number BEFORE INSERT ON mdf_requests
  FOR EACH ROW WHEN (NEW.request_number IS NULL)
  EXECUTE FUNCTION generate_mdf_number();

-- ============================================================================
-- DEAL CONFLICT DETECTION FUNCTION
-- ============================================================================

-- Returns conflicting deals for a given customer within active registrations
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

-- ============================================================================
-- TIER AUTO-CALCULATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_partner_tier(p_org_id UUID)
RETURNS UUID AS $$
DECLARE
  v_revenue NUMERIC;
  v_deals INT;
  v_certs INT;
  v_new_tier_id UUID;
BEGIN
  -- Get current performance metrics
  SELECT ytd_revenue, ytd_deals_closed, certified_rep_count
  INTO v_revenue, v_deals, v_certs
  FROM organizations WHERE id = p_org_id;

  -- Find the highest tier they qualify for
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

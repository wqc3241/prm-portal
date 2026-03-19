/**
 * Test data factories.
 *
 * All factory functions return plain objects. They do NOT write to the
 * database — that is the responsibility of the integration test setup
 * helpers that import these factories.
 *
 * Default values cover the happy-path. Override any field by passing a
 * partial object as the first argument.
 */

import { v4 as uuidv4 } from 'uuid';

// ── IDs reused across fixtures ────────────────────────────────────────────────

export const TIER_IDS = {
  registered: uuidv4(),
  innovator: uuidv4(),
  platinum: uuidv4(),
  diamond: uuidv4(),
} as const;

export const ORG_IDS = {
  orgA: uuidv4(),
  orgB: uuidv4(),
} as const;

export const USER_IDS = {
  admin: uuidv4(),
  channelManager: uuidv4(),
  partnerAdminA: uuidv4(),
  partnerRepA: uuidv4(),
  partnerAdminB: uuidv4(),
  partnerRepB: uuidv4(),
} as const;

// ── Tier factories ────────────────────────────────────────────────────────────

export interface TierFixture {
  id: string;
  name: string;
  rank: number;
  color_hex: string;
  min_annual_revenue: number;
  min_deals_closed: number;
  min_certified_reps: number;
  min_csat_score: number;
  default_discount_pct: number;
  max_discount_pct: number;
  mdf_budget_pct: number;
  lead_priority: number;
  dedicated_channel_mgr: boolean;
  description: string | null;
}

export function makeTier(overrides: Partial<TierFixture> = {}): TierFixture {
  return {
    id: uuidv4(),
    name: `Test Tier ${Math.random().toString(36).slice(2, 7)}`,
    rank: 1,
    color_hex: '#AABBCC',
    min_annual_revenue: 0,
    min_deals_closed: 0,
    min_certified_reps: 0,
    min_csat_score: 0,
    default_discount_pct: 5,
    max_discount_pct: 15,
    mdf_budget_pct: 2,
    lead_priority: 1,
    dedicated_channel_mgr: false,
    description: null,
    ...overrides,
  };
}

export const registeredTier = (): TierFixture =>
  makeTier({ id: TIER_IDS.registered, name: 'Registered', rank: 1, default_discount_pct: 0, max_discount_pct: 0 });

export const innovatorTier = (): TierFixture =>
  makeTier({ id: TIER_IDS.innovator, name: 'Innovator', rank: 2, default_discount_pct: 5, max_discount_pct: 10 });

// ── Organization factories ────────────────────────────────────────────────────

export interface OrgFixture {
  id: string;
  name: string;
  tier_id: string;
  status: string;
  channel_manager_id: string | null;
  domain: string | null;
  website: string | null;
  phone: string | null;
  ytd_revenue: number;
  ytd_deals_closed: number;
  certified_rep_count: number;
}

export function makeOrg(overrides: Partial<OrgFixture> = {}): OrgFixture {
  return {
    id: uuidv4(),
    name: `Test Org ${Math.random().toString(36).slice(2, 7)}`,
    tier_id: TIER_IDS.registered,
    status: 'active',
    channel_manager_id: null,
    domain: null,
    website: null,
    phone: null,
    ytd_revenue: 0,
    ytd_deals_closed: 0,
    certified_rep_count: 0,
    ...overrides,
  };
}

export const orgA = (): OrgFixture =>
  makeOrg({ id: ORG_IDS.orgA, name: 'Org Alpha', tier_id: TIER_IDS.registered, status: 'active' });

export const orgB = (): OrgFixture =>
  makeOrg({ id: ORG_IDS.orgB, name: 'Org Beta', tier_id: TIER_IDS.registered, status: 'active' });

export const suspendedOrg = (): OrgFixture =>
  makeOrg({ id: uuidv4(), name: 'Suspended Org', status: 'suspended' });

// ── User factories ────────────────────────────────────────────────────────────

export interface UserFixture {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  first_name: string;
  last_name: string;
  organization_id: string | null;
  is_active: boolean;
  email_verified: boolean;
  refresh_token: string | null;
  password_reset_token: string | null;
  password_reset_expires: Date | null;
}

export function makeUser(overrides: Partial<UserFixture> = {}): UserFixture {
  return {
    id: uuidv4(),
    email: `user.${Math.random().toString(36).slice(2, 8)}@example.com`,
    // bcrypt hash of 'Password1!' with rounds=1 — pre-computed for speed
    password_hash: '$2a$01$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', // 'secret'
    role: 'partner_rep',
    first_name: 'Test',
    last_name: 'User',
    organization_id: ORG_IDS.orgA,
    is_active: true,
    email_verified: false,
    refresh_token: null,
    password_reset_token: null,
    password_reset_expires: null,
    ...overrides,
  };
}

export const adminUser = (): UserFixture =>
  makeUser({ id: USER_IDS.admin, email: 'admin@example.com', role: 'admin', organization_id: null });

export const channelManagerUser = (): UserFixture =>
  makeUser({ id: USER_IDS.channelManager, email: 'cm@example.com', role: 'channel_manager', organization_id: null });

export const partnerAdminA = (): UserFixture =>
  makeUser({ id: USER_IDS.partnerAdminA, email: 'partner.admin.a@example.com', role: 'partner_admin', organization_id: ORG_IDS.orgA });

export const partnerRepA = (): UserFixture =>
  makeUser({ id: USER_IDS.partnerRepA, email: 'partner.rep.a@example.com', role: 'partner_rep', organization_id: ORG_IDS.orgA });

export const partnerAdminB = (): UserFixture =>
  makeUser({ id: USER_IDS.partnerAdminB, email: 'partner.admin.b@example.com', role: 'partner_admin', organization_id: ORG_IDS.orgB });

export const deactivatedUser = (): UserFixture =>
  makeUser({ email: 'deactivated@example.com', is_active: false, organization_id: ORG_IDS.orgA });

// ── Product factories ─────────────────────────────────────────────────────────

export interface ProductFixture {
  id: string;
  sku: string;
  name: string;
  list_price: number;
  is_active: boolean;
  available_to_partners: boolean;
  category_id: string | null;
  product_type: string | null;
}

export function makeProduct(overrides: Partial<ProductFixture> = {}): ProductFixture {
  return {
    id: uuidv4(),
    sku: `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: `Product ${Math.random().toString(36).slice(2, 7)}`,
    list_price: 9999.99,
    is_active: true,
    available_to_partners: true,
    category_id: null,
    product_type: 'hardware',
    ...overrides,
  };
}

// ── Deal factories ────────────────────────────────────────────────────────────

export type DealStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'won'
  | 'lost'
  | 'expired';

export interface DealFixture {
  id: string;
  deal_number: string;
  organization_id: string;
  submitted_by: string;
  assigned_to: string | null;
  customer_company_name: string;
  customer_contact_name: string | null;
  customer_contact_email: string | null;
  customer_contact_phone: string | null;
  customer_industry: string | null;
  customer_address: string | null;
  deal_name: string;
  description: string | null;
  status: DealStatus;
  estimated_value: number;
  actual_value: number | null;
  currency: string;
  win_probability: number | null;
  expected_close_date: string;
  actual_close_date: string | null;
  registration_expires_at: Date | null;
  primary_product_id: string | null;
  is_conflicting: boolean;
  conflict_deal_id: string | null;
  conflict_notes: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  source: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export function makeDeal(overrides: Partial<DealFixture> = {}): DealFixture {
  const now = new Date();
  return {
    id: uuidv4(),
    deal_number: `DR-2026-${String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0')}`,
    organization_id: ORG_IDS.orgA,
    submitted_by: USER_IDS.partnerRepA,
    assigned_to: null,
    customer_company_name: 'Acme Corporation',
    customer_contact_name: 'John Smith',
    customer_contact_email: 'john.smith@acme.com',
    customer_contact_phone: '+1-555-0100',
    customer_industry: 'Financial Services',
    customer_address: '123 Main St, New York, NY 10001',
    deal_name: 'Acme Corp - PA-5400 Network Refresh',
    description: 'Customer replacing legacy Cisco ASA firewalls with PA-5400 series.',
    status: 'draft',
    estimated_value: 450000,
    actual_value: null,
    currency: 'USD',
    win_probability: 65,
    expected_close_date: '2026-06-30',
    actual_close_date: null,
    registration_expires_at: null,
    primary_product_id: null,
    is_conflicting: false,
    conflict_deal_id: null,
    conflict_notes: null,
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    source: 'direct',
    tags: [],
    custom_fields: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/** Draft deal ready to be submitted (all required fields populated). */
export const draftDeal = (): DealFixture =>
  makeDeal({
    id: uuidv4(),
    status: 'draft',
    customer_company_name: 'Acme Corporation',
    deal_name: 'Acme Corp - PA-5400 Network Refresh',
    estimated_value: 450000,
    expected_close_date: '2026-06-30',
  });

/** Deal in submitted status, awaiting CM review. */
export const submittedDeal = (): DealFixture =>
  makeDeal({
    id: uuidv4(),
    status: 'submitted',
    assigned_to: USER_IDS.channelManager,
  });

/** Approved deal with 90-day protection window. */
export const approvedDeal = (): DealFixture => {
  const approvedAt = new Date();
  const expiresAt = new Date(approvedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
  return makeDeal({
    id: uuidv4(),
    status: 'approved',
    assigned_to: USER_IDS.channelManager,
    approved_by: USER_IDS.channelManager,
    approved_at: approvedAt,
    registration_expires_at: expiresAt,
  });
};

/** Approved deal with registration_expires_at in the past (needs expiration job). */
export const expiredProtectionDeal = (): DealFixture => {
  const approvedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
  const expiresAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  return makeDeal({
    id: uuidv4(),
    status: 'approved', // still shows approved until job runs
    assigned_to: USER_IDS.channelManager,
    approved_by: USER_IDS.channelManager,
    approved_at: approvedAt,
    registration_expires_at: expiresAt,
  });
};

/** Deal in rejected status (editable, resubmittable). */
export const rejectedDeal = (): DealFixture =>
  makeDeal({
    id: uuidv4(),
    status: 'rejected',
    rejection_reason: 'Duplicate registration. Another partner has priority.',
    assigned_to: USER_IDS.channelManager,
  });

/** Deal with a conflict flag set. */
export const conflictingDeal = (): DealFixture =>
  makeDeal({
    id: uuidv4(),
    status: 'submitted',
    is_conflicting: true,
    conflict_deal_id: uuidv4(),
    assigned_to: USER_IDS.channelManager,
  });

/** Won deal with actual value recorded. */
export const wonDeal = (): DealFixture => {
  const approvedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return makeDeal({
    id: uuidv4(),
    status: 'won',
    approved_by: USER_IDS.channelManager,
    approved_at: approvedAt,
    actual_value: 425000,
    actual_close_date: new Date().toISOString().slice(0, 10),
  });
};

/** Deal from Org B (used for cross-org scoping tests). */
export const orgBDeal = (): DealFixture =>
  makeDeal({
    id: uuidv4(),
    organization_id: ORG_IDS.orgB,
    submitted_by: USER_IDS.partnerAdminB,
    status: 'submitted',
  });

// ── Deal product factory ──────────────────────────────────────────────────────

export interface DealProductFixture {
  id: string;
  deal_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
}

export function makeDealProduct(overrides: Partial<DealProductFixture> = {}): DealProductFixture {
  const quantity = overrides.quantity ?? 1;
  const unitPrice = overrides.unit_price ?? 75000;
  const discountPct = overrides.discount_pct ?? 10;
  const lineTotal = overrides.line_total ?? quantity * unitPrice * (1 - discountPct / 100);
  return {
    id: uuidv4(),
    deal_id: 'deal-uuid-1',
    product_id: uuidv4(),
    quantity,
    unit_price: unitPrice,
    discount_pct: discountPct,
    line_total: lineTotal,
    ...overrides,
  };
}

// ── JWT payload factories ─────────────────────────────────────────────────────

export type UserRole = 'admin' | 'channel_manager' | 'partner_admin' | 'partner_rep';

export interface JwtPayloadFixture {
  sub: string;
  email: string;
  role: UserRole;
  org_id: string | null;
  tier_id: string | null;
}

export function makeJwtPayload(overrides: Partial<JwtPayloadFixture> = {}): JwtPayloadFixture {
  return {
    sub: uuidv4(),
    email: 'user@example.com',
    role: 'partner_admin',
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
    ...overrides,
  };
}

export const adminPayload = (): JwtPayloadFixture =>
  makeJwtPayload({ sub: USER_IDS.admin, email: 'admin@example.com', role: 'admin', org_id: null, tier_id: null });

export const cmPayload = (): JwtPayloadFixture =>
  makeJwtPayload({ sub: USER_IDS.channelManager, email: 'cm@example.com', role: 'channel_manager', org_id: null, tier_id: null });

export const partnerAdminPayload = (): JwtPayloadFixture =>
  makeJwtPayload({ sub: USER_IDS.partnerAdminA, email: 'partner.admin.a@example.com', role: 'partner_admin', org_id: ORG_IDS.orgA, tier_id: TIER_IDS.registered });

export const partnerRepPayload = (): JwtPayloadFixture =>
  makeJwtPayload({ sub: USER_IDS.partnerRepA, email: 'partner.rep.a@example.com', role: 'partner_rep', org_id: ORG_IDS.orgA, tier_id: TIER_IDS.registered });

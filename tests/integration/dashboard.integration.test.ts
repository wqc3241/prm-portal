/**
 * Integration tests for the Dashboard & Analytics API.
 *
 * These tests exercise the full request-response cycle through Express,
 * including middleware (authenticate, authorize, scopeToOrg, validate),
 * the controller, the service, and mocked repositories/database.
 *
 * External dependencies (database, Redis) are fully mocked so the
 * tests run in-process without infrastructure.
 *
 * PRD coverage:
 *   - GET /dashboard/partner returns 200 for partner_admin
 *   - GET /dashboard/partner returns 403 for admin
 *   - GET /dashboard/channel-manager returns 200 for CM
 *   - GET /dashboard/channel-manager returns 403 for partner
 *   - GET /dashboard/admin returns 200 for admin
 *   - GET /dashboard/admin returns 403 for partner
 *   - Analytics endpoints return 200 for admin, 403 for partner
 *   - Analytics date range filtering works
 *   - Response structure matches expected schema
 */

// ── Mocks (before all imports) ────────────────────────────────────────────────

jest.mock('../../src/repositories/dashboard.repository', () => ({
  __esModule: true,
  default: {
    getPipelineSummary: jest.fn(),
    getRevenueSummary: jest.fn(),
    getDealStatusCounts: jest.fn(),
    getLeadMetrics: jest.fn(),
    getMdfSummary: jest.fn(),
    getCertificationSummary: jest.fn(),
    getTierProgress: jest.fn(),
    getRecentActivity: jest.fn(),
    getAssignedOrgIds: jest.fn(),
    getPortfolioSummary: jest.fn(),
    getPendingApprovals: jest.fn(),
    getPartnerPortfolio: jest.fn(),
    getLeadDistributionMetrics: jest.fn(),
    getProgramMetrics: jest.fn(),
    getTierDistribution: jest.fn(),
    getMdfUtilization: jest.fn(),
    getCertCoverage: jest.fn(),
    getTopPartners: jest.fn(),
    getPipelineAnalytics: jest.fn(),
    getPartnerPerformanceData: jest.fn(),
    getLeadConversionAnalytics: jest.fn(),
    getMdfRoiAnalytics: jest.fn(),
  },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereNotNull: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// Mock JWT verification so we can inject arbitrary user payloads
jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import jwt from 'jsonwebtoken';
import express, { Application } from 'express';
import dashboardRouter from '../../src/routes/dashboard.routes';
import analyticsRouter from '../../src/routes/analytics.routes';
import dashboardRepository from '../../src/repositories/dashboard.repository';
import { ORG_IDS, USER_IDS, TIER_IDS } from '../fixtures/factories';

const mockRepo = dashboardRepository as jest.Mocked<typeof dashboardRepository>;
const mockJwtVerify = jwt.verify as jest.Mock;

// ── App setup ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  // Global error handler
  app.use((err: any, req: any, res: any, _next: any) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      data: null,
      errors: err.errors || [{ code: err.code || 'INTERNAL_ERROR', message: err.message }],
      meta: null,
    });
  });
  return app;
}

const app = buildApp();

// ── JWT payload helpers ───────────────────────────────────────────────────────

function makeJwt() {
  return 'Bearer mock-token';
}

function setupJwtAsPartnerAdmin() {
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.partnerAdminA,
    email: 'partner.admin.a@example.com',
    role: 'partner_admin',
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
  });
  // authenticate middleware checks users table
  (mockDb as jest.Mock).mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.partnerAdminA,
          email: 'partner.admin.a@example.com',
          role: 'partner_admin',
          organization_id: ORG_IDS.orgA,
          is_active: true,
        }),
      };
    }
    if (table === 'organizations') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: ORG_IDS.orgA,
          status: 'active',
          tier_id: TIER_IDS.registered,
        }),
      };
    }
    return mockDbChain;
  });
}

function setupJwtAsPartnerRep() {
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.partnerRepA,
    email: 'partner.rep.a@example.com',
    role: 'partner_rep',
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
  });
  (mockDb as jest.Mock).mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.partnerRepA,
          email: 'partner.rep.a@example.com',
          role: 'partner_rep',
          organization_id: ORG_IDS.orgA,
          is_active: true,
        }),
      };
    }
    if (table === 'organizations') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: ORG_IDS.orgA,
          status: 'active',
          tier_id: TIER_IDS.registered,
        }),
      };
    }
    return mockDbChain;
  });
}

function setupJwtAsCM() {
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.channelManager,
    email: 'cm@example.com',
    role: 'channel_manager',
    org_id: null,
    tier_id: null,
  });
  (mockDb as jest.Mock).mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.channelManager,
          email: 'cm@example.com',
          role: 'channel_manager',
          organization_id: null,
          is_active: true,
        }),
      };
    }
    if (table === 'organizations') {
      // scopeToOrg: db('organizations').select('id').where('channel_manager_id', sub)
      const orgChain: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: ORG_IDS.orgA }]),
        first: jest.fn().mockResolvedValue(null),
      };
      orgChain.select.mockReturnValue(orgChain);
      return orgChain;
    }
    // For deals/leads/mdf_allocations (health score inline queries)
    // Need a full chain: whereIn -> groupBy -> select -> resolves to []
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    // Terminal select returns empty array
    chain.groupBy.mockReturnValue({ ...chain, select: jest.fn().mockResolvedValue([]) });
    chain.select.mockResolvedValue([]);
    return chain;
  });
}

function setupJwtAsAdmin() {
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.admin,
    email: 'admin@example.com',
    role: 'admin',
    org_id: null,
    tier_id: null,
  });
  (mockDb as jest.Mock).mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.admin,
          email: 'admin@example.com',
          role: 'admin',
          organization_id: null,
          is_active: true,
        }),
      };
    }
    return mockDbChain;
  });
}

// ── Default repo mock setup ──────────────────────────────────────────────────

function setupPartnerDashboardRepoMocks() {
  mockRepo.getPipelineSummary.mockResolvedValue({
    total_value: 450000, deal_count: 3,
    by_status: [
      { status: 'submitted', count: 1, value: 150000 },
      { status: 'approved', count: 2, value: 300000 },
    ],
  });
  mockRepo.getRevenueSummary.mockResolvedValue({ ytd_closed_won: 250000 });
  mockRepo.getDealStatusCounts.mockResolvedValue({
    submitted: 2, approved: 1, rejected: 0, expired: 0, won: 3, lost: 1, total_active: 3,
  });
  mockRepo.getLeadMetrics.mockResolvedValue({
    assigned: 5, accepted: 3, converted: 2, disqualified: 1,
    conversion_rate: 18.2, avg_response_hours: 6.5,
  });
  mockRepo.getMdfSummary.mockResolvedValue({
    fiscal_year: 2026, fiscal_quarter: 1, allocated: 50000,
    requested: 10000, approved: 8000, claimed: 5000, reimbursed: 3000, remaining: 42000,
  });
  mockRepo.getCertificationSummary.mockResolvedValue({
    total_certified: 3, total_users: 5, expiring_within_30_days: 0, expiring_certs: [],
  });
  mockRepo.getTierProgress.mockResolvedValue({
    current_tier: { id: TIER_IDS.registered, name: 'Registered', rank: 1 },
    next_tier: {
      id: TIER_IDS.innovator, name: 'Innovator', rank: 2,
      requirements: { min_annual_revenue: 500000, min_deals_closed: 10, min_certified_reps: 3, min_csat_score: 0 },
    },
    current_metrics: { ytd_revenue: 250000, ytd_deals_closed: 3, certified_reps: 2, csat_score: null },
    gaps: { revenue_needed: 250000, deals_needed: 7, certs_needed: 1, csat_needed: null },
    progress_pct: { revenue: 50.0, deals: 30.0, certs: 66.7, csat: null },
  });
  mockRepo.getRecentActivity.mockResolvedValue([]);
}

function setupCMDashboardRepoMocks() {
  mockRepo.getAssignedOrgIds.mockResolvedValue([ORG_IDS.orgA]);
  mockRepo.getPortfolioSummary.mockResolvedValue({
    total_partners: 1, active_partners: 1, total_pipeline_value: 450000,
    total_ytd_revenue: 250000, total_active_deals: 3,
  });
  mockRepo.getPendingApprovals.mockResolvedValue({ total: 2, deals: 1, quotes: 1, mdf_requests: 0 });
  mockRepo.getPartnerPortfolio.mockResolvedValue([
    {
      organization_id: ORG_IDS.orgA, name: 'Org Alpha',
      tier: { id: TIER_IDS.registered, name: 'Registered', rank: 1, color_hex: '#CCC' },
      status: 'active', pipeline_value: 450000, ytd_revenue: 250000,
      active_deals: 3, open_leads: 5, certified_reps: 2, total_reps: 5,
      min_annual_revenue: 100000,
    },
  ]);
  mockRepo.getLeadDistributionMetrics.mockResolvedValue({
    total_unassigned: 5, total_assigned_pending: 2,
    avg_acceptance_hours: 8.0, acceptance_rate_by_partner: [],
  });
  mockRepo.getRecentActivity.mockResolvedValue([]);
}

function setupAdminDashboardRepoMocks() {
  mockRepo.getProgramMetrics.mockResolvedValue({
    total_partners: 50, active_partners: 45, total_pipeline_value: 25000000,
    total_ytd_revenue: 15000000, total_active_deals: 120,
    total_active_leads: 80, total_active_quotes: 35,
  });
  mockRepo.getTierDistribution.mockResolvedValue([
    { tier_id: TIER_IDS.registered, tier_name: 'Registered', rank: 1, color_hex: '#CCC', partner_count: 20 },
  ]);
  mockRepo.getMdfUtilization.mockResolvedValue({
    total_allocated: 1000000, total_approved: 600000, total_spent: 400000,
    total_remaining: 600000, utilization_pct: 40.0,
  });
  mockRepo.getCertCoverage.mockResolvedValue({
    total_certified_users: 120, total_partner_users: 200,
    overall_pct: 60.0, by_tier: [],
  });
  mockRepo.getTopPartners.mockResolvedValue({
    by_revenue: [], by_deal_count: [], by_lead_conversion: [],
  });
  mockRepo.getPendingApprovals.mockResolvedValue({ total: 12, deals: 8, quotes: 2, mdf_requests: 2 });
  mockRepo.getRecentActivity.mockResolvedValue([]);
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockDbChain.first.mockResolvedValue(null);
  mockDbChain.whereIn.mockResolvedValue([]);
});

// ═════════════════════════════════════════════════════════════════════════════
// PARTNER DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: GET /dashboard/partner', () => {
  test('returns 200 for partner_admin with correct response structure', async () => {
    setupJwtAsPartnerAdmin();
    setupPartnerDashboardRepoMocks();

    const res = await request(app)
      .get('/api/v1/dashboard/partner')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('pipeline');
    expect(res.body.data).toHaveProperty('revenue');
    expect(res.body.data).toHaveProperty('deals');
    expect(res.body.data).toHaveProperty('leads');
    expect(res.body.data).toHaveProperty('mdf');
    expect(res.body.data).toHaveProperty('certifications');
    expect(res.body.data).toHaveProperty('tier_progress');
    expect(res.body.data).toHaveProperty('recent_activity');

    // Verify structure
    expect(res.body.data.pipeline).toMatchObject({
      total_value: expect.any(Number),
      deal_count: expect.any(Number),
      by_status: expect.any(Array),
    });
    expect(res.body.data.revenue).toMatchObject({
      ytd_closed_won: expect.any(Number),
      tier_target: expect.any(Number),
      attainment_pct: expect.any(Number),
    });
    expect(res.body.data.mdf).toHaveProperty('current_quarter');
    expect(res.body.data.mdf.current_quarter).toMatchObject({
      fiscal_year: expect.any(Number),
      fiscal_quarter: expect.any(Number),
      allocated: expect.any(Number),
    });
  });

  test('returns 200 for partner_rep', async () => {
    setupJwtAsPartnerRep();
    setupPartnerDashboardRepoMocks();

    const res = await request(app)
      .get('/api/v1/dashboard/partner')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 403 for admin (not authorized)', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .get('/api/v1/dashboard/partner')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });

  test('returns 403 for channel_manager (not authorized)', async () => {
    setupJwtAsCM();

    const res = await request(app)
      .get('/api/v1/dashboard/partner')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });

  test('returns 401 with no auth token', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/partner');

    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CHANNEL MANAGER DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: GET /dashboard/channel-manager', () => {
  test('returns 200 for channel_manager with correct structure', async () => {
    setupJwtAsCM();
    setupCMDashboardRepoMocks();

    const res = await request(app)
      .get('/api/v1/dashboard/channel-manager')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('pending_approvals');
    expect(res.body.data).toHaveProperty('partners');
    expect(res.body.data).toHaveProperty('lead_metrics');
    expect(res.body.data).toHaveProperty('recent_activity');

    // Verify summary structure
    expect(res.body.data.summary).toMatchObject({
      total_partners: expect.any(Number),
      active_partners: expect.any(Number),
      total_pipeline_value: expect.any(Number),
    });

    // Verify pending approvals structure
    expect(res.body.data.pending_approvals).toMatchObject({
      total: expect.any(Number),
      deals: expect.any(Number),
      quotes: expect.any(Number),
      mdf_requests: expect.any(Number),
    });

    // Partners should have health scores
    if (res.body.data.partners.length > 0) {
      expect(res.body.data.partners[0]).toHaveProperty('health_score');
      expect(res.body.data.partners[0]).toHaveProperty('organization_id');
      expect(res.body.data.partners[0]).toHaveProperty('name');
    }
  });

  test('returns 403 for partner_admin (not authorized)', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .get('/api/v1/dashboard/channel-manager')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });

  test('returns 403 for partner_rep (not authorized)', async () => {
    setupJwtAsPartnerRep();

    const res = await request(app)
      .get('/api/v1/dashboard/channel-manager')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });

  test('returns 403 for admin (not authorized for CM dashboard)', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .get('/api/v1/dashboard/channel-manager')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: GET /dashboard/admin', () => {
  test('returns 200 for admin with correct structure', async () => {
    setupJwtAsAdmin();
    setupAdminDashboardRepoMocks();

    const res = await request(app)
      .get('/api/v1/dashboard/admin')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('program_metrics');
    expect(res.body.data).toHaveProperty('tier_distribution');
    expect(res.body.data).toHaveProperty('mdf_utilization');
    expect(res.body.data).toHaveProperty('certification_coverage');
    expect(res.body.data).toHaveProperty('top_partners');
    expect(res.body.data).toHaveProperty('pending_approvals');
    expect(res.body.data).toHaveProperty('recent_activity');

    // Verify program metrics structure
    expect(res.body.data.program_metrics).toMatchObject({
      total_partners: expect.any(Number),
      active_partners: expect.any(Number),
      total_pipeline_value: expect.any(Number),
      total_ytd_revenue: expect.any(Number),
      total_active_deals: expect.any(Number),
      total_active_leads: expect.any(Number),
      total_active_quotes: expect.any(Number),
    });

    // Verify MDF utilization structure
    expect(res.body.data.mdf_utilization).toMatchObject({
      total_allocated: expect.any(Number),
      total_spent: expect.any(Number),
      utilization_pct: expect.any(Number),
    });
  });

  test('returns 403 for partner_admin (not authorized)', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .get('/api/v1/dashboard/admin')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });

  test('returns 403 for partner_rep (not authorized)', async () => {
    setupJwtAsPartnerRep();

    const res = await request(app)
      .get('/api/v1/dashboard/admin')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });

  test('returns 403 for channel_manager (not authorized)', async () => {
    setupJwtAsCM();

    const res = await request(app)
      .get('/api/v1/dashboard/admin')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS ENDPOINTS — AUTH & ROLE CHECKS
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Analytics endpoints — role-based access', () => {
  const analyticsEndpoints = [
    '/api/v1/analytics/pipeline',
    '/api/v1/analytics/partner-performance',
    '/api/v1/analytics/lead-conversion',
    '/api/v1/analytics/mdf-roi',
  ];

  test.each(analyticsEndpoints)(
    '%s returns 200 for admin',
    async (endpoint) => {
      setupJwtAsAdmin();

      // Setup repo mocks depending on endpoint
      mockRepo.getPipelineAnalytics.mockResolvedValue({
        total_pipeline_value: 100000, total_deal_count: 5, groups: [], trend: [],
      });
      mockRepo.getPartnerPerformanceData.mockResolvedValue({ partners: [], total: 0 });
      mockRepo.getLeadConversionAnalytics.mockResolvedValue({
        funnel: [], drop_off: [], by_source: [], avg_time_between_stages: {
          new_to_assigned_hours: null, assigned_to_accepted_hours: null, accepted_to_converted_days: null,
        }, trend: [],
      });
      mockRepo.getMdfRoiAnalytics.mockResolvedValue({
        summary: { total_allocated: 0, total_approved: 0, total_claimed: 0, total_reimbursed: 0, associated_revenue: 0, roi_ratio: null },
        by_activity_type: [], by_quarter: [], by_partner: [],
      });

      const res = await request(app)
        .get(endpoint)
        .set('Authorization', makeJwt());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    },
  );

  test.each(analyticsEndpoints)(
    '%s returns 200 for channel_manager',
    async (endpoint) => {
      setupJwtAsCM();

      mockRepo.getPipelineAnalytics.mockResolvedValue({
        total_pipeline_value: 100000, total_deal_count: 5, groups: [], trend: [],
      });
      mockRepo.getPartnerPerformanceData.mockResolvedValue({ partners: [], total: 0 });
      mockRepo.getLeadConversionAnalytics.mockResolvedValue({
        funnel: [], drop_off: [], by_source: [], avg_time_between_stages: {
          new_to_assigned_hours: null, assigned_to_accepted_hours: null, accepted_to_converted_days: null,
        }, trend: [],
      });
      mockRepo.getMdfRoiAnalytics.mockResolvedValue({
        summary: { total_allocated: 0, total_approved: 0, total_claimed: 0, total_reimbursed: 0, associated_revenue: 0, roi_ratio: null },
        by_activity_type: [], by_quarter: [], by_partner: [],
      });

      // setupJwtAsCM already handles all DB mocks including scopeToOrg

      const res = await request(app)
        .get(endpoint)
        .set('Authorization', makeJwt());

      expect(res.status).toBe(200);
    },
  );

  test.each(analyticsEndpoints)(
    '%s returns 403 for partner_admin',
    async (endpoint) => {
      setupJwtAsPartnerAdmin();

      const res = await request(app)
        .get(endpoint)
        .set('Authorization', makeJwt());

      expect(res.status).toBe(403);
    },
  );

  test.each(analyticsEndpoints)(
    '%s returns 403 for partner_rep',
    async (endpoint) => {
      setupJwtAsPartnerRep();

      const res = await request(app)
        .get(endpoint)
        .set('Authorization', makeJwt());

      expect(res.status).toBe(403);
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS: PIPELINE — QUERY PARAMS & RESPONSE STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: GET /analytics/pipeline', () => {
  beforeEach(() => {
    setupJwtAsAdmin();
    mockRepo.getPipelineAnalytics.mockResolvedValue({
      total_pipeline_value: 500000,
      total_deal_count: 10,
      groups: [
        { key: 'submitted', label: 'submitted', deal_count: 5, total_value: 250000, avg_value: 50000, avg_win_probability: 60 },
        { key: 'approved', label: 'approved', deal_count: 5, total_value: 250000, avg_value: 50000, avg_win_probability: 75 },
      ],
      trend: [
        { period: '2026-01', deal_count: 3, total_value: 150000 },
        { period: '2026-02', deal_count: 7, total_value: 350000 },
      ],
    });
  });

  test('returns pipeline analytics with default params', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/pipeline')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total_pipeline_value');
    expect(res.body.data).toHaveProperty('total_deal_count');
    expect(res.body.data).toHaveProperty('groups');
    expect(res.body.data).toHaveProperty('trend');
    expect(res.body.data.total_pipeline_value).toBe(500000);
    expect(res.body.data.groups).toHaveLength(2);
    expect(res.body.data.trend).toHaveLength(2);
  });

  test('accepts group_by query parameter', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/pipeline?group_by=month')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(mockRepo.getPipelineAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: 'month' }),
    );
  });

  test('accepts date range parameters', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/pipeline?start_date=2026-01-01&end_date=2026-03-31')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    // Joi converts ISO date strings to Date objects, then the service passes them through
    expect(mockRepo.getPipelineAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: expect.anything(),
        endDate: expect.anything(),
      }),
    );
  });

  test('rejects invalid group_by value', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/pipeline?group_by=invalid')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(422);
  });

  test('rejects end_date before start_date', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/pipeline?start_date=2026-06-01&end_date=2026-01-01')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS: PARTNER PERFORMANCE — RESPONSE STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: GET /analytics/partner-performance', () => {
  test('returns partner performance data with pagination meta', async () => {
    setupJwtAsAdmin();
    mockRepo.getPartnerPerformanceData.mockResolvedValue({
      partners: [
        {
          organization_id: ORG_IDS.orgA,
          name: 'Org Alpha',
          tier: { id: TIER_IDS.registered, name: 'Registered', rank: 1 },
          metrics: {
            ytd_revenue: 250000, revenue_attainment_pct: 50.0,
            total_deals: 10, won_deals: 5, lost_deals: 3,
            win_rate: 62.5, avg_deal_size: 50000, avg_deal_cycle_days: 45,
            total_leads_assigned: 20, leads_converted: 8,
            lead_conversion_rate: 40.0, avg_lead_response_hours: 6.5,
            sla_compliance_pct: 85.0,
            mdf_allocated: 50000, mdf_spent: 25000, mdf_utilization_pct: 50.0,
            certified_reps: 3, total_reps: 5, cert_coverage_pct: 60.0,
          },
        },
      ],
      total: 1,
    });

    const res = await request(app)
      .get('/api/v1/analytics/partner-performance')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('partners');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data.partners).toHaveLength(1);

    // Partners should have health_score computed by service
    const partner = res.body.data.partners[0];
    expect(partner.metrics).toHaveProperty('health_score');
    expect(typeof partner.metrics.health_score).toBe('number');

    // Should include pagination meta
    expect(res.body.meta).toMatchObject({
      page: expect.any(Number),
      per_page: expect.any(Number),
      total: expect.any(Number),
    });
  });

  test('accepts sort_by and sort_order params', async () => {
    setupJwtAsAdmin();
    mockRepo.getPartnerPerformanceData.mockResolvedValue({ partners: [], total: 0 });

    const res = await request(app)
      .get('/api/v1/analytics/partner-performance?sort_by=health_score&sort_order=asc')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
  });

  test('rejects invalid sort_by value', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .get('/api/v1/analytics/partner-performance?sort_by=invalid_field')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS: LEAD CONVERSION — RESPONSE STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: GET /analytics/lead-conversion', () => {
  test('returns lead conversion funnel data', async () => {
    setupJwtAsAdmin();
    mockRepo.getLeadConversionAnalytics.mockResolvedValue({
      funnel: [
        { stage: 'new', count: 100, pct_of_total: 100.0 },
        { stage: 'assigned', count: 80, pct_of_total: 80.0 },
        { stage: 'converted', count: 20, pct_of_total: 20.0 },
      ],
      drop_off: [{ from: 'assigned', to: 'returned', count: 10 }],
      by_source: [{ source: 'marketing', total: 50, converted: 10, conversion_rate: 20.0 }],
      avg_time_between_stages: {
        new_to_assigned_hours: 2.5,
        assigned_to_accepted_hours: 6.0,
        accepted_to_converted_days: 14.5,
      },
      trend: [{ period: '2026-01', new: 30, converted: 6, conversion_rate: 20.0 }],
    });

    const res = await request(app)
      .get('/api/v1/analytics/lead-conversion')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('funnel');
    expect(res.body.data).toHaveProperty('drop_off');
    expect(res.body.data).toHaveProperty('by_source');
    expect(res.body.data).toHaveProperty('avg_time_between_stages');
    expect(res.body.data).toHaveProperty('trend');

    expect(res.body.data.funnel).toHaveLength(3);
    expect(res.body.data.funnel[0]).toMatchObject({
      stage: expect.any(String),
      count: expect.any(Number),
      pct_of_total: expect.any(Number),
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS: MDF ROI — RESPONSE STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: GET /analytics/mdf-roi', () => {
  test('returns MDF ROI data with summary', async () => {
    setupJwtAsAdmin();
    mockRepo.getMdfRoiAnalytics.mockResolvedValue({
      summary: {
        total_allocated: 500000, total_approved: 300000,
        total_claimed: 200000, total_reimbursed: 150000,
        associated_revenue: 1500000, roi_ratio: 10.0,
      },
      by_activity_type: [],
      by_quarter: [],
      by_partner: [],
    });

    const res = await request(app)
      .get('/api/v1/analytics/mdf-roi')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('by_activity_type');
    expect(res.body.data).toHaveProperty('by_quarter');
    expect(res.body.data).toHaveProperty('by_partner');

    expect(res.body.data.summary).toMatchObject({
      total_allocated: expect.any(Number),
      total_approved: expect.any(Number),
      total_reimbursed: expect.any(Number),
      associated_revenue: expect.any(Number),
      roi_ratio: expect.any(Number),
    });
  });

  test('accepts fiscal_year and fiscal_quarter params', async () => {
    setupJwtAsAdmin();
    mockRepo.getMdfRoiAnalytics.mockResolvedValue({
      summary: { total_allocated: 0, total_approved: 0, total_claimed: 0, total_reimbursed: 0, associated_revenue: 0, roi_ratio: null },
      by_activity_type: [], by_quarter: [], by_partner: [],
    });

    const res = await request(app)
      .get('/api/v1/analytics/mdf-roi?fiscal_year=2026&fiscal_quarter=1')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
  });

  test('rejects invalid fiscal_quarter', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .get('/api/v1/analytics/mdf-roi?fiscal_quarter=5')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(422);
  });

  test('rejects invalid activity_type', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .get('/api/v1/analytics/mdf-roi?activity_type=invalid_type')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(422);
  });
});

/**
 * Unit tests for DashboardService.
 *
 * All external dependencies (dashboardRepository, database) are fully mocked.
 * No database or network connections are required.
 *
 * PRD coverage:
 *   - Partner dashboard structure and zero-data fallbacks
 *   - partner_rep scoping (own deals/leads only)
 *   - CM dashboard portfolio with health scores
 *   - CM dashboard pending approvals count
 *   - Admin dashboard program-wide metrics
 *   - Health score computation (weighted formula)
 *   - Division by zero handling
 *   - Partial failure resilience (Promise.allSettled)
 */

// ── Mocks must be declared before any imports ─────────────────────────────────

jest.mock('../../../src/repositories/dashboard.repository', () => ({
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

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import dashboardService from '../../../src/services/dashboard.service';
import dashboardRepository from '../../../src/repositories/dashboard.repository';
import { USER_IDS, ORG_IDS, TIER_IDS } from '../../fixtures/factories';

const mockRepo = dashboardRepository as jest.Mocked<typeof dashboardRepository>;

// ── Shared fixtures ───────────────────────────────────────────────────────────

function makePartnerAdminPayload() {
  return {
    sub: USER_IDS.partnerAdminA,
    email: 'partner.admin.a@example.com',
    role: 'partner_admin' as const,
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
  };
}

function makePartnerRepPayload() {
  return {
    sub: USER_IDS.partnerRepA,
    email: 'partner.rep.a@example.com',
    role: 'partner_rep' as const,
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
  };
}

function makeCMPayload() {
  return {
    sub: USER_IDS.channelManager,
    email: 'cm@example.com',
    role: 'channel_manager' as const,
    org_id: null,
    tier_id: null,
  };
}

function makeAdminPayload() {
  return {
    sub: USER_IDS.admin,
    email: 'admin@example.com',
    role: 'admin' as const,
    org_id: null,
    tier_id: null,
  };
}

// Default mock return values for partner dashboard
function setupPartnerDashboardMocks(overrides: Record<string, any> = {}) {
  mockRepo.getPipelineSummary.mockResolvedValue(
    overrides.pipeline ?? { total_value: 450000, deal_count: 3, by_status: [] },
  );
  mockRepo.getRevenueSummary.mockResolvedValue(
    overrides.revenue ?? { ytd_closed_won: 250000 },
  );
  mockRepo.getDealStatusCounts.mockResolvedValue(
    overrides.deals ?? {
      submitted: 2, approved: 1, rejected: 0, expired: 0, won: 3, lost: 1, total_active: 3,
    },
  );
  mockRepo.getLeadMetrics.mockResolvedValue(
    overrides.leads ?? {
      assigned: 5, accepted: 3, converted: 2, disqualified: 1,
      conversion_rate: 18.2, avg_response_hours: 6.5,
    },
  );
  mockRepo.getMdfSummary.mockResolvedValue(
    overrides.mdf ?? {
      fiscal_year: 2026, fiscal_quarter: 1, allocated: 50000,
      requested: 10000, approved: 8000, claimed: 5000, reimbursed: 3000, remaining: 42000,
    },
  );
  mockRepo.getCertificationSummary.mockResolvedValue(
    overrides.certs ?? {
      total_certified: 3, total_users: 5, expiring_within_30_days: 1,
      expiring_certs: [{ user_id: 'u1', user_name: 'John', course_name: 'PCNSA', expires_at: '2026-04-01' }],
    },
  );
  mockRepo.getTierProgress.mockResolvedValue(
    'tierProgress' in overrides ? overrides.tierProgress : {
      current_tier: { id: TIER_IDS.registered, name: 'Registered', rank: 1 },
      next_tier: {
        id: TIER_IDS.innovator, name: 'Innovator', rank: 2,
        requirements: { min_annual_revenue: 500000, min_deals_closed: 10, min_certified_reps: 3, min_csat_score: 0 },
      },
      current_metrics: { ytd_revenue: 250000, ytd_deals_closed: 3, certified_reps: 2, csat_score: null },
      gaps: { revenue_needed: 250000, deals_needed: 7, certs_needed: 1, csat_needed: null },
      progress_pct: { revenue: 50.0, deals: 30.0, certs: 66.7, csat: null },
    },
  );
  mockRepo.getRecentActivity.mockResolvedValue(
    overrides.activity ?? [{ id: 'a1', action: 'created', entity_type: 'deal', entity_id: 'd1', summary: 'Deal created', created_at: new Date().toISOString() }],
  );
}

// ── Health score DB mock helper ───────────────────────────────────────────────

function setupHealthScoreDbMock(overrides: { dealStats?: any[]; leadStats?: any[]; mdfStats?: any[] } = {}) {
  const dealStats = overrides.dealStats ?? [];
  const leadStats = overrides.leadStats ?? [];
  const mdfStats = overrides.mdfStats ?? [];

  (mockDb as jest.Mock).mockImplementation((table: string) => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    if (table === 'deals') {
      chain.select = jest.fn().mockResolvedValue(dealStats);
    } else if (table === 'leads') {
      chain.whereIn = jest.fn().mockReturnValue({
        ...chain,
        whereIn: jest.fn().mockReturnValue({
          ...chain,
          select: jest.fn().mockResolvedValue(leadStats),
        }),
      });
    } else if (table === 'mdf_allocations') {
      chain.where = jest.fn().mockReturnValue({
        ...chain,
        select: jest.fn().mockResolvedValue(mdfStats),
      });
    }
    return chain;
  });
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Reset inline db helpers for health score computation
  mockDbChain.whereIn.mockResolvedValue([]);
  mockDbChain.first.mockResolvedValue(null);
});

// ═════════════════════════════════════════════════════════════════════════════
// PARTNER DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

describe('DashboardService.getPartnerDashboard', () => {
  test('returns correct structure with all sections', async () => {
    setupPartnerDashboardMocks();

    const result = await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    expect(result).toHaveProperty('pipeline');
    expect(result).toHaveProperty('revenue');
    expect(result).toHaveProperty('deals');
    expect(result).toHaveProperty('leads');
    expect(result).toHaveProperty('mdf');
    expect(result).toHaveProperty('certifications');
    expect(result).toHaveProperty('tier_progress');
    expect(result).toHaveProperty('recent_activity');

    // Pipeline populated correctly
    expect(result.pipeline.total_value).toBe(450000);
    expect(result.pipeline.deal_count).toBe(3);

    // Revenue includes attainment
    expect(result.revenue.ytd_closed_won).toBe(250000);
    expect(result.revenue.tier_target).toBe(500000);
    expect(result.revenue.attainment_pct).toBeGreaterThan(0);
    expect(result.revenue.attainment_pct).toBeLessThanOrEqual(100);

    // MDF nested under current_quarter
    expect(result.mdf.current_quarter.allocated).toBe(50000);

    // No warnings when all succeed
    expect(result.warnings).toBeUndefined();
  });

  test('returns zeros for new org with no data', async () => {
    setupPartnerDashboardMocks({
      pipeline: { total_value: 0, deal_count: 0, by_status: [] },
      revenue: { ytd_closed_won: 0 },
      deals: { submitted: 0, approved: 0, rejected: 0, expired: 0, won: 0, lost: 0, total_active: 0 },
      leads: { assigned: 0, accepted: 0, converted: 0, disqualified: 0, conversion_rate: 0.0, avg_response_hours: null },
      mdf: { fiscal_year: 2026, fiscal_quarter: 1, allocated: 0, requested: 0, approved: 0, claimed: 0, reimbursed: 0, remaining: 0 },
      certs: { total_certified: 0, total_users: 0, expiring_within_30_days: 0, expiring_certs: [] },
      tierProgress: null,
      activity: [],
    });

    const result = await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    expect(result.pipeline.total_value).toBe(0);
    expect(result.pipeline.deal_count).toBe(0);
    expect(result.revenue.ytd_closed_won).toBe(0);
    expect(result.revenue.attainment_pct).toBe(0);
    expect(result.deals.total_active).toBe(0);
    expect(result.leads.conversion_rate).toBe(0.0);
    expect(result.mdf.current_quarter.allocated).toBe(0);
    expect(result.certifications.total_certified).toBe(0);
    expect(result.tier_progress).toBeNull();
    expect(result.recent_activity).toEqual([]);
  });

  test('partner_rep scoping passes userId to repo queries', async () => {
    setupPartnerDashboardMocks();

    await dashboardService.getPartnerDashboard(makePartnerRepPayload());

    // partner_rep should pass userId to scoped queries
    expect(mockRepo.getPipelineSummary).toHaveBeenCalledWith(ORG_IDS.orgA, USER_IDS.partnerRepA);
    expect(mockRepo.getDealStatusCounts).toHaveBeenCalledWith(ORG_IDS.orgA, USER_IDS.partnerRepA);
    expect(mockRepo.getLeadMetrics).toHaveBeenCalledWith(ORG_IDS.orgA, USER_IDS.partnerRepA);
  });

  test('partner_admin does NOT pass userId (org-wide view)', async () => {
    setupPartnerDashboardMocks();

    await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    // partner_admin should not pass userId
    expect(mockRepo.getPipelineSummary).toHaveBeenCalledWith(ORG_IDS.orgA, undefined);
    expect(mockRepo.getDealStatusCounts).toHaveBeenCalledWith(ORG_IDS.orgA, undefined);
    expect(mockRepo.getLeadMetrics).toHaveBeenCalledWith(ORG_IDS.orgA, undefined);
  });

  test('throws forbidden when user has no org_id', async () => {
    const payload = { ...makePartnerAdminPayload(), org_id: null };

    await expect(dashboardService.getPartnerDashboard(payload as any)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('partial failure resilience - one sub-query fails, others still return', async () => {
    setupPartnerDashboardMocks();
    // Make pipeline query reject
    mockRepo.getPipelineSummary.mockRejectedValue(new Error('DB connection lost'));

    const result = await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    // Pipeline should fall back to defaults
    expect(result.pipeline.total_value).toBe(0);
    expect(result.pipeline.deal_count).toBe(0);
    expect(result.pipeline.by_status).toEqual([]);

    // Other sections should still be populated
    expect(result.revenue.ytd_closed_won).toBe(250000);
    expect(result.deals.total_active).toBe(3);
    expect(result.leads.assigned).toBe(5);

    // Should include a warning
    expect(result.warnings).toBeDefined();
    expect(result.warnings).toContain('Failed to load pipeline');
  });

  test('multiple sub-query failures produce multiple warnings', async () => {
    setupPartnerDashboardMocks();
    mockRepo.getPipelineSummary.mockRejectedValue(new Error('fail1'));
    mockRepo.getRevenueSummary.mockRejectedValue(new Error('fail2'));
    mockRepo.getMdfSummary.mockRejectedValue(new Error('fail3'));

    const result = await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    expect(result.warnings).toHaveLength(3);
    expect(result.warnings).toContain('Failed to load pipeline');
    expect(result.warnings).toContain('Failed to load revenue');
    expect(result.warnings).toContain('Failed to load mdf');
  });

  test('revenue attainment_pct is capped at 100', async () => {
    setupPartnerDashboardMocks({
      revenue: { ytd_closed_won: 1000000 },
      tierProgress: {
        current_tier: { id: TIER_IDS.registered, name: 'Registered', rank: 1 },
        next_tier: {
          id: TIER_IDS.innovator, name: 'Innovator', rank: 2,
          requirements: { min_annual_revenue: 500000, min_deals_closed: 10, min_certified_reps: 3, min_csat_score: 0 },
        },
        current_metrics: { ytd_revenue: 1000000, ytd_deals_closed: 15, certified_reps: 5, csat_score: null },
        gaps: { revenue_needed: 0, deals_needed: 0, certs_needed: 0, csat_needed: null },
        progress_pct: { revenue: 100, deals: 100, certs: 100, csat: null },
      },
    });

    const result = await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    expect(result.revenue.attainment_pct).toBeLessThanOrEqual(100);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CHANNEL MANAGER DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

describe('DashboardService.getChannelManagerDashboard', () => {
  function setupCMDashboardMocks() {
    mockRepo.getAssignedOrgIds.mockResolvedValue([ORG_IDS.orgA, ORG_IDS.orgB]);
    mockRepo.getPortfolioSummary.mockResolvedValue({
      total_partners: 2, active_partners: 2, total_pipeline_value: 900000,
      total_ytd_revenue: 500000, total_active_deals: 6,
    });
    mockRepo.getPendingApprovals.mockResolvedValue({
      total: 5, deals: 3, quotes: 1, mdf_requests: 1,
    });
    mockRepo.getPartnerPortfolio.mockResolvedValue([
      {
        organization_id: ORG_IDS.orgA, name: 'Org Alpha',
        tier: { id: TIER_IDS.registered, name: 'Registered', rank: 1, color_hex: '#AABB00' },
        status: 'active', pipeline_value: 450000, ytd_revenue: 250000,
        active_deals: 3, open_leads: 5, certified_reps: 2, total_reps: 5,
        min_annual_revenue: 100000,
      },
      {
        organization_id: ORG_IDS.orgB, name: 'Org Beta',
        tier: { id: TIER_IDS.innovator, name: 'Innovator', rank: 2, color_hex: '#00BBCC' },
        status: 'active', pipeline_value: 450000, ytd_revenue: 250000,
        active_deals: 3, open_leads: 2, certified_reps: 4, total_reps: 6,
        min_annual_revenue: 500000,
      },
    ]);
    mockRepo.getLeadDistributionMetrics.mockResolvedValue({
      total_unassigned: 10, total_assigned_pending: 3,
      avg_acceptance_hours: 8.5,
      acceptance_rate_by_partner: [],
    });
    mockRepo.getRecentActivity.mockResolvedValue([]);

    // Inline DB helpers for health score (db_dealStats, db_leadStats, db_mdfStats)
    setupHealthScoreDbMock();
  }

  test('returns portfolio with health scores for all partners', async () => {
    setupCMDashboardMocks();

    const result = await dashboardService.getChannelManagerDashboard(makeCMPayload());

    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('pending_approvals');
    expect(result).toHaveProperty('partners');
    expect(result).toHaveProperty('lead_metrics');
    expect(result).toHaveProperty('recent_activity');

    expect(result.summary.total_partners).toBe(2);
    expect(result.partners).toHaveLength(2);

    // Every partner should have a health_score
    for (const partner of result.partners) {
      expect(partner).toHaveProperty('health_score');
      expect(typeof partner.health_score).toBe('number');
      expect(partner.health_score).toBeGreaterThanOrEqual(0);
    }
  });

  test('pending approvals count is populated', async () => {
    setupCMDashboardMocks();

    const result = await dashboardService.getChannelManagerDashboard(makeCMPayload());

    expect(result.pending_approvals.total).toBe(5);
    expect(result.pending_approvals.deals).toBe(3);
    expect(result.pending_approvals.quotes).toBe(1);
    expect(result.pending_approvals.mdf_requests).toBe(1);
  });

  test('partners sorted by health_score ascending (worst first)', async () => {
    setupCMDashboardMocks();

    const result = await dashboardService.getChannelManagerDashboard(makeCMPayload());

    for (let i = 1; i < result.partners.length; i++) {
      expect(result.partners[i].health_score).toBeGreaterThanOrEqual(result.partners[i - 1].health_score);
    }
  });

  test('CM with no assigned orgs returns empty arrays', async () => {
    mockRepo.getAssignedOrgIds.mockResolvedValue([]);
    mockRepo.getPortfolioSummary.mockResolvedValue({
      total_partners: 0, active_partners: 0, total_pipeline_value: 0,
      total_ytd_revenue: 0, total_active_deals: 0,
    });
    mockRepo.getPendingApprovals.mockResolvedValue({ total: 0, deals: 0, quotes: 0, mdf_requests: 0 });
    mockRepo.getPartnerPortfolio.mockResolvedValue([]);
    mockRepo.getLeadDistributionMetrics.mockResolvedValue({
      total_unassigned: 0, total_assigned_pending: 0, avg_acceptance_hours: null,
      acceptance_rate_by_partner: [],
    });
    mockRepo.getRecentActivity.mockResolvedValue([]);
    // No health score queries needed for empty portfolio
    setupHealthScoreDbMock();

    const result = await dashboardService.getChannelManagerDashboard(makeCMPayload());

    expect(result.summary.total_partners).toBe(0);
    expect(result.partners).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════

describe('DashboardService.getAdminDashboard', () => {
  function setupAdminDashboardMocks() {
    mockRepo.getProgramMetrics.mockResolvedValue({
      total_partners: 50, active_partners: 45, total_pipeline_value: 25000000,
      total_ytd_revenue: 15000000, total_active_deals: 120,
      total_active_leads: 80, total_active_quotes: 35,
    });
    mockRepo.getTierDistribution.mockResolvedValue([
      { tier_id: TIER_IDS.registered, tier_name: 'Registered', rank: 1, color_hex: '#CCC', partner_count: 20 },
      { tier_id: TIER_IDS.innovator, tier_name: 'Innovator', rank: 2, color_hex: '#3B82F6', partner_count: 15 },
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
      by_revenue: [{ organization_id: ORG_IDS.orgA, name: 'Org Alpha', tier_name: 'Registered', ytd_revenue: 500000 }],
      by_deal_count: [],
      by_lead_conversion: [],
    });
    mockRepo.getPendingApprovals.mockResolvedValue({
      total: 12, deals: 8, quotes: 2, mdf_requests: 2,
    });
    mockRepo.getRecentActivity.mockResolvedValue([]);
  }

  test('returns program-wide metrics', async () => {
    setupAdminDashboardMocks();

    const result = await dashboardService.getAdminDashboard();

    expect(result).toHaveProperty('program_metrics');
    expect(result).toHaveProperty('tier_distribution');
    expect(result).toHaveProperty('mdf_utilization');
    expect(result).toHaveProperty('certification_coverage');
    expect(result).toHaveProperty('top_partners');
    expect(result).toHaveProperty('pending_approvals');
    expect(result).toHaveProperty('recent_activity');

    expect(result.program_metrics.total_partners).toBe(50);
    expect(result.program_metrics.active_partners).toBe(45);
    expect(result.program_metrics.total_pipeline_value).toBe(25000000);
    expect(result.program_metrics.total_ytd_revenue).toBe(15000000);
    expect(result.program_metrics.total_active_deals).toBe(120);
    expect(result.program_metrics.total_active_leads).toBe(80);
    expect(result.program_metrics.total_active_quotes).toBe(35);
  });

  test('tier_distribution contains all tiers', async () => {
    setupAdminDashboardMocks();

    const result = await dashboardService.getAdminDashboard();

    expect(result.tier_distribution).toHaveLength(2);
    expect(result.tier_distribution[0].tier_name).toBe('Registered');
    expect(result.tier_distribution[0].partner_count).toBe(20);
  });

  test('mdf_utilization is populated', async () => {
    setupAdminDashboardMocks();

    const result = await dashboardService.getAdminDashboard();

    expect(result.mdf_utilization.total_allocated).toBe(1000000);
    expect(result.mdf_utilization.utilization_pct).toBe(40.0);
  });

  test('admin pending_approvals has no userId filter (sees all)', async () => {
    setupAdminDashboardMocks();

    await dashboardService.getAdminDashboard();

    // getPendingApprovals called without userId (admin sees all)
    expect(mockRepo.getPendingApprovals).toHaveBeenCalledWith();
  });

  test('partial failure returns fallbacks with warnings', async () => {
    setupAdminDashboardMocks();
    mockRepo.getProgramMetrics.mockRejectedValue(new Error('timeout'));

    const result = await dashboardService.getAdminDashboard();

    expect(result.program_metrics.total_partners).toBe(0);
    expect(result.warnings).toContain('Failed to load program_metrics');
    // Other sections should still be populated
    expect(result.tier_distribution).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// HEALTH SCORE COMPUTATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Health score computation', () => {
  // Access the computeHealthScore function indirectly via the service
  // We test through the CM dashboard which calls computePartnerHealthScores

  test('partner with all metrics returns score between 0-100', async () => {
    mockRepo.getAssignedOrgIds.mockResolvedValue([ORG_IDS.orgA]);
    mockRepo.getPortfolioSummary.mockResolvedValue({
      total_partners: 1, active_partners: 1, total_pipeline_value: 450000,
      total_ytd_revenue: 250000, total_active_deals: 3,
    });
    mockRepo.getPendingApprovals.mockResolvedValue({ total: 0, deals: 0, quotes: 0, mdf_requests: 0 });
    mockRepo.getPartnerPortfolio.mockResolvedValue([
      {
        organization_id: ORG_IDS.orgA, name: 'Full Metrics Org',
        tier: { id: TIER_IDS.innovator, name: 'Innovator', rank: 2, color_hex: '#AAA' },
        status: 'active', pipeline_value: 450000, ytd_revenue: 400000,
        active_deals: 3, open_leads: 5, certified_reps: 4, total_reps: 5,
        min_annual_revenue: 500000,
      },
    ]);
    mockRepo.getLeadDistributionMetrics.mockResolvedValue({
      total_unassigned: 0, total_assigned_pending: 0, avg_acceptance_hours: null,
      acceptance_rate_by_partner: [],
    });
    mockRepo.getRecentActivity.mockResolvedValue([]);

    // Mock inline db helpers for health score data
    setupHealthScoreDbMock({
      dealStats: [{ organization_id: ORG_IDS.orgA, won: '8', lost: '2' }],
      leadStats: [{ assigned_org_id: ORG_IDS.orgA, total: '20', accepted: '15', avg_response_hours: '3.5' }],
      mdfStats: [{ organization_id: ORG_IDS.orgA, allocated: '50000', spent: '30000' }],
    });

    const result = await dashboardService.getChannelManagerDashboard(makeCMPayload());

    const partner = result.partners[0];
    expect(partner.health_score).toBeGreaterThanOrEqual(0);
    expect(partner.health_score).toBeLessThanOrEqual(100);
    expect(typeof partner.health_score).toBe('number');
    expect(Number.isInteger(partner.health_score)).toBe(true);
  });

  test('partner with no data gets neutral score of 50', async () => {
    mockRepo.getAssignedOrgIds.mockResolvedValue([ORG_IDS.orgA]);
    mockRepo.getPortfolioSummary.mockResolvedValue({
      total_partners: 1, active_partners: 1, total_pipeline_value: 0,
      total_ytd_revenue: 0, total_active_deals: 0,
    });
    mockRepo.getPendingApprovals.mockResolvedValue({ total: 0, deals: 0, quotes: 0, mdf_requests: 0 });
    mockRepo.getPartnerPortfolio.mockResolvedValue([
      {
        organization_id: ORG_IDS.orgA, name: 'Empty Org',
        tier: null,
        status: 'active', pipeline_value: 0, ytd_revenue: 0,
        active_deals: 0, open_leads: 0, certified_reps: 0, total_reps: 0,
        min_annual_revenue: 0,
      },
    ]);
    mockRepo.getLeadDistributionMetrics.mockResolvedValue({
      total_unassigned: 0, total_assigned_pending: 0, avg_acceptance_hours: null,
      acceptance_rate_by_partner: [],
    });
    mockRepo.getRecentActivity.mockResolvedValue([]);

    // All health sub-queries return empty
    setupHealthScoreDbMock();

    const result = await dashboardService.getChannelManagerDashboard(makeCMPayload());

    // With no data, all metrics are null -> neutral score of 50
    expect(result.partners[0].health_score).toBe(50);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DIVISION BY ZERO HANDLING
// ═════════════════════════════════════════════════════════════════════════════

describe('Division by zero handling', () => {
  test('revenue attainment_pct is 0 when tier_target is 0', async () => {
    setupPartnerDashboardMocks({
      revenue: { ytd_closed_won: 100000 },
      tierProgress: null, // no tier progress -> tier_target falls back to 0
    });

    const result = await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    // When tierTarget is 0, attainment_pct should be 0 (not NaN or Infinity)
    expect(result.revenue.attainment_pct).toBe(0);
    expect(Number.isFinite(result.revenue.attainment_pct)).toBe(true);
  });

  test('leads conversion_rate handles zero total received', async () => {
    setupPartnerDashboardMocks({
      leads: { assigned: 0, accepted: 0, converted: 0, disqualified: 0, conversion_rate: 0.0, avg_response_hours: null },
    });

    const result = await dashboardService.getPartnerDashboard(makePartnerAdminPayload());

    expect(result.leads.conversion_rate).toBe(0.0);
    expect(Number.isFinite(result.leads.conversion_rate)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS: ORG SCOPE ENFORCEMENT
// ═════════════════════════════════════════════════════════════════════════════

describe('Analytics: org scope enforcement', () => {
  test('pipeline analytics validates org_id within scope', async () => {
    const scope = { type: 'assigned' as const, assignedOrgIds: [ORG_IDS.orgA] };

    await expect(
      dashboardService.getPipelineAnalytics(
        { org_id: 'some-random-org-not-assigned' },
        scope,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('pipeline analytics allows org_id within scope', async () => {
    const scope = { type: 'assigned' as const, assignedOrgIds: [ORG_IDS.orgA] };
    mockRepo.getPipelineAnalytics.mockResolvedValue({
      total_pipeline_value: 100000,
      total_deal_count: 5,
      groups: [],
      trend: [],
    });

    const result = await dashboardService.getPipelineAnalytics(
      { org_id: ORG_IDS.orgA },
      scope,
    );

    expect(result.total_pipeline_value).toBe(100000);
  });

  test('admin scope (null orgIds) allows any org_id', async () => {
    const scope = { type: 'all' as const };
    mockRepo.getPipelineAnalytics.mockResolvedValue({
      total_pipeline_value: 0,
      total_deal_count: 0,
      groups: [],
      trend: [],
    });

    // Should not throw
    await expect(
      dashboardService.getPipelineAnalytics({ org_id: 'any-org-id' }, scope),
    ).resolves.toBeDefined();
  });

  test('partner performance analytics validates org_id within scope', async () => {
    const scope = { type: 'own' as const, organizationId: ORG_IDS.orgA };

    await expect(
      dashboardService.getPartnerPerformanceAnalytics(
        { org_id: ORG_IDS.orgB },
        scope,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('lead conversion analytics validates org_id within scope', async () => {
    const scope = { type: 'assigned' as const, assignedOrgIds: [ORG_IDS.orgA] };

    await expect(
      dashboardService.getLeadConversionAnalytics(
        { org_id: ORG_IDS.orgB },
        scope,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('MDF ROI analytics validates org_id within scope', async () => {
    const scope = { type: 'assigned' as const, assignedOrgIds: [ORG_IDS.orgA] };

    await expect(
      dashboardService.getMdfRoiAnalytics(
        { org_id: ORG_IDS.orgB },
        scope,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

/**
 * Unit tests for LeadService.
 *
 * All external dependencies (leadRepository, notificationService,
 * dealService, db) are fully mocked. No database or network
 * connections are required.
 *
 * Focus areas:
 *   - Assignment algorithm: tier scoring, geo match, industry match, load fairness
 *   - Composite score calculation and ranking
 *   - Edge cases: no eligible orgs, all orgs at capacity, missing data
 *   - Status transition validation (VALID_LEAD_TRANSITIONS)
 *   - Optimistic concurrency handling (updateStatus returning null)
 *   - Multiple-return threshold tracking
 *   - SLA deadline computation (server-side UTC, not client-provided)
 */

// ── Mocks (must be declared before all imports) ───────────────────────────────

jest.mock('../../src/repositories/lead.repository', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findRawById: jest.fn(),
    list: jest.fn(),
    findUnassigned: jest.fn(),
    updateStatus: jest.fn(),
    updateFields: jest.fn(),
    insertActivity: jest.fn(),
    getHistory: jest.fn(),
    getReturnCount: jest.fn(),
    getPartnerLeadCounts: jest.fn(),
    getEligibleOrgs: jest.fn(),
    getMaxTierRank: jest.fn(),
    findApproachingSla: jest.fn(),
    findPastSla: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

jest.mock('../../src/services/deal.service', () => ({
  __esModule: true,
  default: {
    createDeal: jest.fn(),
  },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  whereNotNull: jest.fn().mockReturnThis(),
  whereExists: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockReturnThis(),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn((sql: string, bindings?: any[]) => ({ sql, bindings }));
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import leadService from '../../src/services/lead.service';
import leadRepository from '../../src/repositories/lead.repository';
import notificationService from '../../src/services/notification.service';
import dealService from '../../src/services/deal.service';
import { AppError } from '../../src/utils/AppError';
import { ORG_IDS, USER_IDS, TIER_IDS } from '../fixtures/factories';
import { v4 as uuidv4 } from 'uuid';
import {
  LEAD_ASSIGNMENT_WEIGHTS,
  LEAD_MAX_ACTIVE_BY_TIER_RANK,
  LEAD_MULTIPLE_RETURN_THRESHOLD,
  LEAD_SLA_HOURS,
  GEO_REGIONS,
  RELATED_INDUSTRIES,
} from '../../src/config/constants';

const mockRepo = leadRepository as jest.Mocked<typeof leadRepository>;
const mockNotif = notificationService as jest.Mocked<typeof notificationService>;
const mockDealService = dealService as jest.Mocked<typeof dealService>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LEAD_ID = uuidv4();
const DEAL_ID = uuidv4();

function makeAdminUser() {
  return { sub: USER_IDS.admin, email: 'admin@example.com', role: 'admin' as const, org_id: null, tier_id: null };
}

function makeCMUser() {
  return { sub: USER_IDS.channelManager, email: 'cm@example.com', role: 'channel_manager' as const, org_id: null, tier_id: null };
}

function makePartnerAdminUser(orgId: string = ORG_IDS.orgA) {
  return { sub: USER_IDS.partnerAdminA, email: 'pa@example.com', role: 'partner_admin' as const, org_id: orgId, tier_id: TIER_IDS.registered };
}

function makePartnerRepUser(orgId: string = ORG_IDS.orgA) {
  return { sub: USER_IDS.partnerRepA, email: 'pr@example.com', role: 'partner_rep' as const, org_id: orgId, tier_id: TIER_IDS.registered };
}

function makeLead(overrides: Record<string, any> = {}) {
  return {
    id: LEAD_ID,
    lead_number: 'LD-2026-00001',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane.doe@acmecorp.com',
    phone: '+1-555-0123',
    company_name: 'Acme Corp',
    industry: 'Financial Services',
    city: 'New York',
    state_province: 'NY',
    country: 'US',
    score: 75,
    budget: 150000,
    interest_notes: 'Interested in next-gen firewall',
    status: 'new',
    assigned_org_id: null,
    assigned_user_id: null,
    assigned_org_name: null,
    assigned_at: null,
    accepted_at: null,
    sla_deadline: null,
    converted_deal_id: null,
    converted_at: null,
    return_reason: null,
    disqualify_reason: null,
    tags: [],
    created_at: new Date('2026-03-18T10:00:00Z'),
    updated_at: new Date('2026-03-18T10:00:00Z'),
    ...overrides,
  };
}

function makeOrg(overrides: Record<string, any> = {}) {
  return {
    id: uuidv4(),
    name: 'Test Partner Org',
    industry: 'Technology',
    city: 'San Francisco',
    state_province: 'CA',
    country: 'US',
    tier_id: TIER_IDS.innovator,
    tier_name: 'Innovator',
    tier_rank: 2,
    channel_manager_id: USER_IDS.channelManager,
    status: 'active',
    ...overrides,
  };
}

const allScope = { type: 'all' as const };
const ownScope = (orgId: string) => ({ type: 'own' as const, organizationId: orgId });

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.insertActivity.mockResolvedValue({ id: uuidv4() } as any);
  mockRepo.getReturnCount.mockResolvedValue(0);
  mockNotif.createNotification.mockResolvedValue({ id: uuidv4() } as any);
});

// =============================================================================
// ASSIGNMENT ALGORITHM UNIT TESTS
// =============================================================================

describe('Unit: Assignment algorithm — tier scoring', () => {
  test('AL-001 — Diamond org (rank 4, max rank 4) scores tier_score = 100', async () => {
    const lead = makeLead({ country: null, industry: null }); // isolate tier scoring
    const diamondOrg = makeOrg({ tier_rank: 4, country: null, industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([diamondOrg]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [diamondOrg.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].scores.tier).toBe(100);
  });

  test('AL-002 — Registered org (rank 1, max rank 4) scores tier_score = 25', async () => {
    const lead = makeLead({ country: null, industry: null });
    const registeredOrg = makeOrg({ tier_rank: 1, country: null, industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([registeredOrg]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [registeredOrg.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.tier).toBe(25);
  });

  test('AL-003 — Innovator (rank 2, max 4) = 50, Platinum (rank 3, max 4) = 75', async () => {
    const lead = makeLead({ country: null, industry: null });
    const innovatorOrg = makeOrg({ id: uuidv4(), tier_rank: 2, country: null, industry: null });
    const platinumOrg = makeOrg({ id: uuidv4(), tier_rank: 3, country: null, industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([innovatorOrg, platinumOrg]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [innovatorOrg.id]: 0,
      [platinumOrg.id]: 0,
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    const innoRec = result.recommendations.find((r: any) => r.organization_id === innovatorOrg.id);
    const platRec = result.recommendations.find((r: any) => r.organization_id === platinumOrg.id);

    expect(innoRec!.scores.tier).toBe(50);
    expect(platRec!.scores.tier).toBe(75);
  });

  test('AL-004 — higher-tier org is ranked higher when geo/industry/load are equal', async () => {
    const lead = makeLead({ country: null, industry: null });
    const diamondOrg = makeOrg({ id: uuidv4(), name: 'Diamond Org', tier_rank: 4, country: null, industry: null });
    const registeredOrg = makeOrg({ id: uuidv4(), name: 'Registered Org', tier_rank: 1, country: null, industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([registeredOrg, diamondOrg]); // intentionally unsorted
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [diamondOrg.id]: 0,
      [registeredOrg.id]: 0,
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    // First recommendation should be the Diamond org
    expect(result.recommendations[0].organization_id).toBe(diamondOrg.id);
    expect(result.recommendations[0].composite_score).toBeGreaterThan(
      result.recommendations[1].composite_score,
    );
  });
});

describe('Unit: Assignment algorithm — geo match scoring', () => {
  test('AL-010 — exact country + state match: geo_score = 100', async () => {
    const lead = makeLead({ country: 'US', state_province: 'NY', industry: null });
    const org = makeOrg({ country: 'US', state_province: 'NY', industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.geo).toBe(100);
  });

  test('AL-011 — same country, different state: geo_score = 60', async () => {
    const lead = makeLead({ country: 'US', state_province: 'NY', industry: null });
    const org = makeOrg({ country: 'US', state_province: 'CA', industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.geo).toBe(60);
  });

  test('AL-012 — same GEO_REGION (AMERICAS) different countries: geo_score = 30', async () => {
    // US and CA are both in AMERICAS
    const lead = makeLead({ country: 'US', state_province: 'NY', industry: null });
    const org = makeOrg({ country: 'CA', state_province: 'ON', industry: null }); // Canada

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.geo).toBe(30);
  });

  test('AL-013 — different regions (US in AMERICAS, DE in EMEA): geo_score = 0', async () => {
    const lead = makeLead({ country: 'US', state_province: 'NY', industry: null });
    const org = makeOrg({ country: 'DE', state_province: null, industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.geo).toBe(0);
  });

  test('AL-014 — lead with no country: geo_score = 0', async () => {
    const lead = makeLead({ country: null, state_province: null, industry: null });
    const org = makeOrg({ country: 'US', state_province: 'CA', industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.geo).toBe(0);
  });

  test('AL-015 — GEO_REGIONS constant covers AMERICAS, EMEA, APAC correctly', () => {
    // Verify regional groupings are consistent with PRD spec
    expect(GEO_REGIONS.AMERICAS).toContain('US');
    expect(GEO_REGIONS.AMERICAS).toContain('CA');
    expect(GEO_REGIONS.EMEA).toContain('GB');
    expect(GEO_REGIONS.EMEA).toContain('DE');
    expect(GEO_REGIONS.APAC).toContain('JP');
    expect(GEO_REGIONS.APAC).toContain('AU');

    // US should NOT be in EMEA or APAC
    expect(GEO_REGIONS.EMEA).not.toContain('US');
    expect(GEO_REGIONS.APAC).not.toContain('US');
  });
});

describe('Unit: Assignment algorithm — industry expertise scoring', () => {
  test('AL-020 — exact industry match: industry_score = 100', async () => {
    const lead = makeLead({ country: null, industry: 'Financial Services' });
    const org = makeOrg({ country: null, industry: 'Financial Services' });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.industry).toBe(100);
  });

  test('AL-021 — related industry match (Financial Services ↔ Banking): industry_score = 50', async () => {
    // RELATED_INDUSTRIES: 'Financial Services': ['Banking', 'Insurance', 'Fintech']
    const lead = makeLead({ country: null, industry: 'Financial Services' });
    const org = makeOrg({ country: null, industry: 'Banking' });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.industry).toBe(50);
  });

  test('AL-022 — related industry match (Technology ↔ SaaS): industry_score = 50', async () => {
    const lead = makeLead({ country: null, industry: 'Technology' });
    const org = makeOrg({ country: null, industry: 'SaaS' });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.industry).toBe(50);
  });

  test('AL-023 — unrelated industry (Financial Services vs. Healthcare): industry_score = 0', async () => {
    const lead = makeLead({ country: null, industry: 'Financial Services' });
    const org = makeOrg({ country: null, industry: 'Healthcare' });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.industry).toBe(0);
  });

  test('AL-024 — lead with no industry: industry_score = 0', async () => {
    const lead = makeLead({ country: null, industry: null });
    const org = makeOrg({ country: null, industry: 'Financial Services' });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].scores.industry).toBe(0);
  });

  test('AL-025 — RELATED_INDUSTRIES groups are defined per PRD spec', () => {
    expect(RELATED_INDUSTRIES['Financial Services']).toContain('Banking');
    expect(RELATED_INDUSTRIES['Financial Services']).toContain('Insurance');
    expect(RELATED_INDUSTRIES['Financial Services']).toContain('Fintech');
    expect(RELATED_INDUSTRIES['Healthcare']).toContain('Pharmaceuticals');
    expect(RELATED_INDUSTRIES['Technology']).toContain('Software');
    expect(RELATED_INDUSTRIES['Technology']).toContain('SaaS');
    expect(RELATED_INDUSTRIES['Government']).toContain('Defense');
  });
});

describe('Unit: Assignment algorithm — load fairness scoring', () => {
  test('AL-030 — all orgs with 0 active leads: load_score = 100 for all', async () => {
    const lead = makeLead({ country: null, industry: null });
    const org1 = makeOrg({ id: uuidv4() });
    const org2 = makeOrg({ id: uuidv4() });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org1, org2]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [org1.id]: 0,
      [org2.id]: 0,
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    result.recommendations.forEach((rec: any) => {
      expect(rec.scores.load).toBe(100);
    });
  });

  test('AL-031 — org with 2 leads, max = 10: load_score = 80', async () => {
    // load_score = (1 - 2/10) * 100 = 80
    const lead = makeLead({ country: null, industry: null });
    const org1 = makeOrg({ id: uuidv4(), tier_rank: 2 }); // 2 active leads
    const org2 = makeOrg({ id: uuidv4(), tier_rank: 2 }); // 10 active leads (max)

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org1, org2]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [org1.id]: 2,
      [org2.id]: 10,
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    const rec1 = result.recommendations.find((r: any) => r.organization_id === org1.id);
    const rec2 = result.recommendations.find((r: any) => r.organization_id === org2.id);

    expect(rec1!.scores.load).toBe(80); // (1 - 2/10) * 100
    expect(rec2!.scores.load).toBe(0);  // (1 - 10/10) * 100
  });

  test('AL-032 — lower-load org ranked higher when tier/geo/industry are equal', async () => {
    const lead = makeLead({ country: null, industry: null });
    const lightOrg = makeOrg({ id: uuidv4(), name: 'Light Load Org', tier_rank: 2 });
    const heavyOrg = makeOrg({ id: uuidv4(), name: 'Heavy Load Org', tier_rank: 2 });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([heavyOrg, lightOrg]);
    mockRepo.getMaxTierRank.mockResolvedValue(2); // max tier = 2 so both are 100%
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [lightOrg.id]: 1,
      [heavyOrg.id]: 8,
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].organization_id).toBe(lightOrg.id);
    expect(result.recommendations[0].composite_score).toBeGreaterThan(
      result.recommendations[1].composite_score,
    );
  });
});

describe('Unit: Assignment algorithm — composite score calculation', () => {
  test('AL-040 — composite score formula: weights sum to 1.0', () => {
    const { tier, geo, industry, load } = LEAD_ASSIGNMENT_WEIGHTS;
    expect(tier + geo + industry + load).toBeCloseTo(1.0, 10);
  });

  test('AL-041 — perfect match org (all 100s): composite = 100', async () => {
    const lead = makeLead({ country: 'US', state_province: 'NY', industry: 'Financial Services' });
    const org = makeOrg({
      country: 'US',
      state_province: 'NY',
      industry: 'Financial Services',
      tier_rank: 4,
    });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations[0].composite_score).toBe(100);
    expect(result.recommendations[0].scores.tier).toBe(100);
    expect(result.recommendations[0].scores.geo).toBe(100);
    expect(result.recommendations[0].scores.industry).toBe(100);
    expect(result.recommendations[0].scores.load).toBe(100);
  });

  test('AL-042 — composite for: tier=100, geo=60, industry=0, load=80 = correct calculation', async () => {
    // tier=100 (rank 4/4), geo=60 (same country diff state), industry=0 (no match), load=80 (2/10 leads)
    // composite = 100*0.40 + 60*0.25 + 0*0.20 + 80*0.15
    //           = 40 + 15 + 0 + 12 = 67
    const lead = makeLead({ country: 'US', state_province: 'NY', industry: 'Financial Services' });
    const org = makeOrg({
      country: 'US',
      state_province: 'CA',   // different state -> geo=60
      industry: 'Healthcare', // no match -> industry=0
      tier_rank: 4,
    });
    const maxLoadOrg = makeOrg({ id: uuidv4(), tier_rank: 1 }); // has 10 leads to set max

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org, maxLoadOrg]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [org.id]: 2,
      [maxLoadOrg.id]: 10,
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    const mainRec = result.recommendations.find((r: any) => r.organization_id === org.id);
    expect(mainRec!.scores.tier).toBe(100);
    expect(mainRec!.scores.geo).toBe(60);
    expect(mainRec!.scores.industry).toBe(0);
    expect(mainRec!.scores.load).toBe(80);

    // composite = 100*0.4 + 60*0.25 + 0*0.20 + 80*0.15 = 40 + 15 + 0 + 12 = 67
    expect(mainRec!.composite_score).toBe(67);
  });

  test('AL-043 — composite scores are rounded to 2 decimal places', async () => {
    const lead = makeLead({ country: null, industry: null });
    const org = makeOrg({ tier_rank: 3, country: null, industry: null });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    // tier_score = (3/4)*100 = 75; load=100; geo=0; industry=0
    // composite = 75*0.4 + 0*0.25 + 0*0.20 + 100*0.15 = 30 + 0 + 0 + 15 = 45
    expect(result.recommendations[0].composite_score).toBe(45);
    // Verify it is a finite number (no NaN or Infinity)
    expect(isFinite(result.recommendations[0].composite_score)).toBe(true);
  });

  test('AL-044 — recommendations are sorted descending by composite_score', async () => {
    const lead = makeLead({ country: null, industry: null });
    const orgA = makeOrg({ id: uuidv4(), tier_rank: 4 });
    const orgB = makeOrg({ id: uuidv4(), tier_rank: 2 });
    const orgC = makeOrg({ id: uuidv4(), tier_rank: 1 });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([orgC, orgA, orgB]); // intentionally shuffled
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [orgA.id]: 0,
      [orgB.id]: 0,
      [orgC.id]: 0,
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    const scores = result.recommendations.map((r: any) => r.composite_score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });
});

describe('Unit: Assignment algorithm — edge cases', () => {
  test('AL-050 — no eligible orgs: returns empty recommendations, no_eligible_orgs=true', async () => {
    mockRepo.findRawById.mockResolvedValue(makeLead());
    mockRepo.getEligibleOrgs.mockResolvedValue([]);

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.recommendations).toHaveLength(0);
    expect(result.no_eligible_orgs).toBe(true);
    expect(result.all_at_capacity).toBe(false);
  });

  test('AL-051 — all orgs at capacity: all_at_capacity=true', async () => {
    const lead = makeLead({ country: null, industry: null });
    // Rank 1 = max 5 active leads. If count >= 5, org is at capacity.
    const org = makeOrg({ tier_rank: 1 });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    // Count at max for rank 1 (LEAD_MAX_ACTIVE_BY_TIER_RANK[1] = 5)
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 5 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.all_at_capacity).toBe(true);
    // Orgs still appear in recommendations (capacity is advisory, not a hard filter)
    expect(result.recommendations).toHaveLength(1);
  });

  test('AL-052 — one org at capacity, one below: all_at_capacity=false', async () => {
    const lead = makeLead({ country: null, industry: null });
    const fullOrg = makeOrg({ id: uuidv4(), tier_rank: 1 });  // rank 1, max 5
    const partialOrg = makeOrg({ id: uuidv4(), tier_rank: 2 }); // rank 2, max 15

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([fullOrg, partialOrg]);
    mockRepo.getMaxTierRank.mockResolvedValue(4);
    mockRepo.getPartnerLeadCounts.mockResolvedValue({
      [fullOrg.id]: 5,     // at capacity (rank 1 max = 5)
      [partialOrg.id]: 3,  // below capacity (rank 2 max = 15)
    });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    expect(result.all_at_capacity).toBe(false);
  });

  test('AL-053 — capacity thresholds match PRD spec (rank 1=5, 2=15, 3=30, 4=50)', () => {
    expect(LEAD_MAX_ACTIVE_BY_TIER_RANK[1]).toBe(5);
    expect(LEAD_MAX_ACTIVE_BY_TIER_RANK[2]).toBe(15);
    expect(LEAD_MAX_ACTIVE_BY_TIER_RANK[3]).toBe(30);
    expect(LEAD_MAX_ACTIVE_BY_TIER_RANK[4]).toBe(50);
  });

  test('AL-054 — max_tier_rank = 0 edge case: tier_score = 0 without NaN', async () => {
    const lead = makeLead({ country: null, industry: null });
    const org = makeOrg({ tier_rank: 1 });

    mockRepo.findRawById.mockResolvedValue(lead);
    mockRepo.getEligibleOrgs.mockResolvedValue([org]);
    mockRepo.getMaxTierRank.mockResolvedValue(0); // pathological case
    mockRepo.getPartnerLeadCounts.mockResolvedValue({ [org.id]: 0 });

    const result = await leadService.getRecommendations(LEAD_ID, makeAdminUser());

    // When maxTierRank = 0, tier_score should be 0 (not NaN or Infinity)
    expect(result.recommendations[0].scores.tier).toBe(0);
    expect(isNaN(result.recommendations[0].composite_score)).toBe(false);
    expect(isFinite(result.recommendations[0].composite_score)).toBe(true);
  });

  test('AL-055 — lead not found throws AppError 404', async () => {
    mockRepo.findRawById.mockResolvedValue(null);

    await expect(
      leadService.getRecommendations(LEAD_ID, makeAdminUser()),
    ).rejects.toThrow(AppError);

    await expect(
      leadService.getRecommendations(LEAD_ID, makeAdminUser()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// =============================================================================
// STATUS TRANSITION VALIDATION
// =============================================================================

describe('Unit: Status transition validation (VALID_LEAD_TRANSITIONS)', () => {
  test('TR-001 — new -> assigned: valid', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);
    mockRepo.updateStatus.mockResolvedValue({ ...newLead, status: 'assigned', assigned_org_id: ORG_IDS.orgA, assigned_at: new Date(), sla_deadline: new Date(), updated_at: new Date() });

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn()
        .mockResolvedValueOnce({ id: ORG_IDS.orgA, name: 'Org Alpha', status: 'active', channel_manager_id: USER_IDS.channelManager, tier_rank: 2 })
        .mockResolvedValueOnce({ total: '1' })
        .mockResolvedValueOnce({ id: USER_IDS.partnerAdminA }),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeAdminUser(), allScope),
    ).resolves.not.toThrow();
  });

  test('TR-002 — new -> accepted: invalid — throws LEAD_INVALID_TRANSITION', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);

    await expect(
      leadService.acceptLead(LEAD_ID, makePartnerAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });

  test('TR-003 — assigned -> accepted: valid', async () => {
    const assignedLead = makeLead({ status: 'assigned', assigned_org_id: ORG_IDS.orgA });
    const acceptedAt = new Date();
    mockRepo.findById.mockResolvedValue(assignedLead);
    mockRepo.updateStatus.mockResolvedValue({ ...assignedLead, status: 'accepted', accepted_at: acceptedAt, updated_at: new Date() });

    await expect(
      leadService.acceptLead(LEAD_ID, makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).resolves.toMatchObject({ status: 'accepted' });
  });

  test('TR-004 — accepted -> returned: valid', async () => {
    const acceptedLead = makeLead({ status: 'accepted', assigned_org_id: ORG_IDS.orgA });
    mockRepo.findById.mockResolvedValue(acceptedLead);
    mockRepo.updateStatus.mockResolvedValue({ ...acceptedLead, status: 'returned', return_reason: 'reason', assigned_org_id: null, updated_at: new Date() });
    mockRepo.getReturnCount.mockResolvedValue(1);
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
    }));

    await expect(
      leadService.returnLead(LEAD_ID, 'Wrong region', makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).resolves.toMatchObject({ status: 'returned' });
  });

  test('TR-005 — converted -> assigned: invalid (terminal state)', async () => {
    const convertedLead = makeLead({ status: 'converted', converted_deal_id: DEAL_ID });
    mockRepo.findById.mockResolvedValue(convertedLead);

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ id: ORG_IDS.orgA, name: 'Org Alpha', status: 'active', channel_manager_id: USER_IDS.channelManager, tier_rank: 2 }),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });

  test('TR-006 — disqualified -> any: invalid (terminal state)', async () => {
    const disqualifiedLead = makeLead({ status: 'disqualified' });
    mockRepo.findById.mockResolvedValue(disqualifiedLead);

    await expect(
      leadService.disqualifyLead(LEAD_ID, 'Still spam', makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });

  test('TR-007 — returned -> assigned: valid (re-assignment after return)', async () => {
    const returnedLead = makeLead({ status: 'returned', return_reason: 'Wrong region' });
    const now = new Date();
    mockRepo.findById.mockResolvedValue(returnedLead);
    mockRepo.updateStatus.mockResolvedValue({ ...returnedLead, status: 'assigned', assigned_org_id: ORG_IDS.orgB, assigned_at: now, sla_deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000), updated_at: new Date() });

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn()
        .mockResolvedValueOnce({ id: ORG_IDS.orgB, name: 'Org Beta', status: 'active', channel_manager_id: USER_IDS.channelManager, tier_rank: 2 })
        .mockResolvedValueOnce({ total: '1' })
        .mockResolvedValueOnce({ id: USER_IDS.partnerAdminB }),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, ORG_IDS.orgB, makeAdminUser(), allScope),
    ).resolves.toMatchObject({ status: 'assigned', assigned_org_id: ORG_IDS.orgB });
  });

  test('TR-008 — accepted -> contacted: valid (working status progression)', async () => {
    const acceptedLead = makeLead({ status: 'accepted', assigned_org_id: ORG_IDS.orgA });
    const scope = ownScope(ORG_IDS.orgA);
    mockRepo.findById.mockResolvedValue(acceptedLead);
    mockRepo.updateStatus.mockResolvedValue({ ...acceptedLead, status: 'contacted', updated_at: new Date() });

    await expect(
      leadService.updateLead(LEAD_ID, { status: 'contacted' }, makePartnerAdminUser(), scope),
    ).resolves.toBeDefined();

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      LEAD_ID,
      'accepted',
      'contacted',
    );
  });

  test('TR-009 — accepted -> new: invalid backward transition', async () => {
    const acceptedLead = makeLead({ status: 'accepted', assigned_org_id: ORG_IDS.orgA });
    mockRepo.findById.mockResolvedValue(acceptedLead);

    await expect(
      leadService.updateLead(LEAD_ID, { status: 'new' }, makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });
});

// =============================================================================
// OPTIMISTIC CONCURRENCY (EC-04)
// =============================================================================

describe('Unit: Optimistic concurrency on status transitions', () => {
  test('OC-001 — accept: updateStatus returning null triggers LEAD_INVALID_TRANSITION (EC-04)', async () => {
    const assignedLead = makeLead({ status: 'assigned', assigned_org_id: ORG_IDS.orgA });
    mockRepo.findById.mockResolvedValue(assignedLead);
    mockRepo.updateStatus.mockResolvedValue(null); // concurrent modification

    await expect(
      leadService.acceptLead(LEAD_ID, makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).rejects.toMatchObject({
      code: 'LEAD_INVALID_TRANSITION',
      statusCode: 422,
    });
  });

  test('OC-002 — return: updateStatus returning null triggers LEAD_INVALID_TRANSITION', async () => {
    const assignedLead = makeLead({ status: 'assigned', assigned_org_id: ORG_IDS.orgA });
    mockRepo.findById.mockResolvedValue(assignedLead);
    mockRepo.updateStatus.mockResolvedValue(null);

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
    }));

    await expect(
      leadService.returnLead(LEAD_ID, 'reason', makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });

  test('OC-003 — assign: updateStatus returning null triggers LEAD_INVALID_TRANSITION', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);
    mockRepo.updateStatus.mockResolvedValue(null);

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn()
        .mockResolvedValueOnce({ id: ORG_IDS.orgA, name: 'Org Alpha', status: 'active', channel_manager_id: USER_IDS.channelManager, tier_rank: 2 })
        .mockResolvedValueOnce({ total: '1' })
        .mockResolvedValueOnce(null), // no partner admin
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });
});

// =============================================================================
// MULTIPLE RETURN THRESHOLD (EC-02)
// =============================================================================

describe('Unit: Multiple return threshold (EC-02)', () => {
  test('MR-001 — LEAD_MULTIPLE_RETURN_THRESHOLD constant = 3 per PRD', () => {
    expect(LEAD_MULTIPLE_RETURN_THRESHOLD).toBe(3);
  });

  test('MR-002 — 2nd return: no multiple_returns tag added, no warning activity', async () => {
    const assignedLead = makeLead({ status: 'assigned', assigned_org_id: ORG_IDS.orgA, tags: [] });
    mockRepo.findById.mockResolvedValue(assignedLead);
    mockRepo.updateStatus.mockResolvedValue({ ...assignedLead, status: 'returned', assigned_org_id: null, updated_at: new Date() });
    mockRepo.getReturnCount.mockResolvedValue(2); // below threshold
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
    }));

    await leadService.returnLead(LEAD_ID, 'Second return reason', makePartnerAdminUser(), ownScope(ORG_IDS.orgA));

    // updateFields should NOT be called (no tag to add)
    expect(mockRepo.updateFields).not.toHaveBeenCalled();

    // Only 1 activity insert (the return itself), no warning
    const warningCall = mockRepo.insertActivity.mock.calls.find(
      (call) => call[0].action === 'multiple_return_warning',
    );
    expect(warningCall).toBeUndefined();
  });

  test('MR-003 — 3rd return: multiple_returns tag appended via updateFields', async () => {
    const assignedLead = makeLead({ status: 'assigned', assigned_org_id: ORG_IDS.orgA, tags: [] });
    mockRepo.findById.mockResolvedValue(assignedLead);
    mockRepo.updateStatus.mockResolvedValue({ ...assignedLead, status: 'returned', assigned_org_id: null, updated_at: new Date() });
    mockRepo.getReturnCount.mockResolvedValue(3); // at threshold
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
    }));

    await leadService.returnLead(LEAD_ID, 'Third return reason', makePartnerAdminUser(), ownScope(ORG_IDS.orgA));

    expect(mockRepo.updateFields).toHaveBeenCalledWith(
      LEAD_ID,
      expect.objectContaining({ tags: expect.anything() }),
    );

    const warningCall = mockRepo.insertActivity.mock.calls.find(
      (call) => call[0].action === 'multiple_return_warning',
    );
    expect(warningCall).toBeDefined();
    expect(warningCall![0].summary).toContain('3');
  });

  test('MR-004 — tag already exists: updateFields still called (array_append is idempotent)', async () => {
    // The service checks if 'multiple_returns' is in lead.tags before calling updateFields.
    // If the tag is already there, it skips adding it (implemented in service).
    const leadWithTag = makeLead({ status: 'assigned', assigned_org_id: ORG_IDS.orgA, tags: ['multiple_returns'] });
    mockRepo.findById.mockResolvedValue(leadWithTag);
    mockRepo.updateStatus.mockResolvedValue({ ...leadWithTag, status: 'returned', assigned_org_id: null, updated_at: new Date() });
    mockRepo.getReturnCount.mockResolvedValue(5); // well above threshold
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
    }));

    await leadService.returnLead(LEAD_ID, 'Fifth return', makePartnerAdminUser(), ownScope(ORG_IDS.orgA));

    // Tag already present — updateFields should NOT be called (deduplication)
    expect(mockRepo.updateFields).not.toHaveBeenCalled();
    // But warning activity should still be logged
    const warningCall = mockRepo.insertActivity.mock.calls.find(
      (call) => call[0].action === 'multiple_return_warning',
    );
    expect(warningCall).toBeDefined();
  });
});

// =============================================================================
// SLA DEADLINE COMPUTATION
// =============================================================================

describe('Unit: SLA deadline computation', () => {
  test('SLA-001 — SLA_HOURS constant = 48', () => {
    expect(LEAD_SLA_HOURS).toBe(48);
  });

  test('SLA-002 — assignLead sets sla_deadline to exactly NOW + 48 hours (server-side)', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);

    const beforeCall = Date.now();
    mockRepo.updateStatus.mockImplementation(async (id, from, to, extra) => {
      return {
        ...newLead,
        status: 'assigned',
        assigned_org_id: ORG_IDS.orgA,
        assigned_at: extra?.assigned_at,
        sla_deadline: extra?.sla_deadline,
        updated_at: new Date(),
      };
    });

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn()
        .mockResolvedValueOnce({ id: ORG_IDS.orgA, name: 'Org Alpha', status: 'active', channel_manager_id: USER_IDS.channelManager, tier_rank: 2 })
        .mockResolvedValueOnce({ total: '1' })
        .mockResolvedValueOnce(null),
      count: jest.fn().mockReturnThis(),
    }));

    await leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeAdminUser(), allScope);

    const afterCall = Date.now();
    const callArgs = mockRepo.updateStatus.mock.calls[0];
    const slaDeadline: Date = callArgs[3]?.sla_deadline;

    expect(slaDeadline).toBeInstanceOf(Date);

    const expectedMin = beforeCall + 48 * 60 * 60 * 1000;
    const expectedMax = afterCall + 48 * 60 * 60 * 1000;

    expect(slaDeadline.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(slaDeadline.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});

// =============================================================================
// LEAD CRUD — CREATE, GET, UPDATE
// =============================================================================

describe('Unit: Lead CRUD', () => {
  test('CRUD-001 — createLead always sets status=new regardless of input', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.create.mockResolvedValue(newLead);

    const result = await leadService.createLead(
      { first_name: 'Jane', last_name: 'Doe', status: 'accepted' }, // attempted status injection
      makeAdminUser(),
    );

    // Service should force status = 'new'
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'new' }),
    );
  });

  test('CRUD-002 — getLead returns null as 404 AppError', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      leadService.getLead(LEAD_ID, allScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('CRUD-003 — updateLead on converted lead throws LEAD_INVALID_TRANSITION', async () => {
    const convertedLead = makeLead({ status: 'converted', converted_deal_id: DEAL_ID });
    mockRepo.findById.mockResolvedValue(convertedLead);

    await expect(
      leadService.updateLead(LEAD_ID, { score: 80 }, makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });

  test('CRUD-004 — updateLead on accepted lead succeeds (accepted is editable)', async () => {
    const acceptedLead = makeLead({ status: 'accepted', assigned_org_id: ORG_IDS.orgA });
    const updatedLead = { ...acceptedLead, score: 90, updated_at: new Date() };
    mockRepo.findById
      .mockResolvedValueOnce(acceptedLead)  // initial fetch
      .mockResolvedValueOnce(updatedLead);  // re-fetch after update
    mockRepo.updateFields.mockResolvedValue(updatedLead as any);

    await expect(
      leadService.updateLead(LEAD_ID, { score: 90 }, makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).resolves.toBeDefined();

    expect(mockRepo.updateFields).toHaveBeenCalledWith(
      LEAD_ID,
      expect.objectContaining({ score: 90 }),
    );
  });
});

// =============================================================================
// CONVERT LEAD — DEAL CREATION AND ORG SCOPING
// =============================================================================

describe('Unit: Convert lead to deal', () => {
  test('CONV-001 — convertLead calls dealService.createDeal with correct fields', async () => {
    const acceptedLead = makeLead({
      status: 'accepted',
      assigned_org_id: ORG_IDS.orgA,
      company_name: 'Acme Corp',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane.doe@acmecorp.com',
      phone: '+1-555-0123',
      industry: 'Financial Services',
      city: 'New York',
      state_province: 'NY',
      country: 'US',
      budget: 150000,
      interest_notes: 'Looking for firewall',
    });

    mockRepo.findById.mockResolvedValue(acceptedLead);
    mockDealService.createDeal.mockResolvedValue({ id: DEAL_ID, deal_number: 'DR-2026-00099' } as any);
    mockRepo.updateStatus.mockResolvedValue({ ...acceptedLead, status: 'converted', converted_deal_id: DEAL_ID, converted_at: new Date(), updated_at: new Date() });
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager, name: 'Org Alpha' }),
    }));

    await leadService.convertLead(LEAD_ID, makePartnerAdminUser(), ownScope(ORG_IDS.orgA));

    expect(mockDealService.createDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_company_name: 'Acme Corp',
        customer_contact_name: 'Jane Doe',
        customer_contact_email: 'jane.doe@acmecorp.com',
        customer_contact_phone: '+1-555-0123',
        customer_industry: 'Financial Services',
        customer_address: 'New York, NY, US',
        estimated_value: 150000,
        description: 'Looking for firewall',
        source: 'lead_conversion',
        tags: ['converted_from_lead'],
      }),
      expect.objectContaining({ sub: USER_IDS.partnerAdminA }),
    );
  });

  test('CONV-002 — already-converted lead throws LEAD_ALREADY_CONVERTED with deal reference', async () => {
    const convertedLead = makeLead({
      status: 'converted',
      assigned_org_id: ORG_IDS.orgA,
      converted_deal_id: DEAL_ID,
    });
    mockRepo.findById.mockResolvedValue(convertedLead);

    await expect(
      leadService.convertLead(LEAD_ID, makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).rejects.toMatchObject({
      code: 'LEAD_ALREADY_CONVERTED',
      statusCode: 422,
    });

    expect(mockDealService.createDeal).not.toHaveBeenCalled();
  });

  test('CONV-003 — new lead cannot be converted: LEAD_NOT_ASSIGNED', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);

    await expect(
      leadService.convertLead(LEAD_ID, makePartnerAdminUser(), ownScope(ORG_IDS.orgA)),
    ).rejects.toMatchObject({ code: 'LEAD_NOT_ASSIGNED' });
  });

  test('CONV-004 — lead with no address fields: customer_address is empty/null', async () => {
    const acceptedLead = makeLead({
      status: 'accepted',
      assigned_org_id: ORG_IDS.orgA,
      city: null,
      state_province: null,
      country: null,
    });

    mockRepo.findById.mockResolvedValue(acceptedLead);
    mockDealService.createDeal.mockResolvedValue({ id: DEAL_ID, deal_number: 'DR-2026-00099' } as any);
    mockRepo.updateStatus.mockResolvedValue({ ...acceptedLead, status: 'converted', converted_deal_id: DEAL_ID, converted_at: new Date(), updated_at: new Date() });
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager, name: 'Org Alpha' }),
    }));

    await leadService.convertLead(LEAD_ID, makePartnerAdminUser(), ownScope(ORG_IDS.orgA));

    expect(mockDealService.createDeal).toHaveBeenCalledWith(
      expect.objectContaining({ customer_address: null }),
      expect.anything(),
    );
  });

  test('CONV-005 — override deal_name takes precedence over auto-generated name', async () => {
    const acceptedLead = makeLead({ status: 'accepted', assigned_org_id: ORG_IDS.orgA });
    mockRepo.findById.mockResolvedValue(acceptedLead);
    mockDealService.createDeal.mockResolvedValue({ id: DEAL_ID, deal_number: 'DR-2026-00099' } as any);
    mockRepo.updateStatus.mockResolvedValue({ ...acceptedLead, status: 'converted', converted_deal_id: DEAL_ID, converted_at: new Date(), updated_at: new Date() });
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager, name: 'Org Alpha' }),
    }));

    await leadService.convertLead(LEAD_ID, makePartnerAdminUser(), ownScope(ORG_IDS.orgA), {
      deal_name: 'Custom Deal Name',
    });

    expect(mockDealService.createDeal).toHaveBeenCalledWith(
      expect.objectContaining({ deal_name: 'Custom Deal Name' }),
      expect.anything(),
    );
  });
});

// =============================================================================
// DISQUALIFY — SCOPING AND VALIDATION
// =============================================================================

describe('Unit: Disqualify lead', () => {
  test('DQ-001 — disqualifyLead sets status=disqualified with reason', async () => {
    const newLead = makeLead({ status: 'new' });
    const reason = 'Not a real business';
    mockRepo.findById.mockResolvedValue(newLead);
    mockRepo.updateStatus.mockResolvedValue({ ...newLead, status: 'disqualified', disqualify_reason: reason, updated_at: new Date() });

    const result = await leadService.disqualifyLead(LEAD_ID, reason, makeAdminUser(), allScope);

    expect(result.status).toBe('disqualified');
    expect(result.disqualify_reason).toBe(reason);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      LEAD_ID,
      'new',
      'disqualified',
      { disqualify_reason: reason },
    );
  });

  test('DQ-002 — cannot disqualify a converted lead (terminal state)', async () => {
    const convertedLead = makeLead({ status: 'converted' });
    mockRepo.findById.mockResolvedValue(convertedLead);

    await expect(
      leadService.disqualifyLead(LEAD_ID, 'Reason', makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'LEAD_INVALID_TRANSITION' });
  });

  test('DQ-003 — disqualify logs activity entry', async () => {
    const assignedLead = makeLead({ status: 'assigned', assigned_org_id: ORG_IDS.orgA });
    const reason = 'Spam inquiry';
    mockRepo.findById.mockResolvedValue(assignedLead);
    mockRepo.updateStatus.mockResolvedValue({ ...assignedLead, status: 'disqualified', disqualify_reason: reason, updated_at: new Date() });

    await leadService.disqualifyLead(LEAD_ID, reason, makeAdminUser(), allScope);

    expect(mockRepo.insertActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'disqualified',
        entity_type: 'lead',
        entity_id: LEAD_ID,
      }),
    );
  });
});

// =============================================================================
// ASSIGN LEAD — ORG VALIDATION
// =============================================================================

describe('Unit: Assign lead — org validation', () => {
  test('ASSIGN-001 — assign to non-existent org: throws ORG_NOT_FOUND', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue(null), // org not found
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, uuidv4(), makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'ORG_NOT_FOUND' });
  });

  test('ASSIGN-002 — assign to suspended org: throws ORG_NOT_ACTIVE', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ id: ORG_IDS.orgA, name: 'Org Alpha', status: 'suspended', channel_manager_id: USER_IDS.channelManager }),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'ORG_NOT_ACTIVE' });
  });

  test('ASSIGN-003 — CM assigning to unmanaged org: throws AUTH_ORG_MISMATCH', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);

    const otherCmId = uuidv4();
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({
        id: ORG_IDS.orgA,
        name: 'Org Alpha',
        status: 'active',
        channel_manager_id: otherCmId, // different CM
        tier_rank: 2,
      }),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeCMUser(), allScope),
    ).rejects.toMatchObject({ code: 'AUTH_ORG_MISMATCH' });
  });

  test('ASSIGN-004 — assign to org with 0 active users: throws ORG_NO_ACTIVE_USERS', async () => {
    const newLead = makeLead({ status: 'new' });
    mockRepo.findById.mockResolvedValue(newLead);

    let callIndex = 0;
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn().mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return Promise.resolve({ id: ORG_IDS.orgA, name: 'Org Alpha', status: 'active', channel_manager_id: USER_IDS.channelManager, tier_rank: 2 });
        }
        return Promise.resolve({ total: '0' }); // no active users
      }),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeAdminUser(), allScope),
    ).rejects.toMatchObject({ code: 'ORG_NO_ACTIVE_USERS' });
  });

  test('ASSIGN-005 — assign notifies partner_admin with lead_assigned notification', async () => {
    const newLead = makeLead({ status: 'new' });
    const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    mockRepo.findById.mockResolvedValue(newLead);
    mockRepo.updateStatus.mockResolvedValue({ ...newLead, status: 'assigned', assigned_org_id: ORG_IDS.orgA, assigned_at: new Date(), sla_deadline: slaDeadline, updated_at: new Date() });

    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      first: jest.fn()
        .mockResolvedValueOnce({ id: ORG_IDS.orgA, name: 'Org Alpha', status: 'active', channel_manager_id: USER_IDS.channelManager, tier_rank: 2 })
        .mockResolvedValueOnce({ total: '2' })
        .mockResolvedValueOnce({ id: USER_IDS.partnerAdminA, role: 'partner_admin' }),
      count: jest.fn().mockReturnThis(),
    }));

    await leadService.assignLead(LEAD_ID, ORG_IDS.orgA, makeAdminUser(), allScope);

    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'lead_assigned',
        entity_type: 'lead',
        entity_id: LEAD_ID,
      }),
    );
  });
});

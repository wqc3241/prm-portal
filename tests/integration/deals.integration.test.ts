/**
 * Integration tests for the Deal Registration API.
 *
 * These tests exercise the full request-response cycle through Express,
 * including middleware (authenticate, scopeToOrg, validate), the
 * controller, the service, and mocked repositories/database.
 *
 * External dependencies (database, Redis) are fully mocked so the
 * tests run in-process without infrastructure.
 *
 * PRD coverage:
 *   - Full deal lifecycle: create -> submit -> approve -> mark won
 *   - Rejection and resubmission flow
 *   - Conflict detection end-to-end
 *   - Cross-org data scoping
 */

// ── Mocks (before all imports) ────────────────────────────────────────────────

jest.mock('../../src/repositories/deal.repository', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findRawById: jest.fn(),
    list: jest.fn(),
    updateStatus: jest.fn(),
    updateFields: jest.fn(),
    insertStatusHistory: jest.fn(),
    getStatusHistory: jest.fn(),
    createApprovalRequest: jest.fn(),
    updateApprovalRequest: jest.fn(),
    findConflicts: jest.fn(),
    findDealProduct: jest.fn(),
    addProduct: jest.fn(),
    removeProduct: jest.fn(),
    getProducts: jest.fn(),
    getProductLineTotal: jest.fn(),
    findExpiring: jest.fn(),
    findExpired: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

jest.mock('../../src/services/organization.service', () => ({
  __esModule: true,
  default: {
    recalculateTier: jest.fn(),
  },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockResolvedValue([]),
  first: jest.fn().mockResolvedValue(null),
  increment: jest.fn().mockReturnThis(),
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
import dealRouter from '../../src/routes/deal.routes';
import dealRepository from '../../src/repositories/deal.repository';
import notificationService from '../../src/services/notification.service';
import organizationService from '../../src/services/organization.service';
import { ORG_IDS, USER_IDS, TIER_IDS } from '../fixtures/factories';

const mockRepo = dealRepository as jest.Mocked<typeof dealRepository>;
const mockNotif = notificationService as jest.Mocked<typeof notificationService>;
const mockOrgService = organizationService as jest.Mocked<typeof organizationService>;
const mockJwtVerify = jwt.verify as jest.Mock;

// ── App setup ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/deals', dealRouter);
  // Global error handler — matches the project's pattern
  app.use((err: any, req: any, res: any, next: any) => {
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

function makeJwt(payload: Record<string, any>) {
  return `Bearer mock-token`;
}

function setupJwtAs(role: string, orgId: string | null = null) {
  mockJwtVerify.mockReturnValue({
    sub: role === 'partner_rep' ? USER_IDS.partnerRepA : USER_IDS.partnerAdminA,
    email: `${role}@example.com`,
    role,
    org_id: orgId,
    tier_id: orgId ? TIER_IDS.registered : null,
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
}

function setupJwtAsAdmin() {
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.admin,
    email: 'admin@example.com',
    role: 'admin',
    org_id: null,
    tier_id: null,
  });
}

// ── Shared deal fixture ───────────────────────────────────────────────────────

function makeDealRow(overrides: Record<string, any> = {}) {
  return {
    id: 'deal-uuid-1',
    deal_number: 'DR-2026-00042',
    organization_id: ORG_IDS.orgA,
    submitted_by: USER_IDS.partnerRepA,
    assigned_to: null,
    customer_company_name: 'Acme Corporation',
    customer_contact_name: 'John Smith',
    customer_contact_email: 'john.smith@acme.com',
    deal_name: 'Acme Corp - PA-5400 Network Refresh',
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
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    source: 'direct',
    tags: [],
    custom_fields: {},
    products: [],
    created_at: new Date('2026-03-18T14:30:00Z'),
    updated_at: new Date('2026-03-18T14:30:00Z'),
    organization_name: 'Org Alpha',
    submitted_by_name: 'Test User',
    assigned_to_name: null,
    ...overrides,
  };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.insertStatusHistory.mockResolvedValue({ id: 'h1' } as any);
  mockRepo.createApprovalRequest.mockResolvedValue({ id: 'ar1' } as any);
  mockRepo.updateApprovalRequest.mockResolvedValue(1 as any);
  mockNotif.createNotification.mockResolvedValue({ id: 'n1' } as any);
  mockOrgService.recalculateTier.mockResolvedValue({ changed: false } as any);
  mockDbChain.first.mockResolvedValue({ channel_manager_id: USER_IDS.channelManager });
});

// ═════════════════════════════════════════════════════════════════════════════
// FULL DEAL LIFECYCLE: create -> submit -> approve -> mark won
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Full deal lifecycle', () => {
  test('QA-001 — POST /deals creates deal with status=draft (201)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const createdDeal = makeDealRow();
    mockRepo.create.mockResolvedValue(createdDeal);

    const res = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', makeJwt({}))
      .send({
        customer_company_name: 'Acme Corporation',
        deal_name: 'Acme Corp - PA-5400 Network Refresh',
        estimated_value: 450000,
        expected_close_date: '2027-06-30',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.products).toEqual([]);
  });

  test('QA-001 — deal_number is present in creation response', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.create.mockResolvedValue(makeDealRow());

    const res = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', makeJwt({}))
      .send({
        customer_company_name: 'Acme Corporation',
        deal_name: 'Acme Deal',
        estimated_value: 100000,
        expected_close_date: '2027-12-31',
      });

    expect(res.body.data.deal_number).toBe('DR-2026-00042');
  });

  test('QA-005 — POST /deals/:id/submit transitions to submitted (200)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const readyDeal = makeDealRow({
      status: 'draft',
      expected_close_date: '2026-06-30',
    });
    mockRepo.findById.mockResolvedValue(readyDeal);
    mockRepo.findConflicts.mockResolvedValue([]);
    mockRepo.updateStatus.mockResolvedValue({ ...readyDeal, status: 'submitted', updated_at: new Date() } as any);
    mockRepo.updateFields.mockResolvedValue(readyDeal as any);
    mockDb.mockImplementation(() => ({
      ...mockDbChain,
      whereIn: jest.fn().mockResolvedValue([]),
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
    }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/submit')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('submitted');
    expect(res.body.data.is_conflicting).toBe(false);
  });

  test('QA-009 — POST /deals/:id/approve transitions to approved with 90-day expiry (200)', async () => {
    setupJwtAsCM();
    const submittedDeal = makeDealRow({ status: 'submitted' });
    const approvedAt = new Date();
    const expiresAt = new Date(approvedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    mockRepo.findById.mockResolvedValue(submittedDeal);
    mockRepo.updateStatus.mockResolvedValue({
      ...submittedDeal,
      status: 'approved',
      approved_by: USER_IDS.channelManager,
      approved_at: approvedAt,
      registration_expires_at: expiresAt,
      updated_at: new Date(),
    } as any);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/approve')
      .set('Authorization', makeJwt({}))
      .send({ comments: 'Looks good' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.registration_expires_at).toBeDefined();
  });

  test('QA-013 — POST /deals/:id/mark-won transitions to won, org metrics updated (200)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const approvedDeal = makeDealRow({ status: 'approved' });
    const wonResult = {
      ...approvedDeal,
      status: 'won',
      actual_value: 425000,
      actual_close_date: '2026-04-15',
      updated_at: new Date(),
    };
    mockRepo.findById.mockResolvedValue(approvedDeal);
    mockRepo.updateStatus.mockResolvedValue(wonResult as any);
    mockDb.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: USER_IDS.channelManager }
          : { id: USER_IDS.admin },
      ),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/mark-won')
      .set('Authorization', makeJwt({}))
      .send({ actual_value: 425000, actual_close_date: '2026-04-15' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('won');
    expect(res.body.data.actual_value).toBe(425000);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REJECTION AND RESUBMISSION FLOW
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Rejection and resubmission flow', () => {
  test('QA-010 — POST /deals/:id/reject sets status=rejected with reason (200)', async () => {
    setupJwtAsCM();
    const submittedDeal = makeDealRow({ status: 'submitted' });
    const reason = 'Duplicate registration.';
    mockRepo.findById.mockResolvedValue(submittedDeal);
    mockRepo.updateStatus.mockResolvedValue({
      ...submittedDeal,
      status: 'rejected',
      rejection_reason: reason,
      updated_at: new Date(),
    } as any);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/reject')
      .set('Authorization', makeJwt({}))
      .send({ rejection_reason: reason });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejection_reason).toBe(reason);
  });

  test('QA-011 — reject without reason: 422', async () => {
    setupJwtAsCM();

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/reject')
      .set('Authorization', makeJwt({}))
      .send({ rejection_reason: '' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('QA-012 — POST /deals/:id/submit on rejected deal resubmits: status=submitted', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const rejectedDeal = makeDealRow({ status: 'rejected', rejection_reason: 'Old reason' });
    mockRepo.findById.mockResolvedValue(rejectedDeal);
    mockRepo.findConflicts.mockResolvedValue([]);
    mockRepo.updateStatus.mockResolvedValue({
      ...rejectedDeal,
      status: 'submitted',
      updated_at: new Date(),
    } as any);
    mockRepo.updateFields.mockResolvedValue(rejectedDeal as any);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/submit')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
  });

  test('QA-012 — resubmission creates new approval_request', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const rejectedDeal = makeDealRow({ status: 'rejected' });
    mockRepo.findById.mockResolvedValue(rejectedDeal);
    mockRepo.findConflicts.mockResolvedValue([]);
    mockRepo.updateStatus.mockResolvedValue({ ...rejectedDeal, status: 'submitted', updated_at: new Date() } as any);
    mockRepo.updateFields.mockResolvedValue(rejectedDeal as any);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
      increment: jest.fn().mockReturnThis(),
    }));

    await request(app)
      .post('/api/v1/deals/deal-uuid-1/submit')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(mockRepo.createApprovalRequest).toHaveBeenCalledTimes(1);
    expect(mockRepo.createApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: 'deal-uuid-1' }),
    );
  });

  test('QA-012 — CM notified again on resubmission', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const rejectedDeal = makeDealRow({ status: 'rejected' });
    mockRepo.findById.mockResolvedValue(rejectedDeal);
    mockRepo.findConflicts.mockResolvedValue([]);
    mockRepo.updateStatus.mockResolvedValue({ ...rejectedDeal, status: 'submitted', updated_at: new Date() } as any);
    mockRepo.updateFields.mockResolvedValue(rejectedDeal as any);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
      increment: jest.fn().mockReturnThis(),
    }));

    await request(app)
      .post('/api/v1/deals/deal-uuid-1/submit')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_IDS.channelManager }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CONFLICT DETECTION END-TO-END
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Conflict detection', () => {
  test('QA-007 — submit with conflicts sets is_conflicting=true in response', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const deal = makeDealRow({ status: 'draft' });
    mockRepo.findById.mockResolvedValue(deal);
    mockRepo.findConflicts.mockResolvedValue([
      {
        conflicting_deal_id: 'conflict-uuid',
        conflicting_deal_number: 'DR-2026-00038',
        conflicting_org_name: 'CloudGuard Inc',
        match_type: 'exact_email',
        similarity_score: '1.0',
      },
    ]);
    mockRepo.updateStatus.mockResolvedValue({
      ...deal,
      status: 'submitted',
      is_conflicting: true,
      conflict_deal_id: 'conflict-uuid',
      updated_at: new Date(),
    } as any);
    mockRepo.updateFields.mockResolvedValue(deal as any);
    mockDb.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-uuid', organization_id: ORG_IDS.orgB }, // different org
      ]),
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/submit')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.is_conflicting).toBe(true);
    expect(res.body.data.conflicts).toHaveLength(1);
    expect(res.body.data.conflicts[0].match_type).toBe('exact_email');
  });

  test('QA-027 — same-org conflict excluded: is_conflicting=false when only conflict is from same org', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const deal = makeDealRow({ status: 'draft' });
    mockRepo.findById.mockResolvedValue(deal);
    mockRepo.findConflicts.mockResolvedValue([
      {
        conflicting_deal_id: 'same-org-deal',
        conflicting_deal_number: 'DR-2026-00010',
        conflicting_org_name: 'Org Alpha', // same org
        match_type: 'exact_email',
        similarity_score: '1.0',
      },
    ]);
    mockRepo.updateStatus.mockResolvedValue({
      ...deal,
      status: 'submitted',
      is_conflicting: false,
      updated_at: new Date(),
    } as any);
    mockRepo.updateFields.mockResolvedValue(deal as any);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'same-org-deal', organization_id: ORG_IDS.orgA }, // SAME org
      ]),
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/submit')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.is_conflicting).toBe(false);
    expect(res.body.data.conflicts).toHaveLength(0);
  });

  test('QA-031 — GET /deals/conflict-check returns conflicts without creating a deal', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.findConflicts.mockResolvedValue([
      {
        conflicting_deal_id: 'conflict-uuid',
        conflicting_deal_number: 'DR-2026-00038',
        conflicting_org_name: 'CloudGuard Inc',
        match_type: 'fuzzy_company',
        similarity_score: '0.72',
      },
    ]);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-uuid', organization_id: ORG_IDS.orgB },
      ]),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .get('/api/v1/deals/conflict-check?customer_company=Acme+Corporation')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].match_type).toBe('fuzzy_company');
    // No deal was created
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  test('QA-031 — conflict-check requires customer_company: 422 when missing', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .get('/api/v1/deals/conflict-check')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(422);
  });

  test('GET /deals/:id/conflicts returns conflicts for the deal', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const conflictingDeal = makeDealRow({ is_conflicting: true });
    mockRepo.findById.mockResolvedValue(conflictingDeal);
    mockRepo.findConflicts.mockResolvedValue([
      {
        conflicting_deal_id: 'conflict-uuid',
        conflicting_deal_number: 'DR-2026-00038',
        conflicting_org_name: 'CloudGuard Inc',
        match_type: 'fuzzy_company',
        similarity_score: '0.68',
      },
    ]);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-uuid', organization_id: ORG_IDS.orgB },
      ]),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .get('/api/v1/deals/deal-uuid-1/conflicts')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].conflicting_org_name).toBe('CloudGuard Inc');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CROSS-ORG DATA SCOPING
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Cross-org data scoping', () => {
  test('QA-041 — partner A getting Org B deal returns 404 (not 403)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    // scopeToOrg restricts query; findById returns null for out-of-scope deal
    mockRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/deals/org-b-deal-uuid')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(404);
    // Must NOT return 403 (would reveal existence)
    expect(res.status).not.toBe(403);
  });

  test('QA-002 — admin cannot POST /deals (403 from authorize middleware)', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', makeJwt({}))
      .send({
        customer_company_name: 'Acme',
        deal_name: 'Admin Deal',
        estimated_value: 100000,
        expected_close_date: '2027-12-31',
      });

    expect(res.status).toBe(403);
  });

  test('partner cannot POST /deals/:id/approve (403 from authorize middleware)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/approve')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(403);
  });

  test('partner cannot POST /deals/:id/reject (403 from authorize middleware)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/reject')
      .set('Authorization', makeJwt({}))
      .send({ rejection_reason: 'rejected' });

    expect(res.status).toBe(403);
  });

  test('QA-043 — CM GET /deals/:id for unassigned org deal returns 404', async () => {
    setupJwtAsCM();
    // CM's org scope does not include orgB; findById returns null
    mockRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/deals/org-b-deal-uuid')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(404);
  });

  test('QA-044 — GET /deals returns list scoped to user role', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.list.mockResolvedValue({ data: [makeDealRow()], total: 1 });

    const res = await request(app)
      .get('/api/v1/deals')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ total: 1 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// VALIDATION ERRORS
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Validation errors', () => {
  test('QA-003 — POST /deals missing customer_company_name: 422 with field error', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', makeJwt({}))
      .send({
        deal_name: 'Deal without company',
        estimated_value: 100000,
        expected_close_date: '2027-12-31',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'customer_company_name' }),
      ]),
    );
  });

  test('POST /deals missing deal_name: 422', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', makeJwt({}))
      .send({
        customer_company_name: 'Acme',
        estimated_value: 100000,
        expected_close_date: '2027-12-31',
      });

    expect(res.status).toBe(422);
  });

  test('POST /deals missing estimated_value: 422', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', makeJwt({}))
      .send({
        customer_company_name: 'Acme',
        deal_name: 'Acme Deal',
        expected_close_date: '2027-12-31',
      });

    expect(res.status).toBe(422);
  });

  test('POST /deals with estimated_value <= 0: 422', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals')
      .set('Authorization', makeJwt({}))
      .send({
        customer_company_name: 'Acme',
        deal_name: 'Acme Deal',
        estimated_value: -100,
        expected_close_date: '2027-12-31',
      });

    expect(res.status).toBe(422);
  });

  test('QA-006 — submit deal missing expected_close_date at submission: 422 DEAL_INCOMPLETE', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.findById.mockResolvedValue(
      makeDealRow({ status: 'draft', expected_close_date: null }),
    );

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/submit')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DEAL_INCOMPLETE', field: 'expected_close_date' }),
      ]),
    );
  });

  test('QA-015 — POST /deals/:id/mark-lost without loss_reason: 422', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/mark-lost')
      .set('Authorization', makeJwt({}))
      .send({ loss_reason: '' });

    expect(res.status).toBe(422);
  });

  test('QA-038 — add product with quantity=0: 422', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/products')
      .set('Authorization', makeJwt({}))
      .send({
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 0,
        unit_price: 100,
        discount_pct: 0,
      });

    expect(res.status).toBe(422);
  });

  test('QA-039 — add product with discount_pct=101: 422', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/products')
      .set('Authorization', makeJwt({}))
      .send({
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        quantity: 1,
        unit_price: 100,
        discount_pct: 101,
      });

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STATUS TRANSITION ERRORS (integration layer)
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Invalid status transitions return 422 DEAL_INVALID_TRANSITION', () => {
  test('QA-016 — approve from draft: 422', async () => {
    setupJwtAsCM();
    mockRepo.findById.mockResolvedValue(makeDealRow({ status: 'draft' }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/approve')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('DEAL_INVALID_TRANSITION');
  });

  test('QA-018 — mark won from submitted: 422', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.findById.mockResolvedValue(makeDealRow({ status: 'submitted' }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/mark-won')
      .set('Authorization', makeJwt({}))
      .send({ actual_value: 100000 });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('DEAL_INVALID_TRANSITION');
  });

  test('QA-019 — approve from rejected: 422', async () => {
    setupJwtAsCM();
    mockRepo.findById.mockResolvedValue(makeDealRow({ status: 'rejected' }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/approve')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(422);
  });

  test('QA-022 — expired is terminal: cannot approve', async () => {
    setupJwtAsCM();
    mockRepo.findById.mockResolvedValue(makeDealRow({ status: 'expired' }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/approve')
      .set('Authorization', makeJwt({}))
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('DEAL_INVALID_TRANSITION');
  });

  test('QA-020 — won is terminal: cannot mark won again', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.findById.mockResolvedValue(makeDealRow({ status: 'won' }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/mark-won')
      .set('Authorization', makeJwt({}))
      .send({ actual_value: 100000 });

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DEAL PRODUCTS (integration)
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Deal products', () => {
  const productId = '550e8400-e29b-41d4-a716-446655440001';

  test('QA-032 — POST /deals/:id/products adds product (201)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const draftDeal = makeDealRow({ status: 'draft' });
    mockRepo.findById.mockResolvedValue(draftDeal);
    mockRepo.findDealProduct.mockResolvedValue(null);
    mockRepo.addProduct.mockResolvedValue({ id: 'dp-uuid', line_total: 405000 } as any);
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 405000, count: 1 });
    mockRepo.getProducts.mockResolvedValue([
      { id: 'dp-uuid', product_id: productId, product_name: 'PA-5400', line_total: 405000 },
    ] as any);
    mockRepo.updateFields.mockResolvedValue(draftDeal as any);
    mockDb.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: productId, is_active: true, available_to_partners: true }),
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/products')
      .set('Authorization', makeJwt({}))
      .send({
        product_id: productId,
        quantity: 6,
        unit_price: 75000,
        discount_pct: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.deal_estimated_value).toBe(405000);
  });

  test('QA-033 — duplicate product returns 409', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.findById.mockResolvedValue(makeDealRow({ status: 'draft' }));
    mockRepo.findDealProduct.mockResolvedValue({ id: 'existing' } as any);
    mockDb.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: productId, is_active: true, available_to_partners: true }),
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      increment: jest.fn().mockReturnThis(),
    }));

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/products')
      .set('Authorization', makeJwt({}))
      .send({ product_id: productId, quantity: 1, unit_price: 100, discount_pct: 0 });

    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe('DEAL_DUPLICATE_PRODUCT');
  });

  test('QA-036 — DELETE /deals/:id/products/:productId removes product (200)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.findById.mockResolvedValue(makeDealRow({ status: 'draft' }));
    mockRepo.findDealProduct.mockResolvedValue({ id: 'dp-uuid' } as any);
    mockRepo.removeProduct.mockResolvedValue(1 as any);
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 0, count: 0 });

    const res = await request(app)
      .delete(`/api/v1/deals/deal-uuid-1/products/${productId}`)
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(200);
    expect(res.body.data.removed).toBe(true);
  });

  test('QA-037 — removing last product: deal estimated_value not reset to 0', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const dealWithValue = makeDealRow({ status: 'draft', estimated_value: 450000 });
    mockRepo.findById.mockResolvedValue(dealWithValue);
    mockRepo.findDealProduct.mockResolvedValue({ id: 'dp-uuid' } as any);
    mockRepo.removeProduct.mockResolvedValue(1 as any);
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 0, count: 0 });

    const res = await request(app)
      .delete(`/api/v1/deals/deal-uuid-1/products/${productId}`)
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(200);
    expect(res.body.data.deal_estimated_value).toBe(450000);
    // updateFields should NOT have been called to zero out estimated_value
    expect(mockRepo.updateFields).not.toHaveBeenCalledWith(
      expect.any(String),
      { estimated_value: 0 },
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STATUS HISTORY
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Status history', () => {
  test('QA-060 — GET /deals/:id/history returns ordered audit trail', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    mockRepo.findById.mockResolvedValue(makeDealRow());
    mockRepo.getStatusHistory.mockResolvedValue([
      {
        id: 'h1',
        from_status: null,
        to_status: 'draft',
        changed_by: USER_IDS.partnerRepA,
        changed_by_name: 'Test User',
        notes: 'Deal created',
        created_at: new Date('2026-03-18T10:00:00Z'),
      },
      {
        id: 'h2',
        from_status: 'draft',
        to_status: 'submitted',
        changed_by: USER_IDS.partnerRepA,
        changed_by_name: 'Test User',
        notes: 'Submitted for review',
        created_at: new Date('2026-03-18T11:00:00Z'),
      },
    ] as any);

    const res = await request(app)
      .get('/api/v1/deals/deal-uuid-1/history')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].from_status).toBeNull();
    expect(res.body.data[0].to_status).toBe('draft');
    expect(res.body.data[1].to_status).toBe('submitted');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MARK LOST
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Mark lost', () => {
  test('QA-014 — POST /deals/:id/mark-lost with loss_reason: 200 status=lost', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    const approvedDeal = makeDealRow({ status: 'approved' });
    mockRepo.findById.mockResolvedValue(approvedDeal);
    mockRepo.updateStatus.mockResolvedValue({
      ...approvedDeal,
      status: 'lost',
      custom_fields: { loss_reason: 'Customer chose competitor' },
      updated_at: new Date(),
    } as any);

    const res = await request(app)
      .post('/api/v1/deals/deal-uuid-1/mark-lost')
      .set('Authorization', makeJwt({}))
      .send({ loss_reason: 'Customer chose competitor' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('lost');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// EXPIRING DEALS ENDPOINT
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Expiring deals', () => {
  test('GET /deals/expiring returns expiring deals for CM', async () => {
    setupJwtAsCM();
    mockRepo.findExpiring.mockResolvedValue({
      data: [makeDealRow({ status: 'approved' })],
      total: 1,
    });

    const res = await request(app)
      .get('/api/v1/deals/expiring?days=14')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  test('GET /deals/expiring forbidden for partner_rep', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);

    const res = await request(app)
      .get('/api/v1/deals/expiring')
      .set('Authorization', makeJwt({}));

    expect(res.status).toBe(403);
  });
});

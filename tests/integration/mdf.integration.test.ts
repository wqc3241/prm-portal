/**
 * Integration tests for the MDF (Market Development Funds) API.
 *
 * These tests exercise the full request-response cycle through Express,
 * including middleware (authenticate, scopeToOrg, validate), the
 * controller, the service, and mocked repositories/database.
 *
 * External dependencies (database, Redis) are fully mocked so the
 * tests run in-process without infrastructure.
 *
 * Coverage:
 *   - Full MDF lifecycle: allocate -> request -> submit -> approve -> complete -> claim -> approve claim -> reimburse
 *   - Rejection flow: submit -> reject -> verify reason
 *   - Claim rejection and resubmission
 *   - Cross-org data scoping (partner, CM, admin)
 *   - Auto-allocate endpoint
 */

// ── Mocks (before all imports) ────────────────────────────────────────────────

jest.mock('../../src/repositories/mdf.repository', () => ({
  __esModule: true,
  default: {
    createAllocation: jest.fn(),
    findAllocationById: jest.fn(),
    findAllocationByOrgQuarter: jest.fn(),
    listAllocations: jest.fn(),
    updateAllocation: jest.fn(),
    adjustSpentAmount: jest.fn(),
    findAllocationForUpdate: jest.fn(),
    getActiveOrgsWithTier: jest.fn(),
    getTrailingRevenue: jest.fn(),
    getTopPerformerThreshold: jest.fn(),
    createRequest: jest.fn(),
    findRequestById: jest.fn(),
    findRequestRawById: jest.fn(),
    listRequests: jest.fn(),
    updateRequestStatus: jest.fn(),
    updateRequestStatusTrx: jest.fn(),
    updateRequestFields: jest.fn(),
    getRequestTotals: jest.fn(),
    createApprovalRequest: jest.fn(),
    updateApprovalRequest: jest.fn(),
    findRequestsForClaimDeadline: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

const mockTrx = jest.fn(() => mockTrxChain) as any;
const mockTrxChain: any = {
  where: jest.fn().mockReturnThis(),
  forUpdate: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
};

// Track which JWT payload is active so the db mock can respond correctly
let activeJwtPayload: any = null;

function makeDbChain(resolveFirst: any = null): any {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockResolvedValue([]),
    first: jest.fn().mockResolvedValue(resolveFirst),
    increment: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
  };
  return chain;
}

const mockDb = jest.fn((table: string) => {
  if (table === 'users' && activeJwtPayload) {
    // authenticate middleware: db('users').select(...).where('id', sub).first()
    return makeDbChain({
      id: activeJwtPayload.sub,
      email: activeJwtPayload.email,
      role: activeJwtPayload.role,
      organization_id: activeJwtPayload.org_id,
      is_active: true,
    });
  }
  if (table === 'organizations' && activeJwtPayload) {
    if (activeJwtPayload.role === 'channel_manager') {
      // scopeToOrg: db('organizations').select('id').where('channel_manager_id', sub)
      // Returns array of assigned orgs (thenable)
      const chain = makeDbChain({ id: ORG_IDS.orgA, status: 'active', tier_id: TIER_IDS.registered, channel_manager_id: USER_IDS.channelManager });
      // Make it resolve as array for scopeToOrg
      chain.then = (resolve: any) => resolve([{ id: ORG_IDS.orgA }]);
      return chain;
    }
    // authenticate middleware for partner: db('organizations').select(...).where('id', org_id).first()
    return makeDbChain({
      id: activeJwtPayload.org_id || ORG_IDS.orgA,
      status: 'active',
      tier_id: TIER_IDS.registered,
      channel_manager_id: USER_IDS.channelManager,
    });
  }
  if (table === 'activity_feed') {
    return {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
    };
  }
  return makeDbChain(null);
}) as any;
mockDb.raw = jest.fn();
mockDb.fn = { now: jest.fn(() => new Date()) };
mockDb.transaction = jest.fn(async (cb: (trx: any) => Promise<any>) => {
  return cb(mockTrx);
});

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// Mock JWT verification
jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import jwt from 'jsonwebtoken';
import express, { Application } from 'express';
import mdfRouter from '../../src/routes/mdf.routes';
import mdfRepository from '../../src/repositories/mdf.repository';
import notificationService from '../../src/services/notification.service';
import { ORG_IDS, USER_IDS, TIER_IDS } from '../fixtures/factories';

const mockRepo = mdfRepository as jest.Mocked<typeof mdfRepository>;
const mockNotif = notificationService as jest.Mocked<typeof notificationService>;
const mockJwtVerify = jwt.verify as jest.Mock;

// ── App setup ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/mdf', mdfRouter);
  // Global error handler
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

// ── JWT helpers ───────────────────────────────────────────────────────────────

function makeJwt() {
  return 'Bearer mock-token';
}

function setupJwtAsPartnerAdmin(orgId: string = ORG_IDS.orgA) {
  const userId = orgId === ORG_IDS.orgA ? USER_IDS.partnerAdminA : USER_IDS.partnerAdminB;
  const payload = {
    sub: userId,
    email: 'partner.admin@example.com',
    role: 'partner_admin',
    org_id: orgId,
    tier_id: TIER_IDS.registered,
  };
  mockJwtVerify.mockReturnValue(payload);
  activeJwtPayload = payload;
}

function setupJwtAsCM() {
  const payload = {
    sub: USER_IDS.channelManager,
    email: 'cm@example.com',
    role: 'channel_manager',
    org_id: null,
    tier_id: null,
  };
  mockJwtVerify.mockReturnValue(payload);
  activeJwtPayload = payload;
}

function setupJwtAsAdmin() {
  const payload = {
    sub: USER_IDS.admin,
    email: 'admin@example.com',
    role: 'admin',
    org_id: null,
    tier_id: null,
  };
  mockJwtVerify.mockReturnValue(payload);
  activeJwtPayload = payload;
}

// ── Fixed UUIDs for URL params (must be valid UUIDs for validator) ───────────
const ALLOC_ID = '00000000-0000-4000-a000-000000000001';
const REQ_ID = '00000000-0000-4000-a000-000000000002';

// ── Shared fixtures ───────────────────────────────────────────────────────────

function makeAllocationRow(overrides: Record<string, any> = {}) {
  return {
    id: ALLOC_ID,
    organization_id: ORG_IDS.orgA,
    fiscal_year: 2026,
    fiscal_quarter: 1,
    allocated_amount: '50000.00',
    spent_amount: '10000.00',
    remaining_amount: '40000.00',
    notes: null,
    organization_name: 'Org Alpha',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeRequestRow(overrides: Record<string, any> = {}) {
  return {
    id: REQ_ID,
    request_number: 'MR-2026-00001',
    allocation_id: ALLOC_ID,
    organization_id: ORG_IDS.orgA,
    submitted_by: USER_IDS.partnerAdminA,
    activity_type: 'event',
    activity_name: 'Partner Summit 2026',
    description: 'Event description',
    start_date: '2026-05-01',
    end_date: '2026-05-03',
    requested_amount: '15000.00',
    approved_amount: null,
    claim_amount: null,
    reimbursement_amount: null,
    status: 'draft',
    rejection_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    proof_of_execution: null,
    claim_notes: null,
    claim_submitted_at: null,
    reimbursed_at: null,
    organization_name: 'Org Alpha',
    submitted_by_name: 'Test User',
    reviewed_by_name: null,
    allocation_allocated_amount: '50000.00',
    allocation_spent_amount: '10000.00',
    allocation_remaining_amount: '40000.00',
    allocation_fiscal_year: 2026,
    allocation_fiscal_quarter: 1,
    created_at: new Date('2026-03-01'),
    updated_at: new Date('2026-03-01'),
    ...overrides,
  };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  activeJwtPayload = null;
  mockRepo.createApprovalRequest.mockResolvedValue({ id: 'ar-1' } as any);
  mockRepo.updateApprovalRequest.mockResolvedValue(1 as any);
  mockNotif.createNotification.mockResolvedValue({ id: 'n-1' } as any);
  mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTrx));
});

// ═════════════════════════════════════════════════════════════════════════════
// FULL MDF LIFECYCLE
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Full MDF lifecycle', () => {
  test('POST /mdf/allocations creates allocation (201)', async () => {
    setupJwtAsAdmin();
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(null);
    mockRepo.createAllocation.mockResolvedValue(makeAllocationRow());

    const res = await request(app)
      .post('/api/v1/mdf/allocations')
      .set('Authorization', makeJwt())
      .send({
        organization_id: ORG_IDS.orgA,
        fiscal_year: 2026,
        fiscal_quarter: 1,
        allocated_amount: 50000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.allocated_amount).toBe('50000.00');
  });

  test('POST /mdf/requests creates request in draft (201)', async () => {
    setupJwtAsPartnerAdmin();
    mockRepo.findAllocationById.mockResolvedValue(makeAllocationRow());
    mockRepo.createRequest.mockResolvedValue(makeRequestRow());

    const res = await request(app)
      .post('/api/v1/mdf/requests')
      .set('Authorization', makeJwt())
      .send({
        allocation_id: ALLOC_ID,
        activity_type: 'event',
        activity_name: 'Partner Summit 2026',
        start_date: '2026-05-01',
        end_date: '2026-05-03',
        requested_amount: 15000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
  });

  test('POST /mdf/requests/:id/submit transitions to submitted (200)', async () => {
    setupJwtAsPartnerAdmin();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({ status: 'draft', start_date: futureDate.toISOString().slice(0, 10) }),
    );
    mockRepo.findAllocationForUpdate.mockResolvedValue(makeAllocationRow());
    mockRepo.updateRequestStatusTrx.mockResolvedValue({
      ...makeRequestRow(),
      status: 'submitted',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/submit`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
  });

  test('POST /mdf/requests/:id/approve transitions to approved (200)', async () => {
    setupJwtAsCM();
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({ status: 'submitted', requested_amount: '15000.00' }),
    );
    mockRepo.findAllocationForUpdate.mockResolvedValue(makeAllocationRow());
    mockRepo.adjustSpentAmount.mockResolvedValue(makeAllocationRow({ spent_amount: '25000.00' }));
    mockRepo.updateRequestStatusTrx.mockResolvedValue({
      status: 'approved',
      approved_amount: 15000,
      reviewed_by: USER_IDS.channelManager,
      reviewed_at: new Date(),
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/approve`)
      .set('Authorization', makeJwt())
      .send({ approved_amount: 15000 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.approved_amount).toBe(15000);
  });

  test('POST /mdf/requests/:id/complete transitions to completed (200)', async () => {
    setupJwtAsPartnerAdmin();
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({ status: 'approved', end_date: '2026-05-03' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'completed',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/complete`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.claim_deadline).toBeDefined();
  });

  test('POST /mdf/requests/:id/claim submits claim (200)', async () => {
    setupJwtAsPartnerAdmin();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 10);
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({
        status: 'completed',
        approved_amount: '15000.00',
        end_date: endDate.toISOString().slice(0, 10),
      }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_submitted',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/claim`)
      .set('Authorization', makeJwt())
      .send({
        claim_amount: 12000,
        claim_notes: 'Event successful',
        proof_of_execution: ['https://s3.example.com/proof1.pdf'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('claim_submitted');
    expect(res.body.data.claim_amount).toBe(12000);
  });

  test('POST /mdf/requests/:id/approve-claim approves claim (200)', async () => {
    setupJwtAsCM();
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({ status: 'claim_submitted', claim_amount: '12000.00' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_approved',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/approve-claim`)
      .set('Authorization', makeJwt())
      .send({ reimbursement_amount: 12000 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('claim_approved');
  });

  test('POST /mdf/requests/:id/reimburse marks reimbursed (200)', async () => {
    setupJwtAsAdmin();
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({ status: 'claim_approved', reimbursement_amount: '12000.00' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'reimbursed',
      reimbursed_at: new Date(),
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/reimburse`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('reimbursed');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REJECTION FLOW
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Rejection flow', () => {
  test('POST /mdf/requests/:id/reject sets status=rejected with reason (200)', async () => {
    setupJwtAsCM();
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({ status: 'submitted' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'rejected',
      rejection_reason: 'Not aligned with program goals',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/reject`)
      .set('Authorization', makeJwt())
      .send({ rejection_reason: 'Not aligned with program goals' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejection_reason).toBe('Not aligned with program goals');
  });

  test('reject without reason: 422 validation error', async () => {
    setupJwtAsCM();

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/reject`)
      .set('Authorization', makeJwt())
      .send({ rejection_reason: '' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM REJECTION AND RESUBMISSION
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Claim rejection and resubmission', () => {
  test('POST /mdf/requests/:id/reject-claim rejects claim (200)', async () => {
    setupJwtAsCM();
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({ status: 'claim_submitted' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_rejected',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/reject-claim`)
      .set('Authorization', makeJwt())
      .send({ rejection_reason: 'Insufficient proof documents' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('claim_rejected');
  });

  test('resubmit claim after rejection: claim_rejected -> claim_submitted', async () => {
    setupJwtAsPartnerAdmin();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 10);
    mockRepo.findRequestById.mockResolvedValue(
      makeRequestRow({
        status: 'claim_rejected',
        approved_amount: '15000.00',
        end_date: endDate.toISOString().slice(0, 10),
      }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_submitted',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/claim`)
      .set('Authorization', makeJwt())
      .send({
        claim_amount: 12000,
        proof_of_execution: ['https://s3.example.com/updated-proof.pdf'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('claim_submitted');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CROSS-ORG DATA SCOPING
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Cross-org data scoping', () => {
  test('partner can only see own org allocations', async () => {
    setupJwtAsPartnerAdmin(ORG_IDS.orgA);
    mockRepo.listAllocations.mockResolvedValue({ data: [makeAllocationRow()], total: 1 });

    const res = await request(app)
      .get('/api/v1/mdf/allocations')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // scopeToOrg sets type:'own', organizationId = orgA which is passed to repo
    expect(mockRepo.listAllocations).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'own', organizationId: ORG_IDS.orgA }),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('partner getting other org allocation returns 404', async () => {
    setupJwtAsPartnerAdmin(ORG_IDS.orgA);
    // findAllocationById returns null because scope filters it out
    mockRepo.findAllocationById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/mdf/allocations/00000000-0000-4000-a000-000000000099`)
      .set('Authorization', makeJwt());

    expect(res.status).toBe(404);
  });

  test('admin can see all allocations', async () => {
    setupJwtAsAdmin();
    mockRepo.listAllocations.mockResolvedValue({ data: [], total: 0 });

    const res = await request(app)
      .get('/api/v1/mdf/allocations')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(mockRepo.listAllocations).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'all' }),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('partner_admin cannot access auto-allocate (admin only): 403', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .post('/api/v1/mdf/allocations/auto-allocate')
      .set('Authorization', makeJwt())
      .send({ fiscal_year: 2026, fiscal_quarter: 1 });

    expect(res.status).toBe(403);
  });

  test('partner_rep cannot create MDF request (partner_admin only): 403', async () => {
    const payload = {
      sub: USER_IDS.partnerRepA,
      email: 'rep@example.com',
      role: 'partner_rep',
      org_id: ORG_IDS.orgA,
      tier_id: TIER_IDS.registered,
    };
    mockJwtVerify.mockReturnValue(payload);
    activeJwtPayload = payload;

    const res = await request(app)
      .post('/api/v1/mdf/requests')
      .set('Authorization', makeJwt())
      .send({
        allocation_id: ALLOC_ID,
        activity_type: 'event',
        activity_name: 'Test Event',
        start_date: '2026-05-01',
        end_date: '2026-05-03',
        requested_amount: 5000,
      });

    expect(res.status).toBe(403);
  });

  test('partner cannot approve request (CM/admin only): 403', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/approve`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(403);
  });

  test('partner cannot reject request (CM/admin only): 403', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/reject`)
      .set('Authorization', makeJwt())
      .send({ rejection_reason: 'reason' });

    expect(res.status).toBe(403);
  });

  test('CM cannot mark reimbursed (admin only): 403', async () => {
    setupJwtAsCM();

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/reimburse`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AUTO-ALLOCATE ENDPOINT
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Auto-allocate', () => {
  test('POST /mdf/allocations/auto-allocate processes orgs (200)', async () => {
    setupJwtAsAdmin();
    mockRepo.getActiveOrgsWithTier.mockResolvedValue([
      {
        org_id: ORG_IDS.orgA,
        org_name: 'Org Alpha',
        tier_id: TIER_IDS.platinum,
        tier_name: 'Platinum Innovator',
        mdf_budget_pct: '5',
      },
    ]);
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(null);
    mockRepo.getTrailingRevenue.mockResolvedValue(400000);
    mockRepo.getTopPerformerThreshold.mockResolvedValue(1000000);
    mockRepo.createAllocation.mockResolvedValue(makeAllocationRow({ allocated_amount: '20000.00' }));

    const res = await request(app)
      .post('/api/v1/mdf/allocations/auto-allocate')
      .set('Authorization', makeJwt())
      .send({ fiscal_year: 2026, fiscal_quarter: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(1);
  });

  test('auto-allocate missing fiscal_year: 422', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .post('/api/v1/mdf/allocations/auto-allocate')
      .set('Authorization', makeJwt())
      .send({ fiscal_quarter: 1 });

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// VALIDATION ERRORS
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Validation errors', () => {
  test('POST /mdf/allocations missing organization_id: 422', async () => {
    setupJwtAsAdmin();

    const res = await request(app)
      .post('/api/v1/mdf/allocations')
      .set('Authorization', makeJwt())
      .send({
        fiscal_year: 2026,
        fiscal_quarter: 1,
        allocated_amount: 50000,
      });

    expect(res.status).toBe(422);
  });

  test('POST /mdf/requests missing activity_name: 422', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .post('/api/v1/mdf/requests')
      .set('Authorization', makeJwt())
      .send({
        allocation_id: ALLOC_ID,
        activity_type: 'event',
        start_date: '2026-05-01',
        end_date: '2026-05-03',
        requested_amount: 5000,
      });

    expect(res.status).toBe(422);
  });

  test('POST /mdf/requests/:id/claim missing proof_of_execution: 422', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/claim`)
      .set('Authorization', makeJwt())
      .send({
        claim_amount: 12000,
      });

    expect(res.status).toBe(422);
  });

  test('POST /mdf/requests/:id/claim with claim_amount <= 0: 422', async () => {
    setupJwtAsPartnerAdmin();

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/claim`)
      .set('Authorization', makeJwt())
      .send({
        claim_amount: 0,
        proof_of_execution: ['https://proof.com/doc.pdf'],
      });

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DUPLICATE ALLOCATION
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Duplicate allocation', () => {
  test('POST /mdf/allocations duplicate org+year+quarter: 409', async () => {
    setupJwtAsAdmin();
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(makeAllocationRow());

    const res = await request(app)
      .post('/api/v1/mdf/allocations')
      .set('Authorization', makeJwt())
      .send({
        organization_id: ORG_IDS.orgA,
        fiscal_year: 2026,
        fiscal_quarter: 1,
        allocated_amount: 50000,
      });

    expect(res.status).toBe(409);
    expect(res.body.errors[0].code).toBe('MDF_ALLOCATION_EXISTS');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STATUS TRANSITION ERRORS
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: Invalid status transitions', () => {
  test('approve from draft: 422', async () => {
    setupJwtAsCM();
    mockRepo.findRequestById.mockResolvedValue(makeRequestRow({ status: 'draft' }));

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/approve`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('MDF_INVALID_TRANSITION');
  });

  test('complete from draft: 422', async () => {
    setupJwtAsPartnerAdmin();
    mockRepo.findRequestById.mockResolvedValue(makeRequestRow({ status: 'draft' }));

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/complete`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('MDF_INVALID_TRANSITION');
  });

  test('reimburse from submitted: 422', async () => {
    setupJwtAsAdmin();
    mockRepo.findRequestById.mockResolvedValue(makeRequestRow({ status: 'submitted' }));

    const res = await request(app)
      .post(`/api/v1/mdf/requests/${REQ_ID}/reimburse`)
      .set('Authorization', makeJwt())
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('MDF_INVALID_TRANSITION');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LIST REQUESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Integration: List requests', () => {
  test('GET /mdf/requests returns scoped list (200)', async () => {
    setupJwtAsPartnerAdmin();
    mockRepo.listRequests.mockResolvedValue({ data: [makeRequestRow()], total: 1 });

    const res = await request(app)
      .get('/api/v1/mdf/requests')
      .set('Authorization', makeJwt());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBe(1);
  });
});

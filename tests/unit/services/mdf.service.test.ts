/**
 * Unit tests for MdfService.
 *
 * All external dependencies (mdfRepository, notificationService, db)
 * are fully mocked. No database or network connections are required.
 *
 * Coverage: MDF allocation CRUD, auto-allocate, request lifecycle,
 * claim submission/approval/rejection, reimbursement, state transitions,
 * and org scoping.
 */

// ── Mocks must be declared before any imports ─────────────────────────────────

jest.mock('../../../src/repositories/mdf.repository', () => ({
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

jest.mock('../../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

// Mock db with transaction support
const mockTrx = jest.fn((table: string) => mockTrxChain) as any;
const mockTrxChain: any = {
  where: jest.fn().mockReturnThis(),
  forUpdate: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
};

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockResolvedValue([]),
  first: jest.fn().mockResolvedValue(null),
  increment: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
};
const mockDb = jest.fn(() => mockDbChain) as any;
mockDb.raw = jest.fn();
mockDb.fn = { now: jest.fn(() => new Date()) };
mockDb.transaction = jest.fn(async (cb: (trx: any) => Promise<any>) => {
  return cb(mockTrx);
});

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import mdfService from '../../../src/services/mdf.service';
import mdfRepository from '../../../src/repositories/mdf.repository';
import notificationService from '../../../src/services/notification.service';
import { AppError } from '../../../src/utils/AppError';
import {
  makeJwtPayload,
  ORG_IDS,
  USER_IDS,
  TIER_IDS,
} from '../../fixtures/factories';

const mockRepo = mdfRepository as jest.Mocked<typeof mdfRepository>;
const mockNotif = notificationService as jest.Mocked<typeof notificationService>;

// ── Shared fixture helpers ─────────────────────────────────────────────────────

function makeAllocation(overrides: Record<string, any> = {}) {
  return {
    id: 'alloc-uuid-1',
    organization_id: ORG_IDS.orgA,
    fiscal_year: 2026,
    fiscal_quarter: 1,
    allocated_amount: '50000.00',
    spent_amount: '10000.00',
    remaining_amount: '40000.00',
    notes: null,
    organization_name: 'Org Alpha',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    id: 'req-uuid-1',
    request_number: 'MR-2026-00001',
    allocation_id: 'alloc-uuid-1',
    organization_id: ORG_IDS.orgA,
    submitted_by: USER_IDS.partnerAdminA,
    activity_type: 'event',
    activity_name: 'Partner Summit 2026',
    description: 'Annual partner summit event',
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
    created_at: new Date('2026-03-01T00:00:00Z'),
    updated_at: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

// Org scopes
const partnerScope = { type: 'own' as const, organizationId: ORG_IDS.orgA };
const partnerScopeB = { type: 'own' as const, organizationId: ORG_IDS.orgB };
const cmScope = { type: 'assigned' as const, assignedOrgIds: [ORG_IDS.orgA] };
const adminScope = { type: 'all' as const };

// JWT payloads
const partnerAdminUser = makeJwtPayload({
  sub: USER_IDS.partnerAdminA,
  role: 'partner_admin',
  org_id: ORG_IDS.orgA,
});
const partnerAdminUserB = makeJwtPayload({
  sub: USER_IDS.partnerAdminB,
  role: 'partner_admin',
  org_id: ORG_IDS.orgB,
});
const cmUser = makeJwtPayload({
  sub: USER_IDS.channelManager,
  role: 'channel_manager',
  org_id: null,
  tier_id: null,
});
const adminUser = makeJwtPayload({
  sub: USER_IDS.admin,
  role: 'admin',
  org_id: null,
  tier_id: null,
});

// ── beforeEach: reset all mocks ────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  mockDbChain.first.mockResolvedValue(null);
  mockRepo.createApprovalRequest.mockResolvedValue({ id: 'ar-uuid' } as any);
  mockRepo.updateApprovalRequest.mockResolvedValue(1 as any);
  mockNotif.createNotification.mockResolvedValue({ id: 'notif-uuid' } as any);

  // Default: transaction runs cb with mock trx
  mockDb.transaction.mockImplementation(async (cb: any) => cb(mockTrx));
});

// ═════════════════════════════════════════════════════════════════════════════
// ALLOCATION CRUD
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.createAllocation', () => {
  const validData = {
    organization_id: ORG_IDS.orgA,
    fiscal_year: 2026,
    fiscal_quarter: 1,
    allocated_amount: 50000,
    notes: 'Q1 allocation',
  };

  test('creates allocation with correct data', async () => {
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(null);
    mockRepo.createAllocation.mockResolvedValue(makeAllocation());

    const result = await mdfService.createAllocation(validData, adminUser);

    expect(mockRepo.createAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORG_IDS.orgA,
        fiscal_year: 2026,
        fiscal_quarter: 1,
        allocated_amount: 50000,
        spent_amount: 0,
      }),
    );
    expect(result.id).toBe('alloc-uuid-1');
  });

  test('prevents duplicate allocation for same org+year+quarter: 409 MDF_ALLOCATION_EXISTS', async () => {
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(makeAllocation());

    await expect(
      mdfService.createAllocation(validData, adminUser),
    ).rejects.toMatchObject({ statusCode: 409, code: 'MDF_ALLOCATION_EXISTS' });

    expect(mockRepo.createAllocation).not.toHaveBeenCalled();
  });
});

describe('MdfService.listAllocations', () => {
  test('passes scope, filters, and pagination to repository', async () => {
    mockRepo.listAllocations.mockResolvedValue({ data: [], total: 0 });

    await mdfService.listAllocations(partnerScope, { fiscal_year: 2026 }, { offset: 0, limit: 25 });

    expect(mockRepo.listAllocations).toHaveBeenCalledWith(
      partnerScope,
      { fiscal_year: 2026 },
      { offset: 0, limit: 25 },
      undefined,
    );
  });
});

describe('MdfService.getAllocation', () => {
  test('returns allocation when found', async () => {
    const alloc = makeAllocation();
    mockRepo.findAllocationById.mockResolvedValue(alloc);

    const result = await mdfService.getAllocation('alloc-uuid-1', partnerScope);
    expect(result).toEqual(alloc);
  });

  test('throws 404 when not found', async () => {
    mockRepo.findAllocationById.mockResolvedValue(null);

    await expect(
      mdfService.getAllocation('bad-id', partnerScope),
    ).rejects.toMatchObject({ statusCode: 404, code: 'MDF_ALLOCATION_NOT_FOUND' });
  });
});

describe('MdfService.updateAllocation', () => {
  test('updates allocation amount', async () => {
    mockRepo.findAllocationById.mockResolvedValue(makeAllocation({ spent_amount: '5000.00' }));
    mockRepo.updateAllocation.mockResolvedValue(makeAllocation({ allocated_amount: '60000.00' }));

    const result = await mdfService.updateAllocation('alloc-uuid-1', { allocated_amount: 60000 }, adminScope);

    expect(mockRepo.updateAllocation).toHaveBeenCalledWith('alloc-uuid-1', { allocated_amount: 60000 });
  });

  test('cannot reduce allocation below spent: 422 MDF_ALLOCATION_UNDERFLOW', async () => {
    mockRepo.findAllocationById.mockResolvedValue(makeAllocation({ spent_amount: '20000.00' }));

    await expect(
      mdfService.updateAllocation('alloc-uuid-1', { allocated_amount: 15000 }, adminScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_ALLOCATION_UNDERFLOW' });
  });

  test('returns allocation unchanged when no allowed fields provided', async () => {
    const alloc = makeAllocation();
    mockRepo.findAllocationById.mockResolvedValue(alloc);

    const result = await mdfService.updateAllocation('alloc-uuid-1', { bad_field: 'x' }, adminScope);

    expect(mockRepo.updateAllocation).not.toHaveBeenCalled();
    expect(result).toEqual(alloc);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AUTO-ALLOCATE
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.autoAllocate', () => {
  test('calculates allocation: tier pct x revenue, applies cap', async () => {
    mockRepo.getActiveOrgsWithTier.mockResolvedValue([
      { org_id: ORG_IDS.orgA, org_name: 'Org Alpha', tier_id: TIER_IDS.platinum, tier_name: 'Platinum Innovator', mdf_budget_pct: '5' },
    ]);
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(null);
    mockRepo.getTrailingRevenue.mockResolvedValue(800000);
    mockRepo.getTopPerformerThreshold.mockResolvedValue(1000000); // not top performer
    mockRepo.createAllocation.mockResolvedValue(makeAllocation());

    const result = await mdfService.autoAllocate(2026, 1);

    expect(result.created).toBe(1);
    // 5% of 800000 = 40000, cap is 50000 -> 40000
    expect(mockRepo.createAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        allocated_amount: 40000,
        spent_amount: 0,
      }),
    );
  });

  test('applies tier cap when base exceeds cap', async () => {
    mockRepo.getActiveOrgsWithTier.mockResolvedValue([
      { org_id: ORG_IDS.orgA, org_name: 'Org Alpha', tier_id: TIER_IDS.innovator, tier_name: 'Innovator', mdf_budget_pct: '3' },
    ]);
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(null);
    mockRepo.getTrailingRevenue.mockResolvedValue(500000); // 3% = 15000, but cap is 10000
    mockRepo.getTopPerformerThreshold.mockResolvedValue(1000000);
    mockRepo.createAllocation.mockResolvedValue(makeAllocation());

    const result = await mdfService.autoAllocate(2026, 1);

    expect(mockRepo.createAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        allocated_amount: 10000, // capped at Innovator tier cap
      }),
    );
  });

  test('applies 20% top performer bonus within cap', async () => {
    mockRepo.getActiveOrgsWithTier.mockResolvedValue([
      { org_id: ORG_IDS.orgA, org_name: 'Org Alpha', tier_id: TIER_IDS.platinum, tier_name: 'Platinum Innovator', mdf_budget_pct: '5' },
    ]);
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(null);
    mockRepo.getTrailingRevenue.mockResolvedValue(600000); // 5% = 30000
    mockRepo.getTopPerformerThreshold.mockResolvedValue(500000); // IS top performer (600k >= 500k)
    mockRepo.createAllocation.mockResolvedValue(makeAllocation());

    await mdfService.autoAllocate(2026, 1);

    // 30000 * 1.2 = 36000, cap is 50000 -> 36000
    expect(mockRepo.createAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        allocated_amount: 36000,
      }),
    );
  });

  test('handles zero revenue: skips org', async () => {
    mockRepo.getActiveOrgsWithTier.mockResolvedValue([
      { org_id: ORG_IDS.orgA, org_name: 'Org Alpha', tier_id: TIER_IDS.platinum, tier_name: 'Platinum Innovator', mdf_budget_pct: '5' },
    ]);
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(null);
    mockRepo.getTrailingRevenue.mockResolvedValue(0);

    const result = await mdfService.autoAllocate(2026, 1);

    expect(result.skipped_no_revenue).toBe(1);
    expect(result.created).toBe(0);
    expect(mockRepo.createAllocation).not.toHaveBeenCalled();
  });

  test('skips orgs with no MDF tier eligibility (0% budget or Registered tier)', async () => {
    mockRepo.getActiveOrgsWithTier.mockResolvedValue([
      { org_id: ORG_IDS.orgA, org_name: 'Org Alpha', tier_id: TIER_IDS.registered, tier_name: 'Registered', mdf_budget_pct: '2' },
    ]);

    const result = await mdfService.autoAllocate(2026, 1);

    // MDF_TIER_CAPS['Registered'] = 0, so skipped
    expect(result.skipped_no_mdf_tier).toBe(1);
    expect(result.created).toBe(0);
  });

  test('skips orgs with existing allocation', async () => {
    mockRepo.getActiveOrgsWithTier.mockResolvedValue([
      { org_id: ORG_IDS.orgA, org_name: 'Org Alpha', tier_id: TIER_IDS.platinum, tier_name: 'Platinum Innovator', mdf_budget_pct: '5' },
    ]);
    mockRepo.findAllocationByOrgQuarter.mockResolvedValue(makeAllocation());

    const result = await mdfService.autoAllocate(2026, 1);

    expect(result.skipped_existing).toBe(1);
    expect(result.created).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REQUEST CREATION
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.createRequest', () => {
  const validPayload = {
    allocation_id: 'alloc-uuid-1',
    activity_type: 'event',
    activity_name: 'Partner Summit',
    description: 'Annual event',
    start_date: '2026-05-01',
    end_date: '2026-05-03',
    requested_amount: 15000,
  };

  test('creates request in draft status', async () => {
    mockRepo.findAllocationById.mockResolvedValue(makeAllocation());
    mockRepo.createRequest.mockResolvedValue(makeRequest());

    const result = await mdfService.createRequest(validPayload, partnerAdminUser);

    expect(mockRepo.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        allocation_id: 'alloc-uuid-1',
        organization_id: ORG_IDS.orgA,
        submitted_by: USER_IDS.partnerAdminA,
        status: 'draft',
        requested_amount: 15000,
      }),
    );
    expect(result.status).toBe('draft');
  });

  test('throws 403 when user has no org_id', async () => {
    await expect(
      mdfService.createRequest(validPayload, { ...partnerAdminUser, org_id: null }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_ORG_MISMATCH' });
  });

  test('throws 404 when allocation not found', async () => {
    mockRepo.findAllocationById.mockResolvedValue(null);

    await expect(
      mdfService.createRequest(validPayload, partnerAdminUser),
    ).rejects.toMatchObject({ statusCode: 404, code: 'MDF_ALLOCATION_NOT_FOUND' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMIT REQUEST
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.submitRequest', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureStr = futureDate.toISOString().slice(0, 10);

  beforeEach(() => {
    const req = makeRequest({
      status: 'draft',
      start_date: futureStr,
      requested_amount: '15000.00',
    });
    mockRepo.findRequestById.mockResolvedValue(req);

    // Transaction mock: findAllocationForUpdate returns allocation
    mockRepo.findAllocationForUpdate.mockResolvedValue({
      id: 'alloc-uuid-1',
      allocated_amount: '50000.00',
      spent_amount: '10000.00',
      remaining_amount: '40000.00',
    });

    mockRepo.updateRequestStatusTrx.mockResolvedValue({
      ...req,
      status: 'submitted',
      updated_at: new Date(),
    });

    // findApprover: org has CM
    mockDb.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: USER_IDS.channelManager }
          : { id: USER_IDS.admin },
      ),
    }));
  });

  test('draft -> submitted transition, creates approval request and notifies CM', async () => {
    const result = await mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope);

    expect(result.status).toBe('submitted');
    expect(mockRepo.createApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'mdf_request',
        entity_id: 'req-uuid-1',
        assigned_to: USER_IDS.channelManager,
      }),
    );
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.channelManager,
        type: 'mdf_update',
      }),
    );
  });

  test('validates amount vs remaining allocation: 422 MDF_INSUFFICIENT_FUNDS', async () => {
    mockRepo.findAllocationForUpdate.mockResolvedValue({
      id: 'alloc-uuid-1',
      allocated_amount: '50000.00',
      spent_amount: '48000.00',
      remaining_amount: '2000.00',
    });

    await expect(
      mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_INSUFFICIENT_FUNDS' });
  });

  test('validates 50% single request cap: 422 MDF_REQUEST_EXCEEDS_CAP', async () => {
    const req = makeRequest({
      status: 'draft',
      start_date: futureStr,
      requested_amount: '30000.00', // > 50% of 50000
    });
    mockRepo.findRequestById.mockResolvedValue(req);

    await expect(
      mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_REQUEST_EXCEEDS_CAP' });
  });

  test('validates 14-day lead time: 422 MDF_ACTIVITY_TOO_SOON', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const req = makeRequest({
      status: 'draft',
      start_date: tomorrow.toISOString().slice(0, 10),
      requested_amount: '15000.00',
    });
    mockRepo.findRequestById.mockResolvedValue(req);

    await expect(
      mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_ACTIVITY_TOO_SOON' });
  });

  test('only submitter can submit: 403 for different user', async () => {
    const req = makeRequest({
      status: 'draft',
      start_date: futureStr,
      submitted_by: 'other-user-uuid',
    });
    mockRepo.findRequestById.mockResolvedValue(req);

    await expect(
      mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_INSUFFICIENT_ROLE' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// APPROVE REQUEST
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.approveRequest', () => {
  beforeEach(() => {
    const req = makeRequest({ status: 'submitted', requested_amount: '15000.00' });
    mockRepo.findRequestById.mockResolvedValue(req);
    mockRepo.findAllocationForUpdate.mockResolvedValue({
      id: 'alloc-uuid-1',
      allocated_amount: '50000.00',
      spent_amount: '10000.00',
      remaining_amount: '40000.00',
    });
    mockRepo.adjustSpentAmount.mockResolvedValue(makeAllocation({ spent_amount: '25000.00' }));
    mockRepo.updateRequestStatusTrx.mockResolvedValue({
      status: 'approved',
      approved_amount: 15000,
      reviewed_by: USER_IDS.channelManager,
      reviewed_at: new Date(),
      updated_at: new Date(),
    });
  });

  test('sets approved_amount, reserves funds, notifies submitter', async () => {
    const result = await mdfService.approveRequest(
      'req-uuid-1',
      { approved_amount: 15000 },
      cmUser,
      cmScope,
    );

    expect(result.status).toBe('approved');
    expect(result.approved_amount).toBe(15000);
    expect(mockRepo.adjustSpentAmount).toHaveBeenCalledWith('alloc-uuid-1', 15000, mockTrx);
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.partnerAdminA,
        type: 'mdf_update',
        title: expect.stringContaining('Approved'),
      }),
    );
  });

  test('defaults approved_amount to requested_amount when not provided', async () => {
    const result = await mdfService.approveRequest(
      'req-uuid-1',
      {},
      cmUser,
      cmScope,
    );

    expect(result.approved_amount).toBe(15000);
  });

  test('validates sufficient remaining allocation: 422 MDF_INSUFFICIENT_FUNDS', async () => {
    mockRepo.findAllocationForUpdate.mockResolvedValue({
      id: 'alloc-uuid-1',
      allocated_amount: '50000.00',
      spent_amount: '48000.00',
      remaining_amount: '2000.00',
    });

    await expect(
      mdfService.approveRequest('req-uuid-1', { approved_amount: 15000 }, cmUser, cmScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_INSUFFICIENT_FUNDS' });
  });

  test('approved_amount cannot exceed requested_amount: 422', async () => {
    await expect(
      mdfService.approveRequest('req-uuid-1', { approved_amount: 20000 }, cmUser, cmScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_AMOUNT_EXCEEDS_REQUESTED' });
  });

  test('approved_amount must be > 0: 400 MDF_INVALID_AMOUNT', async () => {
    await expect(
      mdfService.approveRequest('req-uuid-1', { approved_amount: 0 }, cmUser, cmScope),
    ).rejects.toMatchObject({ statusCode: 400, code: 'MDF_INVALID_AMOUNT' });
  });

  test('partial approval sets title containing "Partially Approved"', async () => {
    mockRepo.updateRequestStatusTrx.mockResolvedValue({
      status: 'approved',
      approved_amount: 10000,
      reviewed_at: new Date(),
      updated_at: new Date(),
    });

    await mdfService.approveRequest('req-uuid-1', { approved_amount: 10000 }, cmUser, cmScope);

    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Partially Approved'),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REJECT REQUEST
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.rejectRequest', () => {
  test('sets reason, correct status transition, notifies submitter', async () => {
    mockRepo.findRequestById.mockResolvedValue(makeRequest({ status: 'submitted' }));
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'rejected',
      rejection_reason: 'Budget constraints',
      updated_at: new Date(),
    });

    const result = await mdfService.rejectRequest(
      'req-uuid-1',
      { rejection_reason: 'Budget constraints' },
      cmUser,
      cmScope,
    );

    expect(result.status).toBe('rejected');
    expect(result.rejection_reason).toBe('Budget constraints');
    expect(mockRepo.updateApprovalRequest).toHaveBeenCalledWith(
      'mdf_request', 'req-uuid-1', 'reject', 'Budget constraints',
    );
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.partnerAdminA,
        title: expect.stringContaining('Rejected'),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// COMPLETE ACTIVITY
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.completeActivity', () => {
  test('approved -> completed transition, notifies about claim window', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'approved', end_date: '2026-05-03' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'completed',
      updated_at: new Date(),
    });

    const result = await mdfService.completeActivity('req-uuid-1', partnerAdminUser, partnerScope);

    expect(result.status).toBe('completed');
    expect(result.claim_deadline).toBe('2026-07-02'); // 2026-05-03 + 60 days
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.partnerAdminA,
        body: expect.stringContaining('2026-07-02'),
      }),
    );
  });

  test('only submitter can mark complete: 403', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'approved', submitted_by: 'other-user-uuid' }),
    );

    await expect(
      mdfService.completeActivity('req-uuid-1', partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMIT CLAIM
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.submitClaim', () => {
  const claimBody = {
    claim_amount: 12000,
    claim_notes: 'Event completed successfully',
    proof_of_execution: ['https://s3.example.com/proof1.pdf'],
  };

  beforeEach(() => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 10); // activity ended 10 days ago (within 60 days)
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({
        status: 'completed',
        approved_amount: '15000.00',
        end_date: endDate.toISOString().slice(0, 10),
      }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_submitted',
      updated_at: new Date(),
    });

    // findApprover
    mockDb.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: USER_IDS.channelManager }
          : { id: USER_IDS.admin },
      ),
    }));
  });

  test('validates amount <= approved, within 60 days, requires proof', async () => {
    const result = await mdfService.submitClaim('req-uuid-1', claimBody, partnerAdminUser, partnerScope);

    expect(result.status).toBe('claim_submitted');
    expect(result.claim_amount).toBe(12000);
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.channelManager,
      }),
    );
  });

  test('claim amount > approved: 422 MDF_CLAIM_EXCEEDS_APPROVED', async () => {
    await expect(
      mdfService.submitClaim('req-uuid-1', { ...claimBody, claim_amount: 20000 }, partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_CLAIM_EXCEEDS_APPROVED' });
  });

  test('60-day deadline passed: 422 MDF_DEADLINE_PASSED', async () => {
    const oldEnd = new Date();
    oldEnd.setDate(oldEnd.getDate() - 90); // 90 days ago, well past 60-day deadline
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({
        status: 'completed',
        approved_amount: '15000.00',
        end_date: oldEnd.toISOString().slice(0, 10),
      }),
    );

    await expect(
      mdfService.submitClaim('req-uuid-1', claimBody, partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_DEADLINE_PASSED' });
  });

  test('missing proof_of_execution: 422 MDF_PROOF_REQUIRED', async () => {
    await expect(
      mdfService.submitClaim('req-uuid-1', { ...claimBody, proof_of_execution: [] }, partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_PROOF_REQUIRED' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// APPROVE CLAIM
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.approveClaim', () => {
  test('claim_submitted -> claim_approved, notifies submitter', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'claim_submitted', claim_amount: '12000.00' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_approved',
      updated_at: new Date(),
    });

    const result = await mdfService.approveClaim(
      'req-uuid-1',
      { reimbursement_amount: 12000 },
      cmUser,
      cmScope,
    );

    expect(result.status).toBe('claim_approved');
    expect(result.reimbursement_amount).toBe(12000);
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Claim Approved'),
      }),
    );
  });

  test('defaults reimbursement_amount to claim_amount', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'claim_submitted', claim_amount: '12000.00' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_approved',
      updated_at: new Date(),
    });

    const result = await mdfService.approveClaim('req-uuid-1', {}, cmUser, cmScope);

    expect(result.reimbursement_amount).toBe(12000);
  });

  test('reimbursement_amount <= 0: 400 MDF_INVALID_AMOUNT', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'claim_submitted', claim_amount: '12000.00' }),
    );

    await expect(
      mdfService.approveClaim('req-uuid-1', { reimbursement_amount: 0 }, cmUser, cmScope),
    ).rejects.toMatchObject({ statusCode: 400, code: 'MDF_INVALID_AMOUNT' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REJECT CLAIM
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.rejectClaim', () => {
  test('claim_submitted -> claim_rejected, notifies submitter', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'claim_submitted' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_rejected',
      updated_at: new Date(),
    });

    const result = await mdfService.rejectClaim(
      'req-uuid-1',
      { rejection_reason: 'Insufficient proof' },
      cmUser,
      cmScope,
    );

    expect(result.status).toBe('claim_rejected');
    expect(result.rejection_reason).toBe('Insufficient proof');
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Claim Rejected'),
        body: expect.stringContaining('Insufficient proof'),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MARK REIMBURSED
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.markReimbursed', () => {
  test('claim_approved -> reimbursed, notifies submitter with amount', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'claim_approved', reimbursement_amount: '12000.00' }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'reimbursed',
      reimbursed_at: new Date(),
      updated_at: new Date(),
    });

    const result = await mdfService.markReimbursed('req-uuid-1', {}, adminUser, adminScope);

    expect(result.status).toBe('reimbursed');
    expect(result.reimbursement_amount).toBe(12000);
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.partnerAdminA,
        title: expect.stringContaining('Reimbursement'),
      }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// INVALID TRANSITIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService — invalid status transitions', () => {
  test.each([
    ['draft', 'approved'],
    ['draft', 'rejected'],
    ['draft', 'completed'],
    ['draft', 'claim_submitted'],
    ['submitted', 'completed'],
    ['submitted', 'claim_submitted'],
    ['approved', 'submitted'],
    ['approved', 'rejected'],
    ['rejected', 'approved'],
    ['rejected', 'completed'],
    ['completed', 'approved'],
    ['completed', 'rejected'],
    ['claim_submitted', 'completed'],
    ['claim_submitted', 'submitted'],
    ['claim_approved', 'claim_submitted'],
    ['reimbursed', 'claim_approved'],
  ])(
    '%s -> %s is invalid: 422 MDF_INVALID_TRANSITION',
    async (fromStatus, toStatus) => {
      const req = makeRequest({ status: fromStatus });
      mockRepo.findRequestById.mockResolvedValue(req);

      let action: Promise<any>;
      if (toStatus === 'submitted') {
        action = mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope);
      } else if (toStatus === 'approved') {
        // Set up transaction mocks for approve
        mockRepo.findAllocationForUpdate.mockResolvedValue(makeAllocation());
        mockRepo.adjustSpentAmount.mockResolvedValue(makeAllocation());
        mockRepo.updateRequestStatusTrx.mockResolvedValue(null);
        action = mdfService.approveRequest('req-uuid-1', {}, cmUser, cmScope);
      } else if (toStatus === 'rejected') {
        action = mdfService.rejectRequest('req-uuid-1', { rejection_reason: 'test' }, cmUser, cmScope);
      } else if (toStatus === 'completed') {
        action = mdfService.completeActivity('req-uuid-1', partnerAdminUser, partnerScope);
      } else if (toStatus === 'claim_submitted') {
        action = mdfService.submitClaim(
          'req-uuid-1',
          { claim_amount: 100, proof_of_execution: ['https://proof.com/1.pdf'] },
          partnerAdminUser,
          partnerScope,
        );
      } else if (toStatus === 'claim_approved') {
        action = mdfService.approveClaim('req-uuid-1', {}, cmUser, cmScope);
      } else if (toStatus === 'reimbursed') {
        action = mdfService.markReimbursed('req-uuid-1', {}, adminUser, adminScope);
      } else {
        return;
      }

      const err = await action.catch((e: any) => e);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('MDF_INVALID_TRANSITION');
    },
  );

  test('cannot submit already-approved request: 422 MDF_INVALID_TRANSITION', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'approved' }),
    );

    await expect(
      mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_INVALID_TRANSITION' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ORG SCOPING
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService — org scoping', () => {
  test('partner cannot access other org allocation: 404', async () => {
    mockRepo.findAllocationById.mockResolvedValue(null);

    await expect(
      mdfService.getAllocation('alloc-from-orgB', partnerScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('partner cannot access other org request: 404', async () => {
    mockRepo.findRequestById.mockResolvedValue(null);

    await expect(
      mdfService.getRequest('req-from-orgB', partnerScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('listRequests passes scope to repository', async () => {
    mockRepo.listRequests.mockResolvedValue({ data: [], total: 0 });

    await mdfService.listRequests(partnerScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.listRequests).toHaveBeenCalledWith(
      partnerScope,
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE REQUEST
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService.updateRequest', () => {
  test('updates draft request fields', async () => {
    const req = makeRequest({ status: 'draft' });
    mockRepo.findRequestById.mockResolvedValue(req);
    mockRepo.updateRequestFields.mockResolvedValue({ ...req, activity_name: 'Updated Event' });

    const result = await mdfService.updateRequest(
      'req-uuid-1',
      { activity_name: 'Updated Event' },
      partnerAdminUser,
      partnerScope,
    );

    expect(mockRepo.updateRequestFields).toHaveBeenCalledWith('req-uuid-1', { activity_name: 'Updated Event' });
  });

  test('cannot edit submitted request: 422 MDF_NOT_EDITABLE', async () => {
    mockRepo.findRequestById.mockResolvedValue(makeRequest({ status: 'submitted' }));

    await expect(
      mdfService.updateRequest('req-uuid-1', { activity_name: 'x' }, partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'MDF_NOT_EDITABLE' });
  });

  test('only submitter can edit: 403', async () => {
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({ status: 'draft', submitted_by: 'other-user-uuid' }),
    );

    await expect(
      mdfService.updateRequest('req-uuid-1', { activity_name: 'x' }, partnerAdminUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_INSUFFICIENT_ROLE' });
  });

  test('rejected request can be edited', async () => {
    const req = makeRequest({ status: 'rejected' });
    mockRepo.findRequestById.mockResolvedValue(req);
    mockRepo.updateRequestFields.mockResolvedValue(req);

    await expect(
      mdfService.updateRequest('req-uuid-1', { activity_name: 'Updated' }, partnerAdminUser, partnerScope),
    ).resolves.toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM RESUBMISSION (from claim_rejected)
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService — claim resubmission from claim_rejected', () => {
  test('claim_rejected -> claim_submitted is a valid transition', async () => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 10);
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({
        status: 'claim_rejected',
        approved_amount: '15000.00',
        end_date: endDate.toISOString().slice(0, 10),
      }),
    );
    mockRepo.updateRequestStatus.mockResolvedValue({
      status: 'claim_submitted',
      updated_at: new Date(),
    });
    mockDb.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: USER_IDS.channelManager }
          : null,
      ),
    }));

    const result = await mdfService.submitClaim(
      'req-uuid-1',
      {
        claim_amount: 12000,
        proof_of_execution: ['https://proof.com/updated.pdf'],
      },
      partnerAdminUser,
      partnerScope,
    );

    expect(result.status).toBe('claim_submitted');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// RESUBMIT FROM REJECTED
// ═════════════════════════════════════════════════════════════════════════════

describe('MdfService — resubmit from rejected', () => {
  test('rejected -> submitted is a valid transition', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    mockRepo.findRequestById.mockResolvedValue(
      makeRequest({
        status: 'rejected',
        start_date: futureDate.toISOString().slice(0, 10),
        requested_amount: '10000.00',
      }),
    );
    mockRepo.findAllocationForUpdate.mockResolvedValue({
      id: 'alloc-uuid-1',
      allocated_amount: '50000.00',
      spent_amount: '10000.00',
      remaining_amount: '40000.00',
    });
    mockRepo.updateRequestStatusTrx.mockResolvedValue({
      status: 'submitted',
      updated_at: new Date(),
    });
    mockDb.mockImplementation((table: string) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: USER_IDS.channelManager }
          : null,
      ),
    }));

    const result = await mdfService.submitRequest('req-uuid-1', partnerAdminUser, partnerScope);
    expect(result.status).toBe('submitted');
  });
});

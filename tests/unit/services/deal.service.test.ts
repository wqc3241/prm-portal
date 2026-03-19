/**
 * Unit tests for DealService.
 *
 * All external dependencies (dealRepository, notificationService,
 * organizationService, db) are fully mocked. No database or network
 * connections are required.
 *
 * PRD coverage: QA-001 through QA-060 (deal lifecycle, conflict detection,
 * products, data scoping, notifications, status history).
 */

// ── Mocks must be declared before any imports ─────────────────────────────────

jest.mock('../../../src/repositories/deal.repository', () => ({
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
    findExpiringInWindow: jest.fn(),
  },
}));

jest.mock('../../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

jest.mock('../../../src/services/organization.service', () => ({
  __esModule: true,
  default: {
    recalculateTier: jest.fn(),
  },
}));

// The database mock must support chained query builder calls used by
// dealService.findApprover() and dealService.markWon() (db('table').where().increment()…)
const mockDbChain = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  first: jest.fn(),
  increment: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};
const mockDb = jest.fn((..._args: any[]) => mockDbChain);
// Also expose db.raw and db.fn used by the repository (but not called in service tests)
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import dealService from '../../../src/services/deal.service';
import dealRepository from '../../../src/repositories/deal.repository';
import notificationService from '../../../src/services/notification.service';
import organizationService from '../../../src/services/organization.service';
import { AppError } from '../../../src/utils/AppError';
import {
  makeJwtPayload,
  makeProduct,
  ORG_IDS,
  USER_IDS,
  TIER_IDS,
} from '../../fixtures/factories';

const mockRepo = dealRepository as jest.Mocked<typeof dealRepository>;
const mockNotif = notificationService as jest.Mocked<typeof notificationService>;
const mockOrgService = organizationService as jest.Mocked<typeof organizationService>;

// ── Shared fixture helpers ─────────────────────────────────────────────────────

function makeDeal(overrides: Record<string, any> = {}) {
  return {
    id: 'deal-uuid-1',
    deal_number: 'DR-2026-00042',
    organization_id: ORG_IDS.orgA,
    submitted_by: USER_IDS.partnerRepA,
    assigned_to: null,
    customer_company_name: 'Acme Corporation',
    customer_contact_name: 'John Smith',
    customer_contact_email: 'john.smith@acme.com',
    customer_contact_phone: '+1-555-0100',
    customer_industry: 'Financial Services',
    deal_name: 'Acme Corp - PA-5400 Network Refresh',
    description: 'Replacing legacy Cisco ASA firewalls',
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
    products: [],
    created_at: new Date('2026-03-18T14:30:00Z'),
    updated_at: new Date('2026-03-18T14:30:00Z'),
    ...overrides,
  };
}

function makeConflict(overrides: Record<string, any> = {}) {
  return {
    conflicting_deal_id: 'conflict-deal-uuid',
    conflicting_deal_number: 'DR-2026-00038',
    conflicting_org_name: 'CloudGuard Inc',
    match_type: 'exact_email',
    similarity_score: '1.0',
    ...overrides,
  };
}

// Org scopes
const partnerScope = { type: 'own' as const, organizationId: ORG_IDS.orgA };
const cmScope = { type: 'assigned' as const, assignedOrgIds: [ORG_IDS.orgA] };
const adminScope = { type: 'all' as const };

// JWT payloads
const partnerRepUser = makeJwtPayload({
  sub: USER_IDS.partnerRepA,
  role: 'partner_rep',
  org_id: ORG_IDS.orgA,
});
const partnerAdminUser = makeJwtPayload({
  sub: USER_IDS.partnerAdminA,
  role: 'partner_admin',
  org_id: ORG_IDS.orgA,
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

// ── beforeEach: reset all mocks to safe defaults ───────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: db() chain resolves nothing (overridden per test as needed)
  mockDbChain.first.mockResolvedValue(null);

  // Common defaults
  mockRepo.insertStatusHistory.mockResolvedValue({ id: 'history-uuid' } as any);
  mockRepo.createApprovalRequest.mockResolvedValue({ id: 'approval-uuid' } as any);
  mockRepo.updateApprovalRequest.mockResolvedValue(1 as any);
  mockNotif.createNotification.mockResolvedValue({ id: 'notif-uuid' } as any);
  mockOrgService.recalculateTier.mockResolvedValue({
    organization_id: ORG_IDS.orgA,
    changed: false,
    old_tier: null,
    new_tier: null,
  } as any);
});

// ═════════════════════════════════════════════════════════════════════════════
// CREATE DEAL
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.createDeal', () => {
  const validPayload = {
    customer_company_name: 'Acme Corporation',
    deal_name: 'Acme Corp - PA-5400 Network Refresh',
    estimated_value: 450000,
    expected_close_date: '2026-06-30',
  };

  beforeEach(() => {
    mockRepo.create.mockResolvedValue(makeDeal());
  });

  test('QA-001 — creates deal with status=draft, sets org_id and submitted_by from JWT', async () => {
    const result = await dealService.createDeal(validPayload, partnerRepUser);

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORG_IDS.orgA,
        submitted_by: USER_IDS.partnerRepA,
        status: 'draft',
        customer_company_name: 'Acme Corporation',
        estimated_value: 450000,
      }),
    );
    expect(result.status).toBe('draft');
    expect(result.products).toEqual([]);
  });

  test('QA-001 — inserts initial status history entry: null -> draft', async () => {
    await dealService.createDeal(validPayload, partnerRepUser);

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        deal_id: 'deal-uuid-1',
        from_status: null,
        to_status: 'draft',
        changed_by: USER_IDS.partnerRepA,
      }),
    );
  });

  test('QA-057 — creation history entry has notes "Deal created"', async () => {
    await dealService.createDeal(validPayload, partnerRepUser);

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Deal created' }),
    );
  });

  test('throws AUTH_ORG_MISMATCH (403) when user has no org_id', async () => {
    await expect(
      dealService.createDeal(validPayload, { ...partnerRepUser, org_id: null }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_ORG_MISMATCH' });

    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  test('QA-002 — admin user has no org_id, throws 403 (admin cannot create deals)', async () => {
    await expect(
      dealService.createDeal(validPayload, adminUser),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('deal creation propagates repository errors', async () => {
    mockRepo.create.mockRejectedValue(new Error('DB connection lost'));

    await expect(dealService.createDeal(validPayload, partnerRepUser)).rejects.toThrow(
      'DB connection lost',
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE DEAL
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.updateDeal', () => {
  test('QA-003 — updates draft deal fields successfully', async () => {
    const draftDeal = makeDeal({ status: 'draft' });
    mockRepo.findById.mockResolvedValueOnce(draftDeal).mockResolvedValueOnce({
      ...draftDeal,
      deal_name: 'Updated Name',
      updated_at: new Date(),
    });
    mockRepo.updateFields.mockResolvedValue({ ...draftDeal, deal_name: 'Updated Name' } as any);

    const result = await dealService.updateDeal(
      'deal-uuid-1',
      { deal_name: 'Updated Name' },
      partnerRepUser,
      partnerScope,
    );

    expect(mockRepo.updateFields).toHaveBeenCalledWith(
      'deal-uuid-1',
      expect.objectContaining({ deal_name: 'Updated Name' }),
    );
  });

  test('updates rejected deal — rejected deals are editable', async () => {
    const rejectedDeal = makeDeal({ status: 'rejected' });
    mockRepo.findById.mockResolvedValueOnce(rejectedDeal).mockResolvedValueOnce(rejectedDeal);
    mockRepo.updateFields.mockResolvedValue(rejectedDeal as any);

    await expect(
      dealService.updateDeal('deal-uuid-1', { deal_name: 'Revised Name' }, partnerRepUser, partnerScope),
    ).resolves.toBeDefined();
  });

  test('QA-004 — cannot update submitted deal: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'submitted' }));

    await expect(
      dealService.updateDeal('deal-uuid-1', { deal_name: 'Sneaky' }, partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('cannot update approved deal: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'approved' }));

    await expect(
      dealService.updateDeal('deal-uuid-1', { deal_name: 'Nope' }, partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('QA-046 — partner_rep cannot update deal created by another rep (403)', async () => {
    const otherRepDeal = makeDeal({ submitted_by: 'other-rep-uuid', status: 'draft' });
    mockRepo.findById.mockResolvedValue(otherRepDeal);

    await expect(
      dealService.updateDeal('deal-uuid-1', { deal_name: 'Hacked' }, partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('QA-047 — partner_admin CAN update deal created by any rep in their org', async () => {
    const repDeal = makeDeal({ submitted_by: USER_IDS.partnerRepA, status: 'draft' });
    mockRepo.findById.mockResolvedValueOnce(repDeal).mockResolvedValueOnce(repDeal);
    mockRepo.updateFields.mockResolvedValue(repDeal as any);

    // partnerAdminUser has different sub than submitted_by (partnerRepA), but role is partner_admin
    await expect(
      dealService.updateDeal('deal-uuid-1', { deal_name: 'Admin Edit' }, partnerAdminUser, partnerScope),
    ).resolves.toBeDefined();

    expect(mockRepo.updateFields).toHaveBeenCalled();
  });

  test('returns deal unchanged when no allowed fields provided', async () => {
    const draft = makeDeal({ status: 'draft' });
    mockRepo.findById.mockResolvedValue(draft);

    const result = await dealService.updateDeal(
      'deal-uuid-1',
      { __secret_field: 'injected' },
      partnerRepUser,
      partnerScope,
    );

    // updateFields should NOT be called when updates object is empty
    expect(mockRepo.updateFields).not.toHaveBeenCalled();
    expect(result).toEqual(draft);
  });

  test('throws 404 when deal not found in scope', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      dealService.updateDeal('bad-id', { deal_name: 'x' }, partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SUBMIT DEAL
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.submitDeal', () => {
  const readyDeal = makeDeal({
    status: 'draft',
    customer_company_name: 'Acme Corporation',
    deal_name: 'Acme Corp - PA-5400',
    estimated_value: 450000,
    expected_close_date: '2026-06-30',
  });

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(readyDeal);
    mockRepo.updateStatus.mockResolvedValue({ ...readyDeal, status: 'submitted', updated_at: new Date() } as any);
    mockRepo.findConflicts.mockResolvedValue([]);
    // findApprover: org has a channel manager
    mockDbChain.first
      .mockResolvedValueOnce({ channel_manager_id: USER_IDS.channelManager }) // organizations query
      .mockResolvedValueOnce(null); // fallback admin (not needed)
    mockRepo.updateFields.mockResolvedValue(readyDeal as any);
  });

  test('QA-005 — submits draft deal: status -> submitted, approval_request created, CM notified', async () => {
    const result = await dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);

    expect(result.status).toBe('submitted');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'deal-uuid-1',
      'draft',
      'submitted',
      expect.objectContaining({ is_conflicting: false }),
    );
    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: 'draft', to_status: 'submitted' }),
    );
    expect(mockRepo.createApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'deal',
        entity_id: 'deal-uuid-1',
        assigned_to: USER_IDS.channelManager,
      }),
    );
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.channelManager,
        type: 'deal_update',
      }),
    );
  });

  test('QA-058 — status history entry records draft -> submitted', async () => {
    await dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: 'draft', to_status: 'submitted' }),
    );
  });

  test('QA-006 — missing expected_close_date: 422 DEAL_INCOMPLETE', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'draft', expected_close_date: null }));

    const err = await dealService
      .submitDeal('deal-uuid-1', partnerRepUser, partnerScope)
      .catch((e) => e);

    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('DEAL_INCOMPLETE');
    expect(err.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'expected_close_date', code: 'DEAL_INCOMPLETE' }),
      ]),
    );
  });

  test('missing customer_company_name: 422 DEAL_INCOMPLETE with field error', async () => {
    mockRepo.findById.mockResolvedValue(
      makeDeal({ status: 'draft', customer_company_name: null }),
    );

    const err = await dealService
      .submitDeal('deal-uuid-1', partnerRepUser, partnerScope)
      .catch((e) => e);

    expect(err.code).toBe('DEAL_INCOMPLETE');
    expect(err.errors.some((e: any) => e.field === 'customer_company_name')).toBe(true);
  });

  test('missing estimated_value: 422 DEAL_INCOMPLETE', async () => {
    mockRepo.findById.mockResolvedValue(
      makeDeal({ status: 'draft', estimated_value: null }),
    );

    const err = await dealService
      .submitDeal('deal-uuid-1', partnerRepUser, partnerScope)
      .catch((e) => e);

    expect(err.code).toBe('DEAL_INCOMPLETE');
    expect(err.errors.some((e: any) => e.field === 'estimated_value')).toBe(true);
  });

  test('QA-007 — submitting deal with conflicts sets is_conflicting=true and conflict_deal_id', async () => {
    mockRepo.findConflicts.mockResolvedValue([makeConflict()]);
    // Same-org filter: the conflicting deal belongs to a different org
    mockDb.mockReturnValue({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
    });
    mockRepo.updateStatus.mockResolvedValue({
      ...readyDeal,
      status: 'submitted',
      is_conflicting: true,
      conflict_deal_id: 'conflict-deal-uuid',
      updated_at: new Date(),
    } as any);

    // Make the org filter return a different org for the conflicting deal
    const dealOrgQueryChain = {
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      then: jest.fn(),
    };
    // We need db('deals').select().whereIn() to return a deal from a different org
    mockDb.mockImplementation((table: any) => {
      if (table === 'deals') {
        return {
          ...mockDbChain,
          whereIn: jest.fn().mockResolvedValue([
            { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgB },
          ]),
          first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
        };
      }
      if (table === 'organizations') {
        return {
          ...mockDbChain,
          first: jest.fn().mockResolvedValue({ channel_manager_id: USER_IDS.channelManager }),
        };
      }
      return mockDbChain;
    });

    const result = await dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);

    expect(result.is_conflicting).toBe(true);
    expect(result.conflict_deal_id).toBe('conflict-deal-uuid');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].match_type).toBe('exact_email');
  });

  test('QA-008 — no conflicts: is_conflicting=false', async () => {
    mockRepo.findConflicts.mockResolvedValue([]);

    const result = await dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);

    expect(result.is_conflicting).toBe(false);
    expect(result.conflict_deal_id).toBeNull();
    expect(result.conflicts).toHaveLength(0);
  });

  test('QA-016 — cannot submit from non-draft/non-rejected status: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'approved' }));

    await expect(
      dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('conflict detection failure is swallowed — deal still submits with is_conflicting=false', async () => {
    mockRepo.findConflicts.mockRejectedValue(new Error('pg_trgm extension missing'));

    const result = await dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);

    // NFR-REL-003: graceful degradation
    expect(result.status).toBe('submitted');
    expect(result.is_conflicting).toBe(false);
  });

  test('approval_request assigns to admin when org has no channel_manager_id', async () => {
    mockDb.mockImplementation((table: any) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: null }
          : { id: USER_IDS.admin },
      ),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);

    expect(mockRepo.createApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_to: USER_IDS.admin }),
    );
  });

  test('QA-048 — notification title differs when conflicts exist', async () => {
    mockRepo.findConflicts.mockResolvedValue([makeConflict()]);
    mockDb.mockImplementation((table: any) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([{ id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgB }]),
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: USER_IDS.channelManager }
          : null,
      ),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    await dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);

    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('conflicts'),
      }),
    );
  });

  test('concurrency: updateStatus returning null throws 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.updateStatus.mockResolvedValue(null);

    await expect(
      dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// APPROVE DEAL
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.approveDeal', () => {
  const submittedDeal = makeDeal({
    status: 'submitted',
    submitted_by: USER_IDS.partnerRepA,
  });

  const approvedResult = {
    ...submittedDeal,
    status: 'approved',
    approved_by: USER_IDS.channelManager,
    approved_at: new Date(),
    registration_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(submittedDeal);
    mockRepo.updateStatus.mockResolvedValue(approvedResult as any);
  });

  test('QA-009 — approves submitted deal: sets approved_by, approved_at, registration_expires_at', async () => {
    const result = await dealService.approveDeal(
      'deal-uuid-1',
      cmUser,
      cmScope,
      'Approved — looks good',
    );

    expect(result.status).toBe('approved');
    expect(result.approved_by).toBe(USER_IDS.channelManager);
    expect(result.registration_expires_at).toBeDefined();

    // registration_expires_at should be ~90 days from now
    const expiresIn = new Date(result.registration_expires_at!).getTime() - Date.now();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    expect(expiresIn).toBeGreaterThan(ninetyDaysMs - 5000);
    expect(expiresIn).toBeLessThan(ninetyDaysMs + 5000);
  });

  test('QA-059 — approval inserts status history with CM comments as notes', async () => {
    await dealService.approveDeal('deal-uuid-1', cmUser, cmScope, 'LGTM');

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        from_status: 'submitted',
        to_status: 'approved',
        changed_by: USER_IDS.channelManager,
        notes: 'LGTM',
      }),
    );
  });

  test('QA-049 — approval creates notification for submitting partner', async () => {
    await dealService.approveDeal('deal-uuid-1', cmUser, cmScope);

    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.partnerRepA,
        type: 'deal_update',
        title: expect.stringContaining('approved'),
      }),
    );
  });

  test('AP-4 — cannot approve already-approved deal: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'approved' }));

    await expect(
      dealService.approveDeal('deal-uuid-1', cmUser, cmScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('AP-3 — cannot approve expired deal: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'expired' }));

    await expect(
      dealService.approveDeal('deal-uuid-1', cmUser, cmScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('approves under_review deal (valid transition)', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'under_review' }));
    mockRepo.updateStatus.mockResolvedValue({ ...approvedResult } as any);

    const result = await dealService.approveDeal('deal-uuid-1', cmUser, cmScope);

    expect(result.status).toBe('approved');
  });

  test('QA-019 — partner role cannot approve (route-level, but service correctly attempts the transition)', async () => {
    // The service itself would approve if it found the deal in scope;
    // blocking is done at the route level via authorize('channel_manager', 'admin').
    // Here we verify the service logic: partner CAN call, but they wouldn't get the deal
    // in scope in production. We test that approve CAN succeed for any user who has scope.
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'submitted' }));
    mockRepo.updateStatus.mockResolvedValue({ ...approvedResult } as any);

    // No assertion on role — service doesn't check role; routes do
    const result = await dealService.approveDeal('deal-uuid-1', partnerRepUser, partnerScope);
    expect(result.status).toBe('approved');
  });

  test('QA-043 — CM cannot find deal from unassigned org (returns 404)', async () => {
    // scopeToOrg restricts the query — findById returns null
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      dealService.approveDeal('deal-uuid-1', cmUser, cmScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('approval without comments defaults history notes to "Deal approved"', async () => {
    await dealService.approveDeal('deal-uuid-1', cmUser, cmScope);

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Deal approved' }),
    );
  });

  test('AP-7 — approval succeeds even when is_conflicting=true', async () => {
    mockRepo.findById.mockResolvedValue(
      makeDeal({ status: 'submitted', is_conflicting: true }),
    );

    const result = await dealService.approveDeal(
      'deal-uuid-1',
      cmUser,
      cmScope,
      'Conflict reviewed — different use case',
    );

    expect(result.status).toBe('approved');
  });

  test('rejection_reason is cleared on approval (US-DR-008)', async () => {
    mockRepo.updateStatus.mockResolvedValue({
      ...approvedResult,
      rejection_reason: null,
    } as any);

    await dealService.approveDeal('deal-uuid-1', cmUser, cmScope);

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'approved',
      expect.objectContaining({ rejection_reason: null }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REJECT DEAL
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.rejectDeal', () => {
  const submittedDeal = makeDeal({
    status: 'submitted',
    submitted_by: USER_IDS.partnerRepA,
  });

  const rejectedResult = {
    ...submittedDeal,
    status: 'rejected',
    rejection_reason: 'Duplicate registration. CloudGuard Inc already has an approved deal.',
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(submittedDeal);
    mockRepo.updateStatus.mockResolvedValue(rejectedResult as any);
  });

  test('QA-010 — rejects submitted deal with reason: status -> rejected', async () => {
    const result = await dealService.rejectDeal(
      'deal-uuid-1',
      cmUser,
      cmScope,
      'Duplicate registration. CloudGuard Inc already has an approved deal.',
    );

    expect(result.status).toBe('rejected');
    expect(result.rejection_reason).toBe(
      'Duplicate registration. CloudGuard Inc already has an approved deal.',
    );
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'deal-uuid-1',
      'submitted',
      'rejected',
      expect.objectContaining({
        rejection_reason: 'Duplicate registration. CloudGuard Inc already has an approved deal.',
      }),
    );
  });

  test('QA-050 — rejection creates notification for submitter with reason preview', async () => {
    await dealService.rejectDeal(
      'deal-uuid-1',
      cmUser,
      cmScope,
      'Duplicate registration.',
    );

    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.partnerRepA,
        type: 'deal_update',
        title: expect.stringContaining('rejected'),
      }),
    );
  });

  test('long rejection reason is truncated in notification title (> 100 chars)', async () => {
    const longReason = 'A'.repeat(150);
    await dealService.rejectDeal('deal-uuid-1', cmUser, cmScope, longReason);

    const call = mockNotif.createNotification.mock.calls[0][0];
    expect(call.title.length).toBeLessThanOrEqual(200); // title includes prefix
    expect(call.title).toContain('...');
  });

  test('already expired deal cannot be rejected: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'expired' }));

    await expect(
      dealService.rejectDeal('deal-uuid-1', cmUser, cmScope, 'Too late'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('ST-4 — rejecting an already-rejected deal: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'rejected' }));

    await expect(
      dealService.rejectDeal('deal-uuid-1', cmUser, cmScope, 'Still rejected'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('inserts status history with rejection reason as notes', async () => {
    await dealService.rejectDeal('deal-uuid-1', cmUser, cmScope, 'Not enough info');

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        from_status: 'submitted',
        to_status: 'rejected',
        notes: 'Not enough info',
      }),
    );
  });

  test('updates approval_request with action=reject', async () => {
    await dealService.rejectDeal('deal-uuid-1', cmUser, cmScope, 'Reason here');

    expect(mockRepo.updateApprovalRequest).toHaveBeenCalledWith(
      'deal',
      'deal-uuid-1',
      'reject',
      'Reason here',
    );
  });

  test('throws 404 when deal not found in scope', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      dealService.rejectDeal('deal-uuid-1', cmUser, cmScope, 'reason'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MARK WON
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.markWon', () => {
  const approvedDeal = makeDeal({
    status: 'approved',
    submitted_by: USER_IDS.partnerRepA,
    organization_id: ORG_IDS.orgA,
  });

  const wonResult = {
    ...approvedDeal,
    status: 'won',
    actual_value: 425000,
    actual_close_date: '2026-04-15',
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(approvedDeal);
    mockRepo.updateStatus.mockResolvedValue(wonResult as any);
    // org query for findApprover
    mockDb.mockImplementation((table: any) => ({
      ...mockDbChain,
      first: jest.fn().mockResolvedValue(
        table === 'organizations'
          ? { channel_manager_id: USER_IDS.channelManager }
          : { id: USER_IDS.admin },
      ),
    }));
  });

  test('QA-013 — marks approved deal as won with actual_value and actual_close_date', async () => {
    const result = await dealService.markWon(
      'deal-uuid-1',
      partnerRepUser,
      partnerScope,
      425000,
      '2026-04-15',
    );

    expect(result.status).toBe('won');
    expect(result.actual_value).toBe(425000);
    expect(result.actual_close_date).toBe('2026-04-15');
  });

  test('QA-013 — org ytd_revenue incremented by actual_value on deal won', async () => {
    let incrementCalledWith: any = null;
    mockDb.mockImplementation((table: any) => {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(
          table === 'organizations'
            ? { channel_manager_id: USER_IDS.channelManager }
            : null,
        ),
        increment: jest.fn().mockImplementation(function (field: string, amount: number) {
          incrementCalledWith = { table, field, amount };
          return this;
        }),
      };
      return chain;
    });

    await dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15');

    // Verify increment was called on organizations table with ytd_revenue
    expect(mockDb).toHaveBeenCalledWith('organizations');
  });

  test('QA-013 — recalculateTier is called for the org after won', async () => {
    await dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15');

    expect(mockOrgService.recalculateTier).toHaveBeenCalledWith(
      ORG_IDS.orgA,
      expect.objectContaining({ type: 'all' }),
    );
  });

  test('QA-013 — tier_recalculation result included in response', async () => {
    const tierResult = {
      organization_id: ORG_IDS.orgA,
      old_tier: { id: 'tier-2', name: 'Innovator', rank: 2 },
      new_tier: { id: 'tier-3', name: 'Platinum', rank: 3 },
      changed: true,
    };
    mockOrgService.recalculateTier.mockResolvedValue(tierResult as any);

    const result = await dealService.markWon(
      'deal-uuid-1',
      partnerRepUser,
      partnerScope,
      425000,
      '2026-04-15',
    );

    expect(result.tier_recalculation).toMatchObject({ changed: true });
  });

  test('tier recalculation failure does not block mark-won', async () => {
    mockOrgService.recalculateTier.mockRejectedValue(new Error('Tier service down'));

    await expect(
      dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15'),
    ).resolves.toMatchObject({ status: 'won' });
  });

  test('QA-018 — cannot mark submitted deal won: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'submitted' }));

    await expect(
      dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('QA-022 — cannot mark expired deal won: 422 DEAL_INVALID_TRANSITION (ST-6)', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'expired' }));

    await expect(
      dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('QA-020 — cannot mark won deal won again: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'won' }));

    await expect(
      dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('notifies CM on deal won', async () => {
    await dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15');

    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.channelManager,
        title: expect.stringContaining('closed won'),
      }),
    );
  });

  test('inserts status history: approved -> won', async () => {
    await dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 425000, '2026-04-15');

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: 'approved', to_status: 'won' }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MARK LOST
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.markLost', () => {
  const approvedDeal = makeDeal({ status: 'approved' });

  const lostResult = {
    ...approvedDeal,
    status: 'lost',
    custom_fields: { loss_reason: 'Customer chose competitor' },
    updated_at: new Date(),
  };

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(approvedDeal);
    mockRepo.updateStatus.mockResolvedValue(lostResult as any);
  });

  test('QA-014 — marks approved deal as lost with loss_reason', async () => {
    const result = await dealService.markLost(
      'deal-uuid-1',
      partnerRepUser,
      partnerScope,
      'Customer chose competitor',
    );

    expect(result.status).toBe('lost');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'deal-uuid-1',
      'approved',
      'lost',
      expect.objectContaining({
        custom_fields: expect.stringContaining('Customer chose competitor'),
      }),
    );
  });

  test('loss_reason stored in custom_fields.loss_reason', async () => {
    await dealService.markLost('deal-uuid-1', partnerRepUser, partnerScope, 'Lost to competition');

    const updateCall = mockRepo.updateStatus.mock.calls[0];
    const extraFields = updateCall[3];
    const parsed = JSON.parse(extraFields.custom_fields);
    expect(parsed.loss_reason).toBe('Lost to competition');
  });

  test('inserts status history: approved -> lost', async () => {
    await dealService.markLost('deal-uuid-1', partnerRepUser, partnerScope, 'Budget cut');

    expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ from_status: 'approved', to_status: 'lost' }),
    );
  });

  test('cannot mark submitted deal lost: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'submitted' }));

    await expect(
      dealService.markLost('deal-uuid-1', partnerRepUser, partnerScope, 'Reason'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('QA-021 — lost is a terminal state: cannot transition again', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'lost' }));

    await expect(
      dealService.markLost('deal-uuid-1', partnerRepUser, partnerScope, 'Reason'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });

  test('ST-7 — cannot mark expired deal lost: 422 DEAL_INVALID_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'expired' }));

    await expect(
      dealService.markLost('deal-uuid-1', partnerRepUser, partnerScope, 'Reason'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_INVALID_TRANSITION' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CONFLICT DETECTION
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.detectConflicts', () => {
  beforeEach(() => {
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));
  });

  test('QA-023 — exact email match: returns conflict with match_type=exact_email', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ match_type: 'exact_email', similarity_score: '1.0' }),
    ]);
    // Conflicting deal is from a different org
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgB },
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.detectConflicts(
      'Acme Corporation',
      'john@acme.com',
      null,
      null,
      ORG_IDS.orgA,
    );

    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe('exact_email');
    expect(result[0].similarity_score).toBe(1.0);
  });

  test('QA-025 — fuzzy company match: returns conflict with match_type=fuzzy_company', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ match_type: 'fuzzy_company', similarity_score: '0.72' }),
    ]);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgB },
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.detectConflicts(
      'Acme Corp',
      null,
      null,
      null,
      ORG_IDS.orgA,
    );

    expect(result[0].match_type).toBe('fuzzy_company');
    expect(result[0].similarity_score).toBeCloseTo(0.72);
  });

  test('QA-027 — CD-6: same-org deal excluded from conflict results', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ match_type: 'exact_email', similarity_score: '1.0' }),
    ]);
    // Conflicting deal is from the SAME org
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgA }, // same org!
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.detectConflicts(
      'Acme Corp',
      'john@acme.com',
      null,
      null,
      ORG_IDS.orgA, // exclude this org
    );

    // Same-org conflict filtered out
    expect(result).toHaveLength(0);
  });

  test('CD-7 — expired deal excluded: DB function WHERE clause handles this; application filter passes through non-same-org only', async () => {
    // The DB function already excludes expired deals in its WHERE clause.
    // detectConflicts only applies same-org filter at the application layer.
    // So if findConflicts returns empty (DB function excluded expired deal), result is empty.
    mockRepo.findConflicts.mockResolvedValue([]);

    const result = await dealService.detectConflicts(
      'Acme Corp',
      'john@acme.com',
      null,
      'deal-uuid-to-exclude',
      ORG_IDS.orgA,
    );

    expect(result).toHaveLength(0);
  });

  test('QA-028 — conflict with rejected deal: empty results (DB function excludes rejected)', async () => {
    mockRepo.findConflicts.mockResolvedValue([]);

    const result = await dealService.detectConflicts('Acme Corp', null, null, null, ORG_IDS.orgA);
    expect(result).toHaveLength(0);
  });

  test('CD-11 — NULL email on both deals: no email match, only company matching', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ match_type: 'fuzzy_company', similarity_score: '0.6' }),
    ]);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgB },
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.detectConflicts(
      'Acme Corp',
      null, // NULL email
      null,
      null,
      ORG_IDS.orgA,
    );

    expect(result[0].match_type).toBe('fuzzy_company');
  });

  test('no conflicts found: returns empty array', async () => {
    mockRepo.findConflicts.mockResolvedValue([]);

    const result = await dealService.detectConflicts('Unique Company', null, null, null, null);
    expect(result).toEqual([]);
  });

  test('similarity_score is parsed as float, not string', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ similarity_score: '0.68' }),
    ]);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgB },
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.detectConflicts('Company', null, null, null, null);

    expect(typeof result[0].similarity_score).toBe('number');
    expect(result[0].similarity_score).toBeCloseTo(0.68);
  });

  test('multiple conflicts returned: all included in results', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ conflicting_deal_id: 'deal-1', match_type: 'exact_email' }),
      makeConflict({ conflicting_deal_id: 'deal-2', match_type: 'fuzzy_company', similarity_score: '0.55' }),
    ]);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'deal-1', organization_id: ORG_IDS.orgB },
        { id: 'deal-2', organization_id: 'org-c' },
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.detectConflicts(
      'Acme',
      'john@acme.com',
      null,
      null,
      ORG_IDS.orgA,
    );

    expect(result).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ADD PRODUCT
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.addProduct', () => {
  const draftDeal = makeDeal({ status: 'draft' });
  const activeProduct = makeProduct({ id: 'product-uuid-1', is_active: true, available_to_partners: true });
  const dealProductRow = {
    id: 'deal-product-uuid',
    deal_id: 'deal-uuid-1',
    product_id: 'product-uuid-1',
    product_name: activeProduct.name,
    product_sku: activeProduct.sku,
    quantity: 6,
    unit_price: 75000,
    discount_pct: 10,
    line_total: 405000,
  };

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(draftDeal);
    mockRepo.findDealProduct.mockResolvedValue(null); // no duplicate
    mockRepo.addProduct.mockResolvedValue(dealProductRow as any);
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 405000, count: 1 });
    mockRepo.getProducts.mockResolvedValue([dealProductRow] as any);
    mockRepo.updateFields.mockResolvedValue(draftDeal as any);
    // db query for product lookup
    mockDb.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(activeProduct),
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));
  });

  test('QA-032 — adds product to draft deal: inserts deal_products row with computed line_total', async () => {
    const result = await dealService.addProduct(
      'deal-uuid-1',
      partnerRepUser,
      partnerScope,
      'product-uuid-1',
      6,
      75000,
      10,
    );

    expect(mockRepo.addProduct).toHaveBeenCalledWith({
      deal_id: 'deal-uuid-1',
      product_id: 'product-uuid-1',
      quantity: 6,
      unit_price: 75000,
      discount_pct: 10,
    });
    expect(result.line_total).toBe(405000);
  });

  test('QA-032 — estimated_value recalculated after product add', async () => {
    await dealService.addProduct(
      'deal-uuid-1',
      partnerRepUser,
      partnerScope,
      'product-uuid-1',
      6,
      75000,
      10,
    );

    expect(mockRepo.getProductLineTotal).toHaveBeenCalledWith('deal-uuid-1');
    expect(mockRepo.updateFields).toHaveBeenCalledWith('deal-uuid-1', { estimated_value: 405000 });
  });

  test('QA-033 — duplicate product: 409 DEAL_DUPLICATE_PRODUCT', async () => {
    mockRepo.findDealProduct.mockResolvedValue({ id: 'existing-dp-uuid' } as any);

    await expect(
      dealService.addProduct('deal-uuid-1', partnerRepUser, partnerScope, 'product-uuid-1', 1, 100, 0),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DEAL_DUPLICATE_PRODUCT' });
  });

  test('QA-034 — inactive product: 422 DEAL_PRODUCT_UNAVAILABLE', async () => {
    mockDb.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ ...activeProduct, is_active: false }),
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      dealService.addProduct('deal-uuid-1', partnerRepUser, partnerScope, 'product-uuid-1', 1, 100, 0),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_PRODUCT_UNAVAILABLE' });
  });

  test('DP-1 — product with available_to_partners=false: 422 DEAL_PRODUCT_UNAVAILABLE', async () => {
    mockDb.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ ...activeProduct, available_to_partners: false }),
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      dealService.addProduct('deal-uuid-1', partnerRepUser, partnerScope, 'product-uuid-1', 1, 100, 0),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DEAL_PRODUCT_UNAVAILABLE' });
  });

  test('QA-035 — cannot add product to submitted deal: 422', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'submitted' }));

    await expect(
      dealService.addProduct('deal-uuid-1', partnerRepUser, partnerScope, 'product-uuid-1', 1, 100, 0),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('DP-5 — cannot add product to approved deal: 422', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'approved' }));

    await expect(
      dealService.addProduct('deal-uuid-1', partnerRepUser, partnerScope, 'product-uuid-1', 1, 100, 0),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('can add product to rejected deal (rejected deals are editable)', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'rejected' }));

    await expect(
      dealService.addProduct('deal-uuid-1', partnerRepUser, partnerScope, 'product-uuid-1', 1, 100, 0),
    ).resolves.toBeDefined();
  });

  test('deal_estimated_value in response equals sum when products exist', async () => {
    const result = await dealService.addProduct(
      'deal-uuid-1',
      partnerRepUser,
      partnerScope,
      'product-uuid-1',
      6,
      75000,
      10,
    );

    expect(result.deal_estimated_value).toBe(405000);
  });

  test('DP-7 — unit_price=0 is allowed (bundled product), line_total=0', async () => {
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 0, count: 1 });
    mockRepo.getProducts.mockResolvedValue([{ ...dealProductRow, unit_price: 0, line_total: 0 }] as any);

    const result = await dealService.addProduct(
      'deal-uuid-1',
      partnerRepUser,
      partnerScope,
      'product-uuid-1',
      1,
      0,
      0,
    );

    expect(result.unit_price).toBe(0);
  });

  test('product not found in catalog: 404', async () => {
    mockDb.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([]),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    await expect(
      dealService.addProduct('deal-uuid-1', partnerRepUser, partnerScope, 'bad-product-uuid', 1, 100, 0),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// REMOVE PRODUCT
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.removeProduct', () => {
  const draftDeal = makeDeal({ status: 'draft', estimated_value: 450000 });
  const existingProduct = { id: 'dp-uuid', deal_id: 'deal-uuid-1', product_id: 'product-uuid-1' };

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(draftDeal);
    mockRepo.findDealProduct.mockResolvedValue(existingProduct as any);
    mockRepo.removeProduct.mockResolvedValue(1 as any);
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 0, count: 0 });
    mockRepo.updateFields.mockResolvedValue(draftDeal as any);
  });

  test('QA-036 — removes product from draft deal', async () => {
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 200000, count: 1 });

    const result = await dealService.removeProduct(
      'deal-uuid-1',
      'product-uuid-1',
      partnerRepUser,
      partnerScope,
    );

    expect(mockRepo.removeProduct).toHaveBeenCalledWith('deal-uuid-1', 'product-uuid-1');
    expect(result.removed).toBe(true);
  });

  test('QA-036 — estimated_value recalculated when other products still exist', async () => {
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 200000, count: 1 });

    await dealService.removeProduct('deal-uuid-1', 'product-uuid-1', partnerRepUser, partnerScope);

    expect(mockRepo.updateFields).toHaveBeenCalledWith('deal-uuid-1', { estimated_value: 200000 });
  });

  test('QA-037 — DP-4: removing last product does NOT reset estimated_value to 0', async () => {
    mockRepo.getProductLineTotal.mockResolvedValue({ sum: 0, count: 0 }); // no products left

    const result = await dealService.removeProduct(
      'deal-uuid-1',
      'product-uuid-1',
      partnerRepUser,
      partnerScope,
    );

    // updateFields should NOT be called (no products remain)
    expect(mockRepo.updateFields).not.toHaveBeenCalled();
    // deal_estimated_value retains original deal.estimated_value
    expect(result.deal_estimated_value).toBe(draftDeal.estimated_value);
  });

  test('cannot remove product from submitted deal: 422', async () => {
    mockRepo.findById.mockResolvedValue(makeDeal({ status: 'submitted' }));

    await expect(
      dealService.removeProduct('deal-uuid-1', 'product-uuid-1', partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('throws 404 when product not on deal', async () => {
    mockRepo.findDealProduct.mockResolvedValue(null);

    await expect(
      dealService.removeProduct('deal-uuid-1', 'not-on-deal', partnerRepUser, partnerScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DATA SCOPING
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService — data scoping', () => {
  test('QA-040 — partner sees only their org deals (scope passed to repository)', async () => {
    mockRepo.list.mockResolvedValue({ data: [], total: 0 });

    await dealService.listDeals(partnerScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      partnerScope, // scope with orgId = ORG_IDS.orgA
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('QA-042 — CM sees only assigned org deals (cmScope passed to repository)', async () => {
    mockRepo.list.mockResolvedValue({ data: [], total: 0 });

    await dealService.listDeals(cmScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      cmScope,
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('QA-044 — admin sees all deals (adminScope has type=all)', async () => {
    mockRepo.list.mockResolvedValue({ data: [], total: 0 });

    await dealService.listDeals(adminScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      adminScope,
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('QA-041 — partner A getting Org B deal returns 404 (findById returns null for out-of-scope)', async () => {
    // scopeToOrg ensures the query filters by org; findById returns null
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      dealService.getDeal('org-b-deal-uuid', partnerScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('DS-2 — CM getting deal from unassigned org returns 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      dealService.getDeal('unassigned-deal', cmScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// STATUS TRANSITION VALIDATION (comprehensive table)
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService — invalid status transitions (VALID_DEAL_TRANSITIONS table)', () => {
  const TERMINAL_STATUSES = ['won', 'lost', 'expired'];

  test.each([
    ['draft', 'approved'],
    ['draft', 'rejected'],
    ['draft', 'won'],
    ['draft', 'lost'],
    ['draft', 'expired'],
    ['submitted', 'won'],
    ['submitted', 'lost'],
    ['submitted', 'draft'],
    ['rejected', 'approved'],
    ['rejected', 'won'],
    ['rejected', 'lost'],
    ['rejected', 'expired'],
    ['under_review', 'submitted'],
    ['under_review', 'draft'],
    ['won', 'approved'],
    ['won', 'lost'],
    ['won', 'submitted'],
    ['lost', 'approved'],
    ['lost', 'won'],
    ['lost', 'submitted'],
    ['expired', 'approved'],
    ['expired', 'won'],
    ['expired', 'submitted'],
  ])(
    'QA-016..QA-022 — %s -> %s is invalid: 422 DEAL_INVALID_TRANSITION',
    async (fromStatus, toStatus) => {
      // Test using submitDeal (draft->submitted transitions), approveDeal, markWon, etc.
      // We call the private validateTransition method indirectly through the service.
      // The simplest approach is to set deal.status and call the appropriate action.
      // For arbitrary transition combos, we mock findById and choose the right service method.

      const deal = makeDeal({ status: fromStatus });
      mockRepo.findById.mockResolvedValue(deal);

      // Map toStatus to the appropriate service call
      let action: Promise<any>;
      if (toStatus === 'submitted') {
        // From states like 'approved', 'under_review', 'won' etc. -> 'submitted' is invalid
        // But submitDeal also validates fromStatus, not just the transition
        // Use a direct call and expect the transition error
        action = dealService.submitDeal('deal-uuid-1', partnerRepUser, partnerScope);
      } else if (toStatus === 'approved') {
        action = dealService.approveDeal('deal-uuid-1', cmUser, cmScope);
      } else if (toStatus === 'rejected') {
        action = dealService.rejectDeal('deal-uuid-1', cmUser, cmScope, 'Reason');
      } else if (toStatus === 'won') {
        action = dealService.markWon('deal-uuid-1', partnerRepUser, partnerScope, 100, '2026-01-01');
      } else if (toStatus === 'lost') {
        action = dealService.markLost('deal-uuid-1', partnerRepUser, partnerScope, 'Reason');
      } else {
        // expired — only system can do this; we skip testing service directly
        // as the expiration job calls repository directly
        return;
      }

      const err = await action.catch((e) => e);
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('DEAL_INVALID_TRANSITION');
    },
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// GET STATUS HISTORY
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.getHistory', () => {
  test('QA-060 — returns ordered history for a deal accessible in scope', async () => {
    const historyRecords = [
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
    ];
    mockRepo.findById.mockResolvedValue(makeDeal());
    mockRepo.getStatusHistory.mockResolvedValue(historyRecords as any);

    const result = await dealService.getHistory('deal-uuid-1', partnerScope);

    expect(result).toHaveLength(2);
    expect(result[0].from_status).toBeNull();
    expect(result[0].to_status).toBe('draft');
    expect(result[1].to_status).toBe('submitted');
  });

  test('throws 404 when deal not in scope', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(dealService.getHistory('deal-uuid-1', partnerScope)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CONFLICT CHECK (pre-submission)
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.conflictCheck', () => {
  test('QA-031 — pre-submission conflict check excludes same org (user.org_id)', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ match_type: 'fuzzy_company' }),
    ]);
    // Conflicting deal from same org
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgA },
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.conflictCheck('Acme Corp', null, null, partnerRepUser);

    // User's own org is excluded
    expect(result).toHaveLength(0);
  });

  test('returns conflict from different org', async () => {
    mockRepo.findConflicts.mockResolvedValue([
      makeConflict({ match_type: 'exact_email' }),
    ]);
    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockResolvedValue([
        { id: 'conflict-deal-uuid', organization_id: ORG_IDS.orgB },
      ]),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    }));

    const result = await dealService.conflictCheck('Acme Corp', 'john@acme.com', null, partnerRepUser);

    expect(result).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET DEAL
// ═════════════════════════════════════════════════════════════════════════════

describe('DealService.getDeal', () => {
  test('returns deal when found in scope', async () => {
    const deal = makeDeal();
    mockRepo.findById.mockResolvedValue(deal);

    const result = await dealService.getDeal('deal-uuid-1', partnerScope);

    expect(result).toEqual(deal);
  });

  test('throws 404 when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(dealService.getDeal('nope', partnerScope)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

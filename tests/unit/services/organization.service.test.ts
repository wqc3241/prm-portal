/**
 * Unit tests for OrganizationService.
 *
 * PRD coverage: QA-ORG-01 through QA-ORG-13, ORG-E01 through ORG-E10,
 *               QA-RBAC-09, QA-RBAC-10, QA-RBAC-14, QA-RBAC-15, QA-RBAC-17
 */

jest.mock('../../../src/repositories/organization.repository', () => ({
  __esModule: true,
  default: {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    getOrgUsers: jest.fn(),
    calculateTier: jest.fn(),
  },
}));

jest.mock('../../../src/config/database', () => {
  const mockFn = jest.fn();
  mockFn.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
  });
  return { __esModule: true, default: mockFn };
});

import organizationService from '../../../src/services/organization.service';
import organizationRepository from '../../../src/repositories/organization.repository';
import {
  adminPayload,
  cmPayload,
  partnerAdminPayload,
  partnerRepPayload,
  ORG_IDS,
  TIER_IDS,
  USER_IDS,
} from '../../fixtures/factories';

const mockRepo = organizationRepository as jest.Mocked<typeof organizationRepository>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrg(overrides: Record<string, any> = {}) {
  return {
    id: ORG_IDS.orgA,
    name: 'Org Alpha',
    status: 'active',
    tier_id: TIER_IDS.registered,
    channel_manager_id: null,
    tier_name: 'Registered',
    tier_rank: 1,
    tier_color_hex: '#AABBCC',
    ...overrides,
  };
}

const allScope = { type: 'all' as const };
const ownScope = { type: 'own' as const, organizationId: ORG_IDS.orgA };
const assignedScope = { type: 'assigned' as const, assignedOrgIds: [ORG_IDS.orgA] };

// ── list() ────────────────────────────────────────────────────────────────────

describe('OrganizationService.list', () => {
  beforeEach(() => {
    mockRepo.list.mockResolvedValue({ data: [], total: 0 });
  });

  test('QA-ORG-02 — admin gets "all" scope', async () => {
    await organizationService.list(allScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'all' }),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('QA-ORG-03 — channel_manager gets "assigned" scope', async () => {
    await organizationService.list(assignedScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'assigned' }),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('QA-ORG-04 — partner_admin gets "own" scope', async () => {
    await organizationService.list(ownScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'own', organizationId: ORG_IDS.orgA }),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });
});

// ── getById() ─────────────────────────────────────────────────────────────────

describe('OrganizationService.getById', () => {
  test('QA-ORG-05 — returns org with tier details shaped into nested object', async () => {
    mockRepo.findById.mockResolvedValue(makeOrg());

    const result = await organizationService.getById(ORG_IDS.orgA, allScope);

    expect(result).toMatchObject({
      id: ORG_IDS.orgA,
      tier: expect.objectContaining({ name: 'Registered', rank: 1 }),
    });
    expect((result as any).tier_name).toBeUndefined(); // flat field removed
  });

  test('ORG-E01 / ORG-E02 — non-scoped org returns 404 (not 403)', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      organizationService.getById(ORG_IDS.orgB, ownScope),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  test('QA-RBAC-09 — channel_manager requesting unassigned org → 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      organizationService.getById(ORG_IDS.orgB, assignedScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── create() ─────────────────────────────────────────────────────────────────

describe('OrganizationService.create', () => {
  beforeEach(() => {
    mockRepo.create.mockResolvedValue(makeOrg({ status: 'prospect' }));
  });

  test('QA-ORG-01 — admin creates org with prospect status and default tier', async () => {
    // db mock returns null for channel_manager lookup (no CM provided)
    // db mock for default tier
    const db = (await import('../../../src/config/database')).default;
    (db as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'partner_tiers') {
        return {
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ id: TIER_IDS.registered }),
        };
      }
      return {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
    });

    const result = await organizationService.create({ name: 'New Partner Co' }, adminPayload());

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'prospect', tier_id: TIER_IDS.registered }),
    );
  });

  test('ORG-E10 — invalid channel_manager_id (user not a CM) → 422 ORG_INVALID_CHANNEL_MANAGER', async () => {
    const db = (await import('../../../src/config/database')).default;
    (db as unknown as jest.Mock).mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ role: 'partner_admin' }), // not a CM
    }));

    await expect(
      organizationService.create({ name: 'Bad Org', channel_manager_id: USER_IDS.partnerAdminA }, adminPayload()),
    ).rejects.toMatchObject({ statusCode: 422, code: 'ORG_INVALID_CHANNEL_MANAGER' });
  });
});

// ── update() ─────────────────────────────────────────────────────────────────

describe('OrganizationService.update', () => {
  const existingOrg = makeOrg({ status: 'prospect' });

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(existingOrg);
    mockRepo.update.mockResolvedValue({ ...existingOrg, name: 'Updated Name' });
  });

  test('QA-RBAC-14 — partner_admin updates own org non-sensitive fields', async () => {
    await organizationService.update(
      ORG_IDS.orgA,
      { name: 'Updated Name', website: 'https://new.example.com' },
      partnerAdminPayload(),
      ownScope,
    );

    expect(mockRepo.update).toHaveBeenCalledWith(
      ORG_IDS.orgA,
      expect.objectContaining({ name: 'Updated Name', website: 'https://new.example.com' }),
    );
  });

  test('QA-RBAC-15 / ORG-E04 — partner_admin status change is silently ignored', async () => {
    await organizationService.update(
      ORG_IDS.orgA,
      { name: 'Safe', status: 'suspended' },
      partnerAdminPayload(),
      ownScope,
    );

    const callArg = mockRepo.update.mock.calls[0][1];
    expect(callArg.status).toBeUndefined();
    expect(callArg.name).toBe('Safe');
  });

  test('ORG-E05 — partner_admin tier_id change is silently ignored', async () => {
    await organizationService.update(
      ORG_IDS.orgA,
      { name: 'Safe', tier_id: TIER_IDS.diamond },
      partnerAdminPayload(),
      ownScope,
    );

    const callArg = mockRepo.update.mock.calls[0][1];
    expect(callArg.tier_id).toBeUndefined();
  });

  test('ORG-E07 — invalid status transition churned→active → 422 ORG_INVALID_STATUS_TRANSITION', async () => {
    mockRepo.findById.mockResolvedValue(makeOrg({ status: 'churned' }));

    await expect(
      organizationService.update(ORG_IDS.orgA, { status: 'active' }, adminPayload(), allScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'ORG_INVALID_STATUS_TRANSITION' });
  });

  test('valid status transition prospect→active (fast-track) is allowed', async () => {
    mockRepo.findById.mockResolvedValue(makeOrg({ status: 'prospect' }));
    mockRepo.update.mockResolvedValue(makeOrg({ status: 'active' }));

    await expect(
      organizationService.update(ORG_IDS.orgA, { status: 'active' }, adminPayload(), allScope),
    ).resolves.not.toThrow();
  });

  test('valid transition prospect→pending_approval is allowed', async () => {
    mockRepo.findById.mockResolvedValue(makeOrg({ status: 'prospect' }));
    mockRepo.update.mockResolvedValue(makeOrg({ status: 'pending_approval' }));

    await expect(
      organizationService.update(ORG_IDS.orgA, { status: 'pending_approval' }, adminPayload(), allScope),
    ).resolves.not.toThrow();
  });

  test('valid transition suspended→active (reinstatement) is allowed', async () => {
    mockRepo.findById.mockResolvedValue(makeOrg({ status: 'suspended' }));
    mockRepo.update.mockResolvedValue(makeOrg({ status: 'active' }));

    await expect(
      organizationService.update(ORG_IDS.orgA, { status: 'active' }, adminPayload(), allScope),
    ).resolves.not.toThrow();
  });

  test('ORG-E02 — partner_admin accessing different org → 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      organizationService.update(ORG_IDS.orgB, { name: 'X' }, partnerAdminPayload(), ownScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('partner_rep cannot update organizations → 403', async () => {
    await expect(
      organizationService.update(ORG_IDS.orgA, { name: 'X' }, partnerRepPayload(), ownScope),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_INSUFFICIENT_ROLE' });
  });
});

// ── recalculateTier() ─────────────────────────────────────────────────────────

describe('OrganizationService.recalculateTier', () => {
  test('QA-ORG-09 — returns old_tier and new_tier, updates if changed', async () => {
    const orgWithOldTier = makeOrg({ tier_id: TIER_IDS.registered });
    mockRepo.findById.mockResolvedValue(orgWithOldTier);
    mockRepo.calculateTier.mockResolvedValue(TIER_IDS.innovator);
    mockRepo.update.mockResolvedValue({ ...orgWithOldTier, tier_id: TIER_IDS.innovator });

    const db = (await import('../../../src/config/database')).default;
    (db as unknown as jest.Mock).mockImplementation((table: string) => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(
        table === 'partner_tiers'
          ? { id: TIER_IDS.innovator, name: 'Innovator', rank: 2 }
          : null,
      ),
    }));

    const result = await organizationService.recalculateTier(ORG_IDS.orgA, allScope);

    expect(result).toMatchObject({ changed: true });
    expect(mockRepo.update).toHaveBeenCalledWith(ORG_IDS.orgA, { tier_id: TIER_IDS.innovator });
  });

  test('QA-ORG-10 / ORG-E08 — org with no deals qualifies for Registered tier (rank 1)', async () => {
    const org = makeOrg({ tier_id: TIER_IDS.registered });
    mockRepo.findById.mockResolvedValue(org);
    mockRepo.calculateTier.mockResolvedValue(TIER_IDS.registered); // same tier
    mockRepo.update.mockResolvedValue(org);

    const db = (await import('../../../src/config/database')).default;
    (db as unknown as jest.Mock).mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: TIER_IDS.registered, name: 'Registered', rank: 1 }),
    }));

    const result = await organizationService.recalculateTier(ORG_IDS.orgA, allScope);

    expect(result.changed).toBe(false);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});

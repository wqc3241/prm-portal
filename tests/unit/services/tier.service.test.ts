/**
 * Unit tests for TierService.
 *
 * PRD coverage: QA-TIER-01 through QA-TIER-11, TIER-E01 through TIER-E10
 */

jest.mock('../../../src/repositories/tier.repository', () => ({
  __esModule: true,
  default: {
    list: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findByRank: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countOrgs: jest.fn(),
    listOrganizations: jest.fn(),
  },
}));

import tierService from '../../../src/services/tier.service';
import tierRepository from '../../../src/repositories/tier.repository';

const mockRepo = tierRepository as jest.Mocked<typeof tierRepository>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTier(overrides: Record<string, any> = {}) {
  return {
    id: 'tier-uuid-1',
    name: 'Gold',
    rank: 3,
    color_hex: '#FFD700',
    min_annual_revenue: 0,
    min_deals_closed: 0,
    min_certified_reps: 0,
    min_csat_score: 0,
    default_discount_pct: 10,
    max_discount_pct: 20,
    mdf_budget_pct: 3,
    lead_priority: 2,
    dedicated_channel_mgr: false,
    description: null,
    ...overrides,
  };
}

// ── list() ────────────────────────────────────────────────────────────────────

describe('TierService.list', () => {
  test('QA-TIER-01 — returns all tiers ordered by rank', async () => {
    const tiers = [makeTier({ rank: 1, name: 'Registered' }), makeTier({ rank: 2, name: 'Innovator' })];
    mockRepo.list.mockResolvedValue(tiers);

    const result = await tierService.list();

    expect(result).toHaveLength(2);
    expect(result[0].rank).toBe(1);
  });
});

// ── getById() ─────────────────────────────────────────────────────────────────

describe('TierService.getById', () => {
  test('QA-TIER-06 — returns tier by ID', async () => {
    mockRepo.findById.mockResolvedValue(makeTier());

    const result = await tierService.getById('tier-uuid-1');

    expect(result).toMatchObject({ id: 'tier-uuid-1', name: 'Gold' });
  });

  test('returns 404 for non-existent tier', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(tierService.getById('bad-id')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── create() ─────────────────────────────────────────────────────────────────

describe('TierService.create', () => {
  beforeEach(() => {
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.findByRank.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(makeTier());
  });

  test('QA-TIER-02 — creates tier with unique name and rank', async () => {
    await tierService.create({
      name: 'Gold',
      rank: 3,
      default_discount_pct: 10,
      max_discount_pct: 20,
    });

    expect(mockRepo.create).toHaveBeenCalled();
  });

  test('QA-TIER-03 / TIER-E05 — duplicate name → 409 TIER_DUPLICATE', async () => {
    mockRepo.findByName.mockResolvedValue(makeTier());

    await expect(
      tierService.create({ name: 'Gold', rank: 99, default_discount_pct: 0, max_discount_pct: 5 }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TIER_DUPLICATE' });
  });

  test('QA-TIER-04 / TIER-E04 — duplicate rank → 409 TIER_DUPLICATE', async () => {
    mockRepo.findByRank.mockResolvedValue(makeTier());

    await expect(
      tierService.create({ name: 'Unique Name', rank: 3, default_discount_pct: 0, max_discount_pct: 5 }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TIER_DUPLICATE' });
  });

  test('TIER-E09 — max_discount_pct < default_discount_pct → 422 VALIDATION_ERROR', async () => {
    await expect(
      tierService.create({ name: 'Bad', rank: 99, default_discount_pct: 20, max_discount_pct: 5 }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
  });

  test('TIER-E09 — max_discount_pct === default_discount_pct is valid (equal is allowed)', async () => {
    mockRepo.create.mockResolvedValue(makeTier({ default_discount_pct: 10, max_discount_pct: 10 }));

    await expect(
      tierService.create({ name: 'Equal', rank: 99, default_discount_pct: 10, max_discount_pct: 10 }),
    ).resolves.not.toThrow();
  });
});

// ── update() ─────────────────────────────────────────────────────────────────

describe('TierService.update', () => {
  const existingTier = makeTier({ name: 'Old Name', rank: 3, default_discount_pct: 10, max_discount_pct: 20 });

  beforeEach(() => {
    mockRepo.findById.mockResolvedValue(existingTier);
    mockRepo.findByName.mockResolvedValue(null);
    mockRepo.findByRank.mockResolvedValue(null);
    mockRepo.update.mockResolvedValue({ ...existingTier, name: 'New Name' });
  });

  test('QA-TIER-07 — updates allowed fields', async () => {
    await tierService.update('tier-uuid-1', { name: 'New Name', description: 'Updated' });

    expect(mockRepo.update).toHaveBeenCalledWith(
      'tier-uuid-1',
      expect.objectContaining({ name: 'New Name', description: 'Updated' }),
    );
  });

  test('TIER-E06 — changing rank to an already-used value → 409 TIER_DUPLICATE', async () => {
    mockRepo.findByRank.mockResolvedValue(makeTier({ id: 'other-tier', rank: 2 }));

    await expect(
      tierService.update('tier-uuid-1', { rank: 2 }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TIER_DUPLICATE' });
  });

  test('TIER-E09 — update making max < default → 422 VALIDATION_ERROR', async () => {
    // existing: default=10, max=20; we update default to 25 (now > max)
    await expect(
      tierService.update('tier-uuid-1', { default_discount_pct: 25 }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
  });

  test('update for non-existent tier → 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      tierService.update('bad-id', { name: 'X' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── delete() ─────────────────────────────────────────────────────────────────

describe('TierService.delete', () => {
  test('QA-TIER-08 — deletes tier with no assigned orgs', async () => {
    mockRepo.findById.mockResolvedValue(makeTier());
    mockRepo.countOrgs.mockResolvedValue(0);
    mockRepo.delete.mockResolvedValue(1);

    const result = await tierService.delete('tier-uuid-1');

    expect(mockRepo.delete).toHaveBeenCalledWith('tier-uuid-1');
    expect(result).toMatchObject({ message: expect.stringContaining('deleted') });
  });

  test('QA-TIER-09 / TIER-E01 — tier with assigned orgs → 422 TIER_HAS_ORGS with count', async () => {
    mockRepo.findById.mockResolvedValue(makeTier({ name: 'Gold' }));
    mockRepo.countOrgs.mockResolvedValue(3);

    await expect(tierService.delete('tier-uuid-1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'TIER_HAS_ORGS',
    });

    const err = await tierService.delete('tier-uuid-1').catch((e) => e);
    expect(err.message).toContain('3');
    expect(err.message).toContain('Gold');
  });

  test('delete non-existent tier → 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(tierService.delete('nonexistent')).rejects.toMatchObject({ statusCode: 404 });
  });
});

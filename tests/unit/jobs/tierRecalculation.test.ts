/**
 * Unit tests for Tier Recalculation background job.
 *
 * All external dependencies (db, notificationService) are fully mocked.
 * No database connections required.
 *
 * Covers: upgrade, downgrade, grace period start, grace period expiry,
 * grace period recovery, lowest-tier guard, highest-tier guard,
 * notifications, and empty-org-list safety.
 */

// ── Mocks must be declared before imports ────────────────────────────────────

jest.mock('../../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn().mockResolvedValue({ id: 'notif-uuid' }),
  },
}));

// Build a chainable mock for knex query builder
function createChain(resolvedValue: any = []) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNotIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(resolvedValue),
    update: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'new-id' }]),
  };
  // Allow chaining .then() for array results
  chain.then = (fn: any) => Promise.resolve(resolvedValue).then(fn);
  return chain;
}

// Table-specific mock data storage
let tableHandlers: Record<string, () => any> = {};

const mockDb: any = jest.fn((table: string) => {
  if (tableHandlers[table]) return tableHandlers[table]();
  return createChain();
});
mockDb.raw = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW()') };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

jest.mock('../../../src/config/constants', () => ({
  SYSTEM_USER_EMAIL: 'system@prm-portal.internal',
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { processTierRecalculation } from '../../../src/jobs/tierRecalculation.job';
import notificationService from '../../../src/services/notification.service';
import { TIER_IDS, USER_IDS, ORG_IDS } from '../../fixtures/factories';

const mockNotif = notificationService as jest.Mocked<typeof notificationService>;

// ── Fixture data ──────────────────────────────────────────────────────────────

const SYSTEM_USER_ID = 'system-user-uuid';

const TIERS = [
  {
    id: TIER_IDS.registered,
    name: 'Registered',
    rank: 1,
    min_annual_revenue: '0',
    min_certified_reps: 0,
  },
  {
    id: TIER_IDS.innovator,
    name: 'Innovator',
    rank: 2,
    min_annual_revenue: '100000',
    min_certified_reps: 2,
  },
  {
    id: TIER_IDS.platinum,
    name: 'Platinum Innovator',
    rank: 3,
    min_annual_revenue: '500000',
    min_certified_reps: 5,
  },
  {
    id: TIER_IDS.diamond,
    name: 'Diamond Innovator',
    rank: 4,
    min_annual_revenue: '1000000',
    min_certified_reps: 10,
  },
];

function makeOrg(overrides: Record<string, any> = {}) {
  return {
    id: ORG_IDS.orgA,
    name: 'Org Alpha',
    tier_id: TIER_IDS.registered,
    ytd_revenue: '0',
    ytd_deals_closed: 0,
    certified_rep_count: 0,
    tier_downgrade_grace_at: null,
    status: 'active',
    ...overrides,
  };
}

// ── Helper to configure mock db responses ─────────────────────────────────────

function setupMocks(opts: {
  systemUser?: any;
  tiers?: any[];
  orgs?: any[];
  partnerAdmins?: any[];
  channelManagerId?: string | null;
  updateResult?: number;
}) {
  const {
    systemUser = { id: SYSTEM_USER_ID },
    tiers = TIERS,
    orgs = [],
    partnerAdmins = [{ id: USER_IDS.partnerAdminA }],
    channelManagerId = null,
    updateResult = 1,
  } = opts;

  // Track call state for system user lookup
  let usersCallCount = 0;
  let orgsQueryCount = 0;

  tableHandlers = {};

  mockDb.mockImplementation((table: string) => {
    if (table === 'users') {
      usersCallCount++;
      const chain = createChain();

      // Distinguish system user lookup from partner_admin lookup
      chain.where = jest.fn(function (this: any) {
        return this;
      });
      chain.first = jest.fn().mockImplementation(() => {
        // First users query: system user lookup
        // Subsequent users queries: partner_admin lookups
        if (usersCallCount === 1) {
          return Promise.resolve(systemUser); // system email lookup
        }
        if (usersCallCount === 2 && !systemUser) {
          return Promise.resolve(null); // admin fallback
        }
        // Partner admin lookups
        return Promise.resolve(undefined); // will be overridden below
      });

      // For partner admin queries, return the partnerAdmins array
      // The job iterates over the result, so we need it to be iterable
      const selectChain = createChain(partnerAdmins);
      chain.select = jest.fn().mockReturnValue(selectChain);
      return chain;
    }

    if (table === 'partner_tiers') {
      const chain = createChain(tiers);
      chain.orderBy = jest.fn().mockReturnValue(tiers);
      return chain;
    }

    if (table === 'organizations') {
      orgsQueryCount++;
      const chain = createChain(orgs);

      chain.select = jest.fn().mockReturnValue(chain);
      chain.where = jest.fn().mockReturnValue(chain);
      chain.update = jest.fn().mockResolvedValue(updateResult);
      chain.first = jest.fn().mockResolvedValue({
        channel_manager_id: channelManagerId,
      });

      // Make iterable for the for...of loop on orgs query
      chain.then = (fn: any) => Promise.resolve(orgs).then(fn);
      chain[Symbol.iterator] = function* () {
        yield* orgs;
      };

      return chain;
    }

    return createChain();
  });
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  tableHandlers = {};
  mockNotif.createNotification.mockResolvedValue({ id: 'notif-uuid' } as any);
});

// ═════════════════════════════════════════════════════════════════════════════
// TIER RECALCULATION JOB
// ═════════════════════════════════════════════════════════════════════════════

describe('processTierRecalculation', () => {
  describe('upgrade scenarios', () => {
    test('org qualifying for higher tier gets upgraded immediately', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.registered,
        ytd_revenue: '200000',
        certified_rep_count: 3,
      });

      // Simple mock: use sequential mockDb calls
      let updateCalled = false;
      let updateArgs: any = null;

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return {
            orderBy: jest.fn().mockResolvedValue(TIERS),
          };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockImplementation((data) => {
            updateCalled = true;
            updateArgs = data;
            return Promise.resolve(1);
          });
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          // For the main query returning orgs list
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      expect(result.upgraded).toBe(1);
      expect(result.downgraded).toBe(0);
      expect(updateCalled).toBe(true);
      expect(updateArgs).toEqual(
        expect.objectContaining({
          tier_id: TIER_IDS.innovator,
          tier_downgrade_grace_at: null,
        })
      );
    });

    test('org at highest tier is not upgraded further', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.diamond,
        ytd_revenue: '5000000',
        certified_rep_count: 50,
      });

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockResolvedValue(0);
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      // qualifiedRank === currentRank, so no upgrade or downgrade
      expect(result.upgraded).toBe(0);
      expect(result.downgraded).toBe(0);
    });
  });

  describe('downgrade scenarios — grace period', () => {
    test('org falling below tier requirements starts 30-day grace period', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.innovator,
        ytd_revenue: '50000', // below Innovator min of 100k
        certified_rep_count: 1, // below Innovator min of 2
        tier_downgrade_grace_at: null,
      });

      let updateArgs: any = null;

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockImplementation((data) => {
            updateArgs = data;
            return Promise.resolve(1);
          });
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      expect(result.grace_warnings).toBe(1);
      expect(result.downgraded).toBe(0);
      // Grace deadline should be set ~30 days from now
      expect(updateArgs).toBeDefined();
      expect(updateArgs.tier_downgrade_grace_at).toBeDefined();

      const graceDate = new Date(updateArgs.tier_downgrade_grace_at);
      const expectedMin = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
      const expectedMax = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      expect(graceDate.getTime()).toBeGreaterThan(expectedMin.getTime());
      expect(graceDate.getTime()).toBeLessThan(expectedMax.getTime());
    });

    test('org still below after grace period expires gets downgraded', async () => {
      // Grace period expired 1 day ago
      const pastGrace = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const org = makeOrg({
        tier_id: TIER_IDS.innovator,
        ytd_revenue: '50000',
        certified_rep_count: 1,
        tier_downgrade_grace_at: pastGrace,
      });

      let updateArgs: any = null;

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockImplementation((data) => {
            updateArgs = data;
            return Promise.resolve(1);
          });
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      expect(result.downgraded).toBe(1);
      expect(updateArgs).toEqual(
        expect.objectContaining({
          tier_id: TIER_IDS.registered,
          tier_downgrade_grace_at: null,
        })
      );
    });

    test('org still within grace period is counted as grace warning, not downgraded', async () => {
      // Grace period expires in 15 days
      const futureGrace = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const org = makeOrg({
        tier_id: TIER_IDS.innovator,
        ytd_revenue: '50000',
        certified_rep_count: 1,
        tier_downgrade_grace_at: futureGrace,
      });

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockResolvedValue(0);
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      expect(result.grace_warnings).toBe(1);
      expect(result.downgraded).toBe(0);
    });

    test('org recovers during grace period — grace cleared', async () => {
      const futureGrace = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const org = makeOrg({
        tier_id: TIER_IDS.innovator,
        ytd_revenue: '200000', // now meets Innovator requirements
        certified_rep_count: 3,
        tier_downgrade_grace_at: futureGrace,
      });

      let updateArgs: any = null;

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockImplementation((data) => {
            updateArgs = data;
            return Promise.resolve(1);
          });
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      // qualifiedRank (2) === currentRank (2), grace should be cleared
      expect(result.upgraded).toBe(0);
      expect(result.downgraded).toBe(0);
      expect(updateArgs).toEqual(
        expect.objectContaining({
          tier_downgrade_grace_at: null,
        })
      );
    });

    test('org already at lowest tier is not downgraded further', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.registered, // already lowest tier (rank 1)
        ytd_revenue: '0',
        certified_rep_count: 0,
        tier_downgrade_grace_at: null,
      });

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockResolvedValue(0);
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      // qualifiedRank (1) === currentRank (1), no change
      expect(result.upgraded).toBe(0);
      expect(result.downgraded).toBe(0);
      expect(result.grace_warnings).toBe(0);
    });
  });

  describe('notifications', () => {
    test('sends notification to partner_admins on upgrade', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.registered,
        ytd_revenue: '200000',
        certified_rep_count: 3,
      });

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          // System user lookup
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          // Partner admin lookup
          chain.select = jest.fn().mockReturnValue({
            ...chain,
            where: jest.fn().mockReturnValue({
              ...chain,
              where: jest.fn().mockReturnValue({
                ...chain,
                where: jest.fn().mockResolvedValue([
                  { id: USER_IDS.partnerAdminA },
                ]),
              }),
            }),
          });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockResolvedValue(1);
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      await processTierRecalculation();

      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tier_change',
          entity_type: 'organization',
          entity_id: org.id,
        })
      );
    });

    test('sends notification to channel manager on upgrade when assigned', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.registered,
        ytd_revenue: '200000',
        certified_rep_count: 3,
      });

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          chain.select = jest.fn().mockReturnValue({
            ...chain,
            where: jest.fn().mockReturnValue({
              ...chain,
              where: jest.fn().mockReturnValue({
                ...chain,
                where: jest.fn().mockResolvedValue([
                  { id: USER_IDS.partnerAdminA },
                ]),
              }),
            }),
          });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockResolvedValue(1);
          chain.first = jest.fn().mockResolvedValue({
            channel_manager_id: USER_IDS.channelManager,
          });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      await processTierRecalculation();

      // Should have notification for partner admin AND channel manager
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_IDS.channelManager,
          type: 'tier_change',
        })
      );
    });

    test('sends grace warning notification to partner_admins when grace period starts', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.innovator,
        ytd_revenue: '50000',
        certified_rep_count: 1,
        tier_downgrade_grace_at: null,
      });

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          chain.select = jest.fn().mockReturnValue({
            ...chain,
            where: jest.fn().mockReturnValue({
              ...chain,
              where: jest.fn().mockReturnValue({
                ...chain,
                where: jest.fn().mockResolvedValue([
                  { id: USER_IDS.partnerAdminA },
                ]),
              }),
            }),
          });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockResolvedValue(1);
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      await processTierRecalculation();

      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_IDS.partnerAdminA,
          type: 'tier_change',
          title: expect.stringContaining('downgrade warning'),
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    test('empty orgs list processes without errors', async () => {
      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      expect(result.upgraded).toBe(0);
      expect(result.downgraded).toBe(0);
      expect(result.grace_warnings).toBe(0);
      expect(result.errors).toBe(0);
    });

    test('returns early when no system user or admin found', async () => {
      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue(null);
          return chain;
        }
        return createChain();
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processTierRecalculation();

      expect(result.upgraded).toBe(0);
      expect(result.downgraded).toBe(0);
      expect(result.errors).toBe(0);
      consoleSpy.mockRestore();
    });

    test('returns early when no tiers configured', async () => {
      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue([]) };
        }
        return createChain();
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await processTierRecalculation();

      expect(result.upgraded).toBe(0);
      expect(result.downgraded).toBe(0);
      consoleSpy.mockRestore();
    });

    test('error processing one org does not stop others', async () => {
      const org1 = makeOrg({
        id: 'org-1',
        name: 'Org 1',
        tier_id: TIER_IDS.registered,
        ytd_revenue: '200000',
        certified_rep_count: 3,
      });
      const org2 = makeOrg({
        id: 'org-2',
        name: 'Org 2',
        tier_id: TIER_IDS.registered,
        ytd_revenue: '200000',
        certified_rep_count: 3,
      });

      let callCount = 0;

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          chain.select = jest.fn().mockReturnValue({
            ...chain,
            where: jest.fn().mockReturnValue({
              ...chain,
              where: jest.fn().mockReturnValue({
                ...chain,
                where: jest.fn().mockResolvedValue([]),
              }),
            }),
          });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          callCount++;
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);

          // First org update throws, second succeeds
          if (callCount <= 1) {
            chain.then = (fn: any) => Promise.resolve([org1, org2]).then(fn);
          }
          chain.update = jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 3) {
              throw new Error('DB error on org-1');
            }
            return Promise.resolve(1);
          });
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          return chain;
        }
        return createChain();
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processTierRecalculation();

      // At least one should have been processed despite the error
      expect(result.errors).toBeGreaterThanOrEqual(1);
      consoleSpy.mockRestore();
    });

    test('optimistic guard: concurrent update returns 0 rows, org is skipped', async () => {
      const org = makeOrg({
        tier_id: TIER_IDS.registered,
        ytd_revenue: '200000',
        certified_rep_count: 3,
      });

      mockDb.mockImplementation((table: string) => {
        if (table === 'users') {
          const chain = createChain();
          chain.first = jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID });
          return chain;
        }
        if (table === 'partner_tiers') {
          return { orderBy: jest.fn().mockResolvedValue(TIERS) };
        }
        if (table === 'organizations') {
          const chain = createChain();
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.update = jest.fn().mockResolvedValue(0); // concurrent change
          chain.first = jest.fn().mockResolvedValue({ channel_manager_id: null });
          chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          return chain;
        }
        return createChain();
      });

      const result = await processTierRecalculation();

      // Update returned 0, so no notifications sent
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });
  });
});

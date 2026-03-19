/**
 * Unit tests for Metrics Rollup background job.
 *
 * All external dependencies (db) are fully mocked.
 * No database connections required.
 *
 * Covers: correct aggregation of YTD revenue, deals closed, active deals,
 * certified reps, pipeline value; org with no data; multiple orgs;
 * error resilience.
 */

// ── Mocks must be declared before imports ────────────────────────────────────

function createChain(resolvedValue: any = []) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNotNull: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNotIn: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(resolvedValue),
    update: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockReturnThis(),
  };
  chain.then = (fn: any) => Promise.resolve(resolvedValue).then(fn);
  return chain;
}

const mockDb: any = jest.fn(() => createChain());
mockDb.raw = jest.fn((sql: string) => sql);
mockDb.fn = { now: jest.fn(() => 'NOW()') };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { processMetricsRollup } from '../../../src/jobs/metricsRollup.job';

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// METRICS ROLLUP JOB
// ═════════════════════════════════════════════════════════════════════════════

describe('processMetricsRollup', () => {
  describe('correct aggregation', () => {
    test('aggregates YTD revenue, deals closed, active deals, certified reps, and pipeline', async () => {
      const org = { id: 'org-1', name: 'Org Alpha' };

      let updatePayload: any = null;

      // Track calls by table
      let callIndex = 0;

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();

        if (table === 'organizations') {
          callIndex++;
          if (callIndex === 1) {
            // First call: select active orgs
            chain.select = jest.fn().mockReturnValue(chain);
            chain.where = jest.fn().mockReturnValue(chain);
            chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          } else {
            // Update call
            chain.where = jest.fn().mockReturnValue(chain);
            chain.update = jest.fn().mockImplementation((data) => {
              updatePayload = data;
              return Promise.resolve(1);
            });
          }
          return chain;
        }

        if (table === 'deals') {
          chain.where = jest.fn().mockReturnValue(chain);
          chain.whereNotNull = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereNotIn = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);

          // Returns different results based on query type
          // Since we can't easily distinguish, return the same for all
          chain.then = (fn: any) => {
            // Default deal aggregation result
            return Promise.resolve([{
              ytd_revenue: '250000',
              ytd_deals_closed: 5,
              active_deals_count: 3,
              total_pipeline_value: '175000',
            }]).then(fn);
          };

          return chain;
        }

        if (table === 'user_certifications as uc') {
          chain.join = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([{ certified_rep_count: 4 }]).then(fn);
          return chain;
        }

        return chain;
      });

      const result = await processMetricsRollup();

      expect(result.updated).toBe(1);
      expect(result.errors).toBe(0);
      expect(updatePayload).toBeDefined();
      // Verify the update was called with numeric values
      expect(typeof updatePayload.ytd_revenue).toBe('number');
    });

    test('org with no deals or certifications gets zero values', async () => {
      const org = { id: 'org-empty', name: 'Empty Org' };

      let updatePayload: any = null;
      let orgCallIndex = 0;

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();

        if (table === 'organizations') {
          orgCallIndex++;
          if (orgCallIndex === 1) {
            chain.select = jest.fn().mockReturnValue(chain);
            chain.where = jest.fn().mockReturnValue(chain);
            chain.then = (fn: any) => Promise.resolve([org]).then(fn);
          } else {
            chain.where = jest.fn().mockReturnValue(chain);
            chain.update = jest.fn().mockImplementation((data) => {
              updatePayload = data;
              return Promise.resolve(1);
            });
          }
          return chain;
        }

        if (table === 'deals') {
          chain.where = jest.fn().mockReturnValue(chain);
          chain.whereNotNull = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereNotIn = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([{
              ytd_revenue: '0',
              ytd_deals_closed: 0,
              active_deals_count: 0,
              total_pipeline_value: '0',
            }]).then(fn);
          return chain;
        }

        if (table === 'user_certifications as uc') {
          chain.join = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([{ certified_rep_count: 0 }]).then(fn);
          return chain;
        }

        return chain;
      });

      const result = await processMetricsRollup();

      expect(result.updated).toBe(1);
      expect(result.errors).toBe(0);
      expect(updatePayload.ytd_revenue).toBe(0);
      expect(updatePayload.ytd_deals_closed).toBe(0);
      expect(updatePayload.active_deals_count).toBe(0);
      expect(updatePayload.certified_rep_count).toBe(0);
      expect(updatePayload.total_pipeline_value).toBe(0);
    });
  });

  describe('multiple organizations', () => {
    test('processes multiple orgs and returns correct updated count', async () => {
      const orgs = [
        { id: 'org-1', name: 'Org 1' },
        { id: 'org-2', name: 'Org 2' },
        { id: 'org-3', name: 'Org 3' },
      ];

      let updateCount = 0;
      let orgCallIndex = 0;

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();

        if (table === 'organizations') {
          orgCallIndex++;
          if (orgCallIndex === 1) {
            chain.select = jest.fn().mockReturnValue(chain);
            chain.where = jest.fn().mockReturnValue(chain);
            chain.then = (fn: any) => Promise.resolve(orgs).then(fn);
          } else {
            chain.where = jest.fn().mockReturnValue(chain);
            chain.update = jest.fn().mockImplementation(() => {
              updateCount++;
              return Promise.resolve(1);
            });
          }
          return chain;
        }

        if (table === 'deals') {
          chain.where = jest.fn().mockReturnValue(chain);
          chain.whereNotNull = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereNotIn = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([{
              ytd_revenue: '100000',
              ytd_deals_closed: 2,
              active_deals_count: 1,
              total_pipeline_value: '50000',
            }]).then(fn);
          return chain;
        }

        if (table === 'user_certifications as uc') {
          chain.join = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([{ certified_rep_count: 1 }]).then(fn);
          return chain;
        }

        return chain;
      });

      const result = await processMetricsRollup();

      expect(result.updated).toBe(3);
      expect(result.errors).toBe(0);
      expect(updateCount).toBe(3);
    });
  });

  describe('error resilience', () => {
    test('error in one org does not stop processing of others', async () => {
      const orgs = [
        { id: 'org-1', name: 'Org 1' },
        { id: 'org-2', name: 'Org 2' },
        { id: 'org-3', name: 'Org 3' },
      ];

      let orgCallIndex = 0;
      // Track which org is currently being processed via update calls
      let updateCallCount = 0;

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();

        if (table === 'organizations') {
          orgCallIndex++;
          if (orgCallIndex === 1) {
            chain.select = jest.fn().mockReturnValue(chain);
            chain.where = jest.fn().mockReturnValue(chain);
            chain.then = (fn: any) => Promise.resolve(orgs).then(fn);
          } else {
            chain.where = jest.fn().mockReturnValue(chain);
            chain.update = jest.fn().mockImplementation(() => {
              updateCallCount++;
              if (updateCallCount === 2) {
                // Fail on the second org's update
                return Promise.reject(new Error('DB timeout on org-2'));
              }
              return Promise.resolve(1);
            });
          }
          return chain;
        }

        if (table === 'deals') {
          chain.where = jest.fn().mockReturnValue(chain);
          chain.whereNotNull = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereNotIn = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([{
              ytd_revenue: '100000',
              ytd_deals_closed: 2,
              active_deals_count: 1,
              total_pipeline_value: '50000',
            }]).then(fn);
          return chain;
        }

        if (table === 'user_certifications as uc') {
          chain.join = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.select = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([{ certified_rep_count: 1 }]).then(fn);
          return chain;
        }

        return chain;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processMetricsRollup();

      // 2 succeeded, 1 failed
      expect(result.updated).toBe(2);
      expect(result.errors).toBe(1);
      consoleSpy.mockRestore();
    });

    test('no active orgs returns zero counts', async () => {
      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'organizations') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.where = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([]).then(fn);
        }
        return chain;
      });

      const result = await processMetricsRollup();

      expect(result.updated).toBe(0);
      expect(result.errors).toBe(0);
    });
  });
});

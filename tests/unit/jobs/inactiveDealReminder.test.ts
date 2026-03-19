/**
 * Unit tests for Inactive Deal Reminder background job.
 *
 * All external dependencies (db, notificationService) are fully mocked.
 * No database connections required.
 *
 * Covers: finding inactive deals, sending notifications, deduplication,
 * handling no inactive deals, and error resilience.
 */

// ── Mocks must be declared before imports ────────────────────────────────────

jest.mock('../../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn().mockResolvedValue({ id: 'notif-uuid' }),
    reminderExists: jest.fn().mockResolvedValue(false),
  },
}));

function createChain(resolvedValue: any = []) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(resolvedValue),
    update: jest.fn().mockResolvedValue(1),
  };
  chain.then = (fn: any) => Promise.resolve(resolvedValue).then(fn);
  return chain;
}

const mockDb: any = jest.fn(() => createChain());
mockDb.raw = jest.fn();
mockDb.fn = { now: jest.fn(() => 'NOW()') };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { processInactiveDealReminders } from '../../../src/jobs/inactiveDealReminder.job';
import notificationService from '../../../src/services/notification.service';
import { USER_IDS } from '../../fixtures/factories';

const mockNotif = notificationService as jest.Mocked<typeof notificationService>;

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeInactiveDeal(overrides: Record<string, any> = {}) {
  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  return {
    id: `deal-${Math.random().toString(36).slice(2, 8)}`,
    deal_number: `DR-2026-${String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0')}`,
    deal_name: 'Inactive Test Deal',
    submitted_by: USER_IDS.partnerRepA,
    updated_at: twentyDaysAgo.toISOString(),
    ...overrides,
  };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockNotif.createNotification.mockResolvedValue({ id: 'notif-uuid' } as any);
  mockNotif.reminderExists.mockResolvedValue(false);
});

// ═════════════════════════════════════════════════════════════════════════════
// INACTIVE DEAL REMINDER JOB
// ═════════════════════════════════════════════════════════════════════════════

describe('processInactiveDealReminders', () => {
  describe('finding and notifying inactive deals', () => {
    test('finds inactive deals with no activity for 14+ days and sends reminders', async () => {
      const deal = makeInactiveDeal({ deal_number: 'DR-2026-00042' });

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([deal]).then(fn);
        }
        return chain;
      });

      const result = await processInactiveDealReminders();

      expect(result.reminders_sent).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: deal.submitted_by,
          type: 'deal_update',
          title: expect.stringContaining('has had no activity for'),
          entity_type: 'deal',
          entity_id: deal.id,
          action_url: `/deals/${deal.id}`,
        })
      );
    });

    test('sends reminders to multiple inactive deals', async () => {
      const deal1 = makeInactiveDeal({ id: 'deal-1', deal_number: 'DR-2026-00001' });
      const deal2 = makeInactiveDeal({ id: 'deal-2', deal_number: 'DR-2026-00002' });
      const deal3 = makeInactiveDeal({ id: 'deal-3', deal_number: 'DR-2026-00003' });

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([deal1, deal2, deal3]).then(fn);
        }
        return chain;
      });

      const result = await processInactiveDealReminders();

      expect(result.reminders_sent).toBe(3);
      expect(mockNotif.createNotification).toHaveBeenCalledTimes(3);
    });

    test('notification body includes deal name and days-since count', async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deal = makeInactiveDeal({
        deal_name: 'Acme Firewall Refresh',
        deal_number: 'DR-2026-00042',
        updated_at: thirtyDaysAgo.toISOString(),
      });

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([deal]).then(fn);
        }
        return chain;
      });

      await processInactiveDealReminders();

      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('Acme Firewall Refresh'),
        })
      );
      // Title should contain the days count (~30)
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/has had no activity for \d+ days/),
        })
      );
    });
  });

  describe('deduplication', () => {
    test('does not send reminder if one was already sent (reminderExists = true)', async () => {
      const deal = makeInactiveDeal();

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([deal]).then(fn);
        }
        return chain;
      });

      // Reminder already exists
      mockNotif.reminderExists.mockResolvedValue(true);

      const result = await processInactiveDealReminders();

      expect(result.reminders_sent).toBe(0);
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });

    test('reminderExists is called with correct entity_type and title pattern', async () => {
      const deal = makeInactiveDeal({ id: 'deal-dedup' });

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([deal]).then(fn);
        }
        return chain;
      });

      mockNotif.reminderExists.mockResolvedValue(true);

      await processInactiveDealReminders();

      expect(mockNotif.reminderExists).toHaveBeenCalledWith(
        'deal',
        'deal-dedup',
        'has had no activity for',
        7,
      );
    });

    test('sends reminder for one deal but skips another that already has one', async () => {
      const deal1 = makeInactiveDeal({ id: 'deal-new' });
      const deal2 = makeInactiveDeal({ id: 'deal-already-notified' });

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([deal1, deal2]).then(fn);
        }
        return chain;
      });

      // First deal: no existing reminder; Second deal: already reminded
      mockNotif.reminderExists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await processInactiveDealReminders();

      expect(result.reminders_sent).toBe(1);
      expect(mockNotif.createNotification).toHaveBeenCalledTimes(1);
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ entity_id: 'deal-new' })
      );
    });
  });

  describe('no inactive deals', () => {
    test('handles no inactive deals gracefully', async () => {
      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([]).then(fn);
        }
        return chain;
      });

      const result = await processInactiveDealReminders();

      expect(result.reminders_sent).toBe(0);
      expect(result.errors).toBe(0);
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('error sending one reminder does not prevent others from being sent', async () => {
      const deal1 = makeInactiveDeal({ id: 'deal-1' });
      const deal2 = makeInactiveDeal({ id: 'deal-2' });
      const deal3 = makeInactiveDeal({ id: 'deal-3' });

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) =>
            Promise.resolve([deal1, deal2, deal3]).then(fn);
        }
        return chain;
      });

      mockNotif.createNotification
        .mockResolvedValueOnce({ id: 'notif-1' } as any)  // deal1 succeeds
        .mockRejectedValueOnce(new Error('DB error'))       // deal2 fails
        .mockResolvedValueOnce({ id: 'notif-3' } as any);  // deal3 succeeds

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processInactiveDealReminders();

      expect(result.reminders_sent).toBe(2);
      expect(result.errors).toBe(1);
      consoleSpy.mockRestore();
    });

    test('query failure returns error count', async () => {
      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockReturnValue(chain);
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any, rej: any) =>
            Promise.reject(new Error('Connection lost')).then(fn, rej);
        }
        return chain;
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processInactiveDealReminders();

      expect(result.reminders_sent).toBe(0);
      expect(result.errors).toBe(1);
      consoleSpy.mockRestore();
    });

    test('deals query queries only active statuses (draft, submitted, approved)', async () => {
      // The job should only look at deals in active statuses
      let whereInCalled = false;
      let whereInArgs: any = null;

      mockDb.mockImplementation((table: string) => {
        const chain = createChain();
        if (table === 'deals') {
          chain.select = jest.fn().mockReturnValue(chain);
          chain.whereIn = jest.fn().mockImplementation((col: string, vals: any[]) => {
            if (col === 'status') {
              whereInCalled = true;
              whereInArgs = vals;
            }
            return chain;
          });
          chain.whereRaw = jest.fn().mockReturnValue(chain);
          chain.then = (fn: any) => Promise.resolve([]).then(fn);
        }
        return chain;
      });

      await processInactiveDealReminders();

      expect(whereInCalled).toBe(true);
      expect(whereInArgs).toEqual(
        expect.arrayContaining(['draft', 'submitted', 'approved'])
      );
    });
  });
});

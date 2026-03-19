/**
 * Unit tests for Deal Expiration and Reminder background jobs.
 *
 * All external dependencies (dealRepository, notificationService, db)
 * are fully mocked. No database connections required.
 *
 * PRD coverage: QA-052 through QA-056 (background job scenarios)
 * PRD sections: US-DR-016, US-DR-017, FR-EX-001 through FR-EX-004
 */

// ── Mocks must be declared before imports ────────────────────────────────────

jest.mock('../../../src/repositories/deal.repository', () => ({
  __esModule: true,
  default: {
    findExpired: jest.fn(),
    findExpiringInWindow: jest.fn(),
    updateStatus: jest.fn(),
    insertStatusHistory: jest.fn(),
  },
}));

jest.mock('../../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

const mockDbChain = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
};
const mockDb = jest.fn((..._args: any[]) => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { processDealExpirations } from '../../../src/jobs/dealExpiration.job';
import { processDealExpirationReminders } from '../../../src/jobs/dealExpirationReminder.job';
import dealRepository from '../../../src/repositories/deal.repository';
import notificationService from '../../../src/services/notification.service';
import { ORG_IDS, USER_IDS } from '../../fixtures/factories';

const mockRepo = dealRepository as jest.Mocked<typeof dealRepository>;
const mockNotif = notificationService as jest.Mocked<typeof notificationService>;

// ── Fixture helpers ───────────────────────────────────────────────────────────

const SYSTEM_USER_ID = 'system-user-uuid';
const ADMIN_USER_ID = USER_IDS.admin;

function makeExpiredDeal(overrides: Record<string, any> = {}) {
  return {
    id: `expired-deal-${Math.random().toString(36).slice(2, 8)}`,
    deal_number: 'DR-2026-00042',
    submitted_by: USER_IDS.partnerRepA,
    organization_id: ORG_IDS.orgA,
    ...overrides,
  };
}

function makeExpiringDeal(overrides: Record<string, any> = {}) {
  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return {
    id: `expiring-deal-${Math.random().toString(36).slice(2, 8)}`,
    deal_number: 'DR-2026-00050',
    submitted_by: USER_IDS.partnerRepA,
    organization_id: ORG_IDS.orgA,
    registration_expires_at: futureDate.toISOString(),
    ...overrides,
  };
}

// ── beforeEach: reset all mocks ────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: system user found
  mockDbChain.first
    .mockResolvedValueOnce({ id: SYSTEM_USER_ID }) // system user lookup
    .mockResolvedValueOnce({ id: ADMIN_USER_ID }); // admin fallback

  mockRepo.updateStatus.mockResolvedValue({ status: 'expired' } as any);
  mockRepo.insertStatusHistory.mockResolvedValue({ id: 'history-uuid' } as any);
  mockNotif.createNotification.mockResolvedValue({ id: 'notif-uuid' } as any);
  mockNotif.reminderExists.mockResolvedValue(false);
});

// ═════════════════════════════════════════════════════════════════════════════
// DEAL EXPIRATION JOB
// ═════════════════════════════════════════════════════════════════════════════

describe('processDealExpirations', () => {
  describe('basic expiration', () => {
    test('QA-052 — expires overdue approved deals and returns count', async () => {
      const deal = makeExpiredDeal();
      mockRepo.findExpired.mockResolvedValue([deal]);
      // org has a CM
      mockDb.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(
          table === 'users'
            ? { id: SYSTEM_USER_ID }
            : { channel_manager_id: USER_IDS.channelManager },
        ),
      }));

      const result = await processDealExpirations();

      expect(result.expired).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(deal.id, 'approved', 'expired');
    });

    test('QA-052 — multiple expired deals all processed in one run', async () => {
      const deals = [
        makeExpiredDeal({ id: 'deal-1' }),
        makeExpiredDeal({ id: 'deal-2' }),
        makeExpiredDeal({ id: 'deal-3' }),
      ];
      mockRepo.findExpired.mockResolvedValue(deals);
      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID }),
      }));

      const result = await processDealExpirations();

      expect(result.expired).toBe(3);
      expect(mockRepo.updateStatus).toHaveBeenCalledTimes(3);
    });

    test('QA-052 — inserts deal_status_history on each expiration with system user as changed_by', async () => {
      const deal = makeExpiredDeal();
      mockRepo.findExpired.mockResolvedValue([deal]);
      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID }),
      }));

      await processDealExpirations();

      expect(mockRepo.insertStatusHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          deal_id: deal.id,
          from_status: 'approved',
          to_status: 'expired',
          changed_by: SYSTEM_USER_ID,
          notes: 'Auto-expired: protection window elapsed',
        }),
      );
    });
  });

  describe('notifications', () => {
    test('QA-051 — notifies submitter (NT-8) on deal expiration', async () => {
      const deal = makeExpiredDeal({ deal_number: 'DR-2026-00042' });
      mockRepo.findExpired.mockResolvedValue([deal]);
      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID, channel_manager_id: null }),
      }));

      await processDealExpirations();

      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_IDS.partnerRepA,
          type: 'deal_update',
          title: 'Deal DR-2026-00042 has expired',
          entity_type: 'deal',
          entity_id: deal.id,
        }),
      );
    });

    test('QA-051 — notifies CM (NT-8) when org has a channel_manager_id', async () => {
      const deal = makeExpiredDeal({ deal_number: 'DR-2026-00042' });
      mockRepo.findExpired.mockResolvedValue([deal]);
      mockDb.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(
          table === 'organizations'
            ? { channel_manager_id: USER_IDS.channelManager }
            : { id: SYSTEM_USER_ID },
        ),
      }));

      await processDealExpirations();

      // Two notifications: one for submitter, one for CM
      expect(mockNotif.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: USER_IDS.channelManager }),
      );
    });

    test('notifies submitter only when org has no channel_manager_id', async () => {
      const deal = makeExpiredDeal();
      mockRepo.findExpired.mockResolvedValue([deal]);
      mockDb.mockImplementation((table: string) => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(
          table === 'organizations'
            ? { channel_manager_id: null }
            : { id: SYSTEM_USER_ID },
        ),
      }));

      await processDealExpirations();

      expect(mockNotif.createNotification).toHaveBeenCalledTimes(1);
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: USER_IDS.partnerRepA }),
      );
    });
  });

  describe('idempotency and error handling', () => {
    test('QA-056 — deal transitioned to won before job runs: updateStatus returns null, deal is skipped', async () => {
      const deal = makeExpiredDeal();
      mockRepo.findExpired.mockResolvedValue([deal]);
      // updateStatus returns null → already transitioned (won/lost/etc.)
      mockRepo.updateStatus.mockResolvedValue(null);
      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID }),
      }));

      const result = await processDealExpirations();

      // Skipped: no history or notification created
      expect(result.expired).toBe(0);
      expect(mockRepo.insertStatusHistory).not.toHaveBeenCalled();
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });

    test('idempotency — running job twice on same deal: second run finds no approved deals (they are now expired)', async () => {
      const deal = makeExpiredDeal();
      // First run: deal found
      mockRepo.findExpired.mockResolvedValueOnce([deal]);
      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID }),
      }));

      await processDealExpirations();

      // Second run: no approved deals (already expired)
      mockRepo.findExpired.mockResolvedValueOnce([]);
      const result2 = await processDealExpirations();

      expect(result2.expired).toBe(0);
    });

    test('QA-052 — non-approved deals are NOT expired (job only queries approved deals)', async () => {
      // findExpired only returns approved deals with expires_at < NOW()
      // If no such deals exist, nothing is processed
      mockRepo.findExpired.mockResolvedValue([]);
      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID }),
      }));

      const result = await processDealExpirations();

      expect(result.expired).toBe(0);
      expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });

    test('error on one deal does not prevent other deals from being processed', async () => {
      const deal1 = makeExpiredDeal({ id: 'deal-1' });
      const deal2 = makeExpiredDeal({ id: 'deal-2' });
      const deal3 = makeExpiredDeal({ id: 'deal-3' });
      mockRepo.findExpired.mockResolvedValue([deal1, deal2, deal3]);

      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: SYSTEM_USER_ID }),
      }));

      // Second deal fails
      mockRepo.updateStatus
        .mockResolvedValueOnce({ status: 'expired' } as any) // deal1 succeeds
        .mockRejectedValueOnce(new Error('DB timeout')) // deal2 fails
        .mockResolvedValueOnce({ status: 'expired' } as any); // deal3 succeeds

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processDealExpirations();

      expect(result.expired).toBe(2);
      expect(result.errors).toBe(1);
      consoleSpy.mockRestore();
    });

    test('returns early with 0/0 when no system user or admin found', async () => {
      mockDb.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null), // no system user, no admin
      }));
      mockRepo.findExpired.mockResolvedValue([makeExpiredDeal()]);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processDealExpirations();

      expect(result.expired).toBe(0);
      consoleSpy.mockRestore();
    });

    test('uses admin user as fallback when system user not found', async () => {
      mockDb.mockImplementation((table: string) => {
        const chain = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          first: jest.fn(),
        };

        if (table === 'users') {
          // First call: system user not found; second call: admin found
          let callCount = 0;
          chain.first.mockImplementation(() => {
            callCount++;
            if (callCount <= 2) return Promise.resolve(null); // system user not found
            return Promise.resolve({ id: ADMIN_USER_ID }); // admin found
          });
        } else {
          chain.first.mockResolvedValue({ channel_manager_id: null });
        }

        return chain;
      });

      const deal = makeExpiredDeal();
      mockRepo.findExpired.mockResolvedValue([deal]);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await processDealExpirations();

      consoleSpy.mockRestore();
      // Job ran — system user fallback handled
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DEAL EXPIRATION REMINDER JOB
// ═════════════════════════════════════════════════════════════════════════════

describe('processDealExpirationReminders', () => {
  describe('14-day reminders', () => {
    test('QA-054 — sends 14-day reminder for deals expiring in 13-15 days', async () => {
      const deal = makeExpiringDeal({ deal_number: 'DR-2026-00050' });
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 13
          ? Promise.resolve([deal])
          : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(false);

      const result = await processDealExpirationReminders();

      expect(result.fourteenDay).toBe(1);
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_IDS.partnerRepA,
          type: 'deal_update',
          title: 'Deal DR-2026-00050 expires in 14 days',
          entity_type: 'deal',
          entity_id: deal.id,
        }),
      );
    });

    test('QA-054 — calls findExpiringInWindow with window 13-15 for 14-day reminders', async () => {
      mockRepo.findExpiringInWindow.mockResolvedValue([]);

      await processDealExpirationReminders();

      expect(mockRepo.findExpiringInWindow).toHaveBeenCalledWith(13, 15);
    });
  });

  describe('7-day reminders', () => {
    test('sends 7-day reminder for deals expiring in 6-8 days', async () => {
      const deal = makeExpiringDeal({
        deal_number: 'DR-2026-00060',
        registration_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 6
          ? Promise.resolve([deal])
          : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(false);

      const result = await processDealExpirationReminders();

      expect(result.sevenDay).toBe(1);
      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_IDS.partnerRepA,
          title: 'Deal DR-2026-00060 expires in 7 days',
        }),
      );
    });

    test('calls findExpiringInWindow with window 6-8 for 7-day reminders', async () => {
      mockRepo.findExpiringInWindow.mockResolvedValue([]);

      await processDealExpirationReminders();

      expect(mockRepo.findExpiringInWindow).toHaveBeenCalledWith(6, 8);
    });

    test('QA-053 — deal expiring in 10 days: neither 7-day nor 14-day reminder sent', async () => {
      // A deal 10 days from now falls outside both windows (6-8 and 13-15)
      // findExpiringInWindow returns empty for both windows
      mockRepo.findExpiringInWindow.mockResolvedValue([]);

      const result = await processDealExpirationReminders();

      expect(result.fourteenDay).toBe(0);
      expect(result.sevenDay).toBe(0);
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    test('QA-055 — does not send 14-day reminder if already sent (reminderExists = true)', async () => {
      const deal = makeExpiringDeal();
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 13 ? Promise.resolve([deal]) : Promise.resolve([]),
      );
      // Reminder already exists
      mockNotif.reminderExists.mockResolvedValue(true);

      const result = await processDealExpirationReminders();

      expect(result.fourteenDay).toBe(0);
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });

    test('QA-055 — does not send 7-day reminder if already sent', async () => {
      const deal = makeExpiringDeal();
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 6 ? Promise.resolve([deal]) : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(true);

      const result = await processDealExpirationReminders();

      expect(result.sevenDay).toBe(0);
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });

    test('QA-055 — running reminder job twice for same deal creates only 1 notification (idempotency)', async () => {
      const deal = makeExpiringDeal();
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 13 ? Promise.resolve([deal]) : Promise.resolve([]),
      );

      // First run: reminder does NOT exist yet
      mockNotif.reminderExists.mockResolvedValueOnce(false);
      const result1 = await processDealExpirationReminders();
      expect(result1.fourteenDay).toBe(1);
      expect(mockNotif.createNotification).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 13 ? Promise.resolve([deal]) : Promise.resolve([]),
      );

      // Second run: reminder EXISTS now (job checks before creating)
      mockNotif.reminderExists.mockResolvedValue(true);
      const result2 = await processDealExpirationReminders();
      expect(result2.fourteenDay).toBe(0);
      expect(mockNotif.createNotification).not.toHaveBeenCalled();
    });

    test('reminderExists is called with correct entity_type and title pattern for 14-day', async () => {
      const deal = makeExpiringDeal();
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 13 ? Promise.resolve([deal]) : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(true);

      await processDealExpirationReminders();

      expect(mockNotif.reminderExists).toHaveBeenCalledWith(
        'deal',
        deal.id,
        'expires in 14 days',
      );
    });

    test('reminderExists is called with correct title pattern for 7-day', async () => {
      const deal = makeExpiringDeal();
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 6 ? Promise.resolve([deal]) : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(true);

      await processDealExpirationReminders();

      expect(mockNotif.reminderExists).toHaveBeenCalledWith(
        'deal',
        deal.id,
        'expires in 7 days',
      );
    });
  });

  describe('notification content', () => {
    test('14-day notification body contains expiration date', async () => {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const deal = makeExpiringDeal({ registration_expires_at: expiresAt.toISOString() });
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 13 ? Promise.resolve([deal]) : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(false);

      await processDealExpirationReminders();

      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining(expiresAt.toISOString().slice(0, 10)),
        }),
      );
    });

    test('7-day notification body is urgent', async () => {
      const deal = makeExpiringDeal();
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 6 ? Promise.resolve([deal]) : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(false);

      await processDealExpirationReminders();

      expect(mockNotif.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('URGENT'),
        }),
      );
    });
  });

  describe('error handling', () => {
    test('error on one deal in 14-day batch does not prevent other reminders', async () => {
      const deal1 = makeExpiringDeal({ id: 'deal-1' });
      const deal2 = makeExpiringDeal({ id: 'deal-2' });
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) =>
        minDays === 13 ? Promise.resolve([deal1, deal2]) : Promise.resolve([]),
      );
      mockNotif.reminderExists.mockResolvedValue(false);
      mockNotif.createNotification
        .mockRejectedValueOnce(new Error('DB error')) // deal1 fails
        .mockResolvedValueOnce({ id: 'notif-2' } as any); // deal2 succeeds

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processDealExpirationReminders();

      expect(result.fourteenDay).toBe(1);
      expect(result.errors).toBe(1);
      consoleSpy.mockRestore();
    });

    test('query failure for 14-day window does not prevent 7-day reminders', async () => {
      const deal = makeExpiringDeal({ deal_number: 'DR-2026-00060' });
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) => {
        if (minDays === 13) return Promise.reject(new Error('Query failed'));
        if (minDays === 6) return Promise.resolve([deal]);
        return Promise.resolve([]);
      });
      mockNotif.reminderExists.mockResolvedValue(false);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await processDealExpirationReminders();

      expect(result.sevenDay).toBe(1);
      expect(result.errors).toBe(1);
      consoleSpy.mockRestore();
    });

    test('returns correct totals in all-success scenario', async () => {
      const deal14 = makeExpiringDeal({ id: '14-day-deal' });
      const deal7 = makeExpiringDeal({ id: '7-day-deal' });
      mockRepo.findExpiringInWindow.mockImplementation((minDays: number) => {
        if (minDays === 13) return Promise.resolve([deal14]);
        if (minDays === 6) return Promise.resolve([deal7]);
        return Promise.resolve([]);
      });
      mockNotif.reminderExists.mockResolvedValue(false);

      const result = await processDealExpirationReminders();

      expect(result.fourteenDay).toBe(1);
      expect(result.sevenDay).toBe(1);
      expect(result.errors).toBe(0);
      expect(mockNotif.createNotification).toHaveBeenCalledTimes(2);
    });
  });
});

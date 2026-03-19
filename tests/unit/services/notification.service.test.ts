/**
 * Unit tests for NotificationService.
 *
 * All external dependencies (notificationRepository, db) are fully mocked.
 *
 * Coverage: List notifications, unread count, mark read (idempotent),
 * mark all read, delete, cross-user access prevention.
 */

// -- Mocks must be declared before any imports --

jest.mock('../../../src/repositories/notification.repository', () => ({
  __esModule: true,
  default: {
    findByUserId: jest.fn(),
    countUnread: jest.fn(),
    findByIdAndUser: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockDbChain: any = {
  insert: jest.fn().mockReturnThis(),
  returning: jest.fn(),
  where: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  first: jest.fn(),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// -- Imports --

import notificationService from '../../../src/services/notification.service';
import notificationRepository from '../../../src/repositories/notification.repository';
import { AppError } from '../../../src/utils/AppError';
import { USER_IDS } from '../../fixtures/factories';

const mockRepo = notificationRepository as jest.Mocked<typeof notificationRepository>;

// -- Helpers --

const USER_A = USER_IDS.partnerRepA;
const USER_B = USER_IDS.partnerAdminB;

function makeNotification(overrides: Record<string, any> = {}) {
  return {
    id: 'notif-uuid-1',
    user_id: USER_A,
    type: 'deal_update',
    title: 'Deal approved',
    body: 'Your deal DR-2026-00042 has been approved.',
    entity_type: 'deal',
    entity_id: 'deal-uuid-1',
    is_read: false,
    read_at: null,
    action_url: '/deals/deal-uuid-1',
    created_at: new Date(),
    ...overrides,
  };
}

// -- Tests --

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // CREATE
  // =========================================================================

  describe('createNotification', () => {
    it('should insert a notification into the database', async () => {
      const notif = makeNotification();
      mockDbChain.returning.mockResolvedValue([notif]);

      const result = await notificationService.createNotification({
        user_id: USER_A,
        type: 'deal_update',
        title: 'Deal approved',
        body: 'Your deal has been approved.',
        entity_type: 'deal',
        entity_id: 'deal-uuid-1',
        action_url: '/deals/deal-uuid-1',
      });

      expect(mockDb).toHaveBeenCalledWith('notifications');
      expect(mockDbChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: USER_A,
          type: 'deal_update',
          title: 'Deal approved',
          is_read: false,
        }),
      );
      expect(result.id).toBe('notif-uuid-1');
    });

    it('should set optional fields to null when not provided', async () => {
      const notif = makeNotification({ body: null, entity_type: null, entity_id: null, action_url: null });
      mockDbChain.returning.mockResolvedValue([notif]);

      await notificationService.createNotification({
        user_id: USER_A,
        type: 'system_announcement',
        title: 'System maintenance',
      });

      expect(mockDbChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          body: null,
          entity_type: null,
          entity_id: null,
          action_url: null,
        }),
      );
    });
  });

  // =========================================================================
  // REMINDER DEDUPLICATION
  // =========================================================================

  describe('reminderExists', () => {
    it('should return true when matching notification exists', async () => {
      mockDbChain.count.mockReturnThis();
      mockDbChain.where.mockReturnThis();
      // The method does: db('notifications').where().where().where().count()
      // We need the final result to be [{ total: '1' }]
      // But the method actually chains differently. Let's mock the full chain.
      // Actually the method does: const [result] = await db(...)...count('* as total')
      // The count returns a query. We can mock the await to return [{ total: '1' }].

      // Re-mock for this specific test
      const countResult = [{ total: '1' }];
      // Override the implicit await on the chain
      mockDbChain[Symbol.for('jest.async')] = true;
      // Actually the simplest approach: mockDb returns the chain, and the chain is thenable
      const promiseChain = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockResolvedValue(countResult),
      };
      promiseChain.where.mockReturnThis();
      mockDb.mockReturnValueOnce(promiseChain as any);

      const result = await notificationService.reminderExists(
        'certification',
        'cert-uuid-1',
        'expires in 30 day',
      );

      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // LIST
  // =========================================================================

  describe('listNotifications', () => {
    it('should return paginated notifications for user', async () => {
      const notifs = [makeNotification(), makeNotification({ id: 'notif-uuid-2' })];
      mockRepo.findByUserId.mockResolvedValue({ data: notifs, total: 2 });

      const result = await notificationService.listNotifications(
        USER_A,
        {},
        { offset: 0, limit: 25 },
      );

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockRepo.findByUserId).toHaveBeenCalledWith(USER_A, {}, { offset: 0, limit: 25 });
    });

    it('should apply type filter', async () => {
      mockRepo.findByUserId.mockResolvedValue({ data: [], total: 0 });

      await notificationService.listNotifications(
        USER_A,
        { type: 'deal_update' },
        { offset: 0, limit: 25 },
      );

      expect(mockRepo.findByUserId).toHaveBeenCalledWith(
        USER_A,
        { type: 'deal_update' },
        { offset: 0, limit: 25 },
      );
    });

    it('should apply is_read filter', async () => {
      mockRepo.findByUserId.mockResolvedValue({ data: [], total: 0 });

      await notificationService.listNotifications(
        USER_A,
        { is_read: false },
        { offset: 0, limit: 25 },
      );

      expect(mockRepo.findByUserId).toHaveBeenCalledWith(
        USER_A,
        { is_read: false },
        { offset: 0, limit: 25 },
      );
    });
  });

  // =========================================================================
  // UNREAD COUNT
  // =========================================================================

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      mockRepo.countUnread.mockResolvedValue(5);

      const result = await notificationService.getUnreadCount(USER_A);

      expect(result).toBe(5);
      expect(mockRepo.countUnread).toHaveBeenCalledWith(USER_A);
    });

    it('should return 0 when no unread notifications', async () => {
      mockRepo.countUnread.mockResolvedValue(0);

      const result = await notificationService.getUnreadCount(USER_A);

      expect(result).toBe(0);
    });
  });

  // =========================================================================
  // MARK READ
  // =========================================================================

  describe('markRead', () => {
    it('should mark unread notification as read', async () => {
      const notif = makeNotification({ is_read: false });
      const readNotif = { ...notif, is_read: true, read_at: new Date() };
      mockRepo.findByIdAndUser.mockResolvedValue(notif);
      mockRepo.markRead.mockResolvedValue(readNotif);

      const result = await notificationService.markRead('notif-uuid-1', USER_A);

      expect(result.is_read).toBe(true);
      expect(mockRepo.markRead).toHaveBeenCalledWith('notif-uuid-1', USER_A);
    });

    it('should be idempotent - return as-is if already read', async () => {
      const notif = makeNotification({ is_read: true, read_at: new Date() });
      mockRepo.findByIdAndUser.mockResolvedValue(notif);

      const result = await notificationService.markRead('notif-uuid-1', USER_A);

      expect(result.is_read).toBe(true);
      expect(mockRepo.markRead).not.toHaveBeenCalled();
    });

    it('should throw NOTIFICATION_NOT_FOUND for nonexistent notification', async () => {
      mockRepo.findByIdAndUser.mockResolvedValue(undefined);

      await expect(
        notificationService.markRead('bad-id', USER_A),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOTIFICATION_NOT_FOUND',
      });
    });

    it('should not allow user to read another users notification (returns 404)', async () => {
      // findByIdAndUser filters by userId, so another user's notif returns undefined
      mockRepo.findByIdAndUser.mockResolvedValue(undefined);

      await expect(
        notificationService.markRead('notif-uuid-1', USER_B),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOTIFICATION_NOT_FOUND',
      });
    });
  });

  // =========================================================================
  // MARK ALL READ
  // =========================================================================

  describe('markAllRead', () => {
    it('should mark all unread notifications as read', async () => {
      mockRepo.markAllRead.mockResolvedValue(3);

      const result = await notificationService.markAllRead(USER_A);

      expect(result).toBe(3);
      expect(mockRepo.markAllRead).toHaveBeenCalledWith(USER_A);
    });

    it('should return 0 when no unread notifications exist', async () => {
      mockRepo.markAllRead.mockResolvedValue(0);

      const result = await notificationService.markAllRead(USER_A);

      expect(result).toBe(0);
    });
  });

  // =========================================================================
  // DELETE
  // =========================================================================

  describe('deleteNotification', () => {
    it('should delete an existing notification', async () => {
      mockRepo.delete.mockResolvedValue(true);

      // Should not throw
      await notificationService.deleteNotification('notif-uuid-1', USER_A);

      expect(mockRepo.delete).toHaveBeenCalledWith('notif-uuid-1', USER_A);
    });

    it('should throw NOTIFICATION_NOT_FOUND when deletion fails (not found or wrong user)', async () => {
      mockRepo.delete.mockResolvedValue(false);

      await expect(
        notificationService.deleteNotification('bad-id', USER_A),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOTIFICATION_NOT_FOUND',
      });
    });

    it('should not allow deleting another users notification', async () => {
      // delete filters by userId, so wrong user returns false
      mockRepo.delete.mockResolvedValue(false);

      await expect(
        notificationService.deleteNotification('notif-uuid-1', USER_B),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOTIFICATION_NOT_FOUND',
      });
    });
  });
});

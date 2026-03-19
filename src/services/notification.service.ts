import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import notificationRepository, { NotificationFilters } from '../repositories/notification.repository';
import { AppError } from '../utils/AppError';

export interface CreateNotificationParams {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
}

class NotificationService {
  /**
   * Insert a notification record into the notifications table.
   */
  async createNotification(params: CreateNotificationParams) {
    const id = uuidv4();
    const [notification] = await db('notifications')
      .insert({
        id,
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        body: params.body || null,
        entity_type: params.entity_type || null,
        entity_id: params.entity_id || null,
        action_url: params.action_url || null,
        is_read: false,
      })
      .returning('*');
    return notification;
  }

  /**
   * Check if a notification with a given title pattern already exists.
   * Used for deduplicating reminder notifications.
   */
  async reminderExists(
    entityType: string,
    entityId: string,
    titlePattern: string,
    withinDays?: number,
  ): Promise<boolean> {
    const query = db('notifications')
      .where('entity_type', entityType)
      .where('entity_id', entityId)
      .where('title', 'like', `%${titlePattern}%`);

    if (withinDays !== undefined) {
      query.whereRaw('created_at > NOW() - ?::interval', [`${withinDays} days`]);
    }

    const [result] = await query.count('* as total');
    return parseInt(result.total as string, 10) > 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 7: Full notification CRUD
  // ═══════════════════════════════════════════════════════════════════════

  async listNotifications(
    userId: string,
    filters: NotificationFilters,
    pagination: { offset: number; limit: number },
  ) {
    return notificationRepository.findByUserId(userId, filters, pagination);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  }

  async markRead(id: string, userId: string) {
    const notification = await notificationRepository.findByIdAndUser(id, userId);
    if (!notification) {
      throw AppError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }

    // Idempotent: if already read, return as-is
    if (notification.is_read) {
      return notification;
    }

    return notificationRepository.markRead(id, userId);
  }

  async markAllRead(userId: string): Promise<number> {
    return notificationRepository.markAllRead(userId);
  }

  async deleteNotification(id: string, userId: string) {
    const deleted = await notificationRepository.delete(id, userId);
    if (!deleted) {
      throw AppError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
    }
  }
}

export default new NotificationService();

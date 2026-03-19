import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface NotificationFilters {
  type?: string;
  is_read?: boolean;
  since?: string;
}

export class NotificationRepository {
  async findByUserId(
    userId: string,
    filters: NotificationFilters,
    pagination: { offset: number; limit: number },
  ) {
    let query = db('notifications')
      .where('user_id', userId)
      .select('*');

    let countQuery = db('notifications')
      .where('user_id', userId)
      .count('* as total');

    const applyFilters = (q: any) => {
      if (filters.type) {
        q = q.where('type', filters.type);
      }
      if (filters.is_read !== undefined) {
        q = q.where('is_read', filters.is_read);
      }
      if (filters.since) {
        q = q.where('created_at', '>=', filters.since);
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    query = query
      .orderBy('created_at', 'desc')
      .offset(pagination.offset)
      .limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  async countUnread(userId: string): Promise<number> {
    const [result] = await db('notifications')
      .where('user_id', userId)
      .where('is_read', false)
      .count('* as count');
    return parseInt(result.count as string, 10);
  }

  async findByIdAndUser(id: string, userId: string) {
    return db('notifications')
      .where('id', id)
      .where('user_id', userId)
      .first();
  }

  async markRead(id: string, userId: string) {
    const [updated] = await db('notifications')
      .where('id', id)
      .where('user_id', userId)
      .update({ is_read: true, read_at: db.fn.now() })
      .returning('*');
    return updated || null;
  }

  async markAllRead(userId: string): Promise<number> {
    return db('notifications')
      .where('user_id', userId)
      .where('is_read', false)
      .update({ is_read: true, read_at: db.fn.now() });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const count = await db('notifications')
      .where('id', id)
      .where('user_id', userId)
      .delete();
    return count > 0;
  }
}

export default new NotificationRepository();

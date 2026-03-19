import { Request, Response, NextFunction } from 'express';
import notificationService from '../services/notification.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class NotificationController {
  // GET /notifications
  async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        type: req.query.type as string | undefined,
        is_read: req.query.is_read !== undefined
          ? req.query.is_read === 'true'
          : undefined,
        since: req.query.since as string | undefined,
      };

      const { data, total } = await notificationService.listNotifications(
        req.user!.sub,
        filters,
        pagination,
      );

      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  // GET /notifications/unread-count
  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await notificationService.getUnreadCount(req.user!.sub);
      sendSuccess(res, { count }, 200);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /notifications/:id/read
  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const notification = await notificationService.markRead(req.params.id as string, req.user!.sub);
      sendSuccess(res, notification, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /notifications/mark-all-read
  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const updatedCount = await notificationService.markAllRead(req.user!.sub);
      sendSuccess(res, { updated_count: updatedCount }, 200);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /notifications/:id
  async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationService.deleteNotification(req.params.id as string, req.user!.sub);
      sendSuccess(res, { deleted: true }, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new NotificationController();

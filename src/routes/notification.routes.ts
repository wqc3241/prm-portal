import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  notificationIdParamSchema,
  listNotificationsQuerySchema,
} from '../validators/notification.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICATION ROUTES
// ═══════════════════════════════════════════════════════════════════════

// Static routes first (before :id param)

// GET /notifications/unread-count — unread count for badge
router.get(
  '/unread-count',
  notificationController.getUnreadCount,
);

// POST /notifications/mark-all-read — mark all as read
router.post(
  '/mark-all-read',
  notificationController.markAllRead,
);

// GET /notifications — list user's notifications
router.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  notificationController.listNotifications,
);

// PATCH /notifications/:id/read — mark single as read
router.patch(
  '/:id/read',
  validate(notificationIdParamSchema, 'params'),
  notificationController.markRead,
);

// DELETE /notifications/:id — delete notification
router.delete(
  '/:id',
  validate(notificationIdParamSchema, 'params'),
  notificationController.deleteNotification,
);

export default router;

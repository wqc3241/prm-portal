import Joi from 'joi';
import { NOTIFICATION_TYPES } from '../config/constants';

// --- Param schemas ---

export const notificationIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

// --- Query schemas ---

export const listNotificationsQuerySchema = Joi.object({
  type: Joi.string().valid(...NOTIFICATION_TYPES).optional(),
  is_read: Joi.string().valid('true', 'false').optional(),
  since: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
}).unknown(false);

import Joi from 'joi';
import { USER_ROLES } from '../config/constants';

export const createUserSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  first_name: Joi.string().trim().min(1).max(100).required(),
  last_name: Joi.string().trim().min(1).max(100).required(),
  role: Joi.string().valid(...USER_ROLES).required(),
  organization_id: Joi.string().uuid().optional().allow(null),
  title: Joi.string().trim().max(200).allow(null, '').optional(),
  phone: Joi.string().trim().max(50).allow(null, '').optional(),
});

export const updateUserSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(100).optional(),
  last_name: Joi.string().trim().min(1).max(100).optional(),
  role: Joi.string().valid(...USER_ROLES).optional(),
  title: Joi.string().trim().max(200).allow(null, '').optional(),
  phone: Joi.string().trim().max(50).allow(null, '').optional(),
  avatar_url: Joi.string().trim().max(500).allow(null, '').optional(),
  is_active: Joi.boolean().optional(),
  organization_id: Joi.string().uuid().optional().allow(null),
  notification_prefs: Joi.object().optional(),
  timezone: Joi.string().trim().max(50).optional(),
}).min(1);

export const userIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const listUsersQuerySchema = Joi.object({
  role: Joi.string().valid(...USER_ROLES).optional(),
  organization_id: Joi.string().uuid().optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
  search: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

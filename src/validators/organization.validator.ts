import Joi from 'joi';
import { ORG_STATUSES } from '../config/constants';

export const createOrgSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  legal_name: Joi.string().trim().max(255).allow(null, '').optional(),
  domain: Joi.string().trim().max(255).allow(null, '').optional(),
  tier_id: Joi.string().uuid().optional(),
  status: Joi.string().valid(...ORG_STATUSES).optional(),
  industry: Joi.string().trim().max(100).allow(null, '').optional(),
  employee_count: Joi.number().integer().min(0).allow(null).optional(),
  website: Joi.string().trim().max(500).allow(null, '').optional(),
  phone: Joi.string().trim().max(50).allow(null, '').optional(),
  address_line1: Joi.string().trim().max(255).allow(null, '').optional(),
  address_line2: Joi.string().trim().max(255).allow(null, '').optional(),
  city: Joi.string().trim().max(100).allow(null, '').optional(),
  state_province: Joi.string().trim().max(100).allow(null, '').optional(),
  postal_code: Joi.string().trim().max(20).allow(null, '').optional(),
  country: Joi.string().trim().max(100).allow(null, '').optional(),
  channel_manager_id: Joi.string().uuid().allow(null).optional(),
  notes: Joi.string().allow(null, '').optional(),
});

export const updateOrgSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).optional(),
  legal_name: Joi.string().trim().max(255).allow(null, '').optional(),
  domain: Joi.string().trim().max(255).allow(null, '').optional(),
  tier_id: Joi.string().uuid().optional(),
  status: Joi.string().valid(...ORG_STATUSES).optional(),
  industry: Joi.string().trim().max(100).allow(null, '').optional(),
  employee_count: Joi.number().integer().min(0).allow(null).optional(),
  website: Joi.string().trim().max(500).allow(null, '').optional(),
  phone: Joi.string().trim().max(50).allow(null, '').optional(),
  address_line1: Joi.string().trim().max(255).allow(null, '').optional(),
  address_line2: Joi.string().trim().max(255).allow(null, '').optional(),
  city: Joi.string().trim().max(100).allow(null, '').optional(),
  state_province: Joi.string().trim().max(100).allow(null, '').optional(),
  postal_code: Joi.string().trim().max(20).allow(null, '').optional(),
  country: Joi.string().trim().max(100).allow(null, '').optional(),
  channel_manager_id: Joi.string().uuid().allow(null).optional(),
  logo_url: Joi.string().trim().max(500).allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
}).min(1);

export const orgIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const listOrgsQuerySchema = Joi.object({
  status: Joi.string().valid(...ORG_STATUSES).optional(),
  tier_id: Joi.string().uuid().optional(),
  channel_manager_id: Joi.string().uuid().optional(),
  search: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

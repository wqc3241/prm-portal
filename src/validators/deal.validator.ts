import Joi from 'joi';
import { DEAL_STATUSES } from '../config/constants';

// --- Param schemas ---

export const dealIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const dealProductParamsSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
  productId: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

// --- Body schemas ---

export const createDealSchema = Joi.object({
  customer_company_name: Joi.string().trim().min(2).max(255).required(),
  customer_contact_name: Joi.string().trim().max(255).allow(null, '').optional(),
  customer_contact_email: Joi.string().trim().email().max(255).allow(null, '').optional(),
  customer_contact_phone: Joi.string().trim().max(50).allow(null, '').optional(),
  customer_industry: Joi.string().trim().max(100).allow(null, '').optional(),
  customer_address: Joi.string().trim().allow(null, '').optional(),
  deal_name: Joi.string().trim().min(2).max(300).required(),
  description: Joi.string().allow(null, '').optional(),
  estimated_value: Joi.number().positive().required(),
  currency: Joi.string().trim().max(3).default('USD').optional(),
  win_probability: Joi.number().integer().min(0).max(100).allow(null).optional(),
  expected_close_date: Joi.date().iso().greater('now').required(),
  primary_product_id: Joi.string().uuid().allow(null).optional(),
  source: Joi.string().trim().max(50).allow(null, '').optional(),
  tags: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
});

export const updateDealSchema = Joi.object({
  customer_company_name: Joi.string().trim().min(2).max(255).optional(),
  customer_contact_name: Joi.string().trim().max(255).allow(null, '').optional(),
  customer_contact_email: Joi.string().trim().email().max(255).allow(null, '').optional(),
  customer_contact_phone: Joi.string().trim().max(50).allow(null, '').optional(),
  customer_industry: Joi.string().trim().max(100).allow(null, '').optional(),
  customer_address: Joi.string().trim().allow(null, '').optional(),
  deal_name: Joi.string().trim().min(2).max(300).optional(),
  description: Joi.string().allow(null, '').optional(),
  estimated_value: Joi.number().positive().optional(),
  currency: Joi.string().trim().max(3).optional(),
  win_probability: Joi.number().integer().min(0).max(100).allow(null).optional(),
  expected_close_date: Joi.date().iso().greater('now').optional(),
  primary_product_id: Joi.string().uuid().allow(null).optional(),
  source: Joi.string().trim().max(50).allow(null, '').optional(),
  tags: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
}).min(1);

export const submitDealSchema = Joi.object({}).unknown(true);

export const approveDealSchema = Joi.object({
  comments: Joi.string().trim().allow(null, '').optional(),
});

export const rejectDealSchema = Joi.object({
  rejection_reason: Joi.string().trim().min(1).required(),
});

export const markWonSchema = Joi.object({
  actual_value: Joi.number().positive().required(),
  actual_close_date: Joi.date().iso().max('now').default(() => new Date().toISOString().slice(0, 10)),
});

export const markLostSchema = Joi.object({
  loss_reason: Joi.string().trim().min(1).required(),
});

export const addProductSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  unit_price: Joi.number().min(0).required(),
  discount_pct: Joi.number().min(0).max(100).default(0),
});

// --- Query schemas ---

export const conflictCheckQuerySchema = Joi.object({
  customer_company: Joi.string().trim().min(1).required(),
  customer_email: Joi.string().trim().email().allow(null, '').optional(),
  product_id: Joi.string().uuid().allow(null, '').optional(),
});

export const expiringQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
});

export const listDealsQuerySchema = Joi.object({
  status: Joi.string().optional(),
  org_id: Joi.string().uuid().optional(),
  submitted_by: Joi.string().uuid().optional(),
  customer_company: Joi.string().allow('').optional(),
  min_value: Joi.number().min(0).optional(),
  max_value: Joi.number().min(0).optional(),
  expected_close_before: Joi.date().iso().optional(),
  expected_close_after: Joi.date().iso().optional(),
  is_conflicting: Joi.boolean().optional(),
  search: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

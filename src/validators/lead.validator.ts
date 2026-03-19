import Joi from 'joi';
import { LEAD_SOURCES, LEAD_BULK_ASSIGN_MAX } from '../config/constants';

// --- Param schemas ---

export const leadIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

// --- Body schemas ---

export const createLeadSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(100).required(),
  last_name: Joi.string().trim().min(1).max(100).required(),
  email: Joi.string().trim().email().max(255).allow(null, '').optional(),
  phone: Joi.string().trim().max(50).allow(null, '').optional(),
  company_name: Joi.string().trim().max(255).allow(null, '').optional(),
  title: Joi.string().trim().max(200).allow(null, '').optional(),
  industry: Joi.string().trim().max(100).allow(null, '').optional(),
  company_size: Joi.string().trim().max(50).allow(null, '').optional(),
  city: Joi.string().trim().max(100).allow(null, '').optional(),
  state_province: Joi.string().trim().max(100).allow(null, '').optional(),
  country: Joi.string().trim().max(100).allow(null, '').optional(),
  source: Joi.string().trim().valid(...LEAD_SOURCES).allow(null, '').optional(),
  campaign_name: Joi.string().trim().max(200).allow(null, '').optional(),
  score: Joi.number().integer().min(0).max(100).default(0),
  budget: Joi.number().positive().allow(null).optional(),
  timeline: Joi.string().trim().max(100).allow(null, '').optional(),
  interest_notes: Joi.string().allow(null, '').optional(),
  tags: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
});

export const updateLeadSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(100).optional(),
  last_name: Joi.string().trim().min(1).max(100).optional(),
  email: Joi.string().trim().email().max(255).allow(null, '').optional(),
  phone: Joi.string().trim().max(50).allow(null, '').optional(),
  company_name: Joi.string().trim().max(255).allow(null, '').optional(),
  title: Joi.string().trim().max(200).allow(null, '').optional(),
  industry: Joi.string().trim().max(100).allow(null, '').optional(),
  company_size: Joi.string().trim().max(50).allow(null, '').optional(),
  city: Joi.string().trim().max(100).allow(null, '').optional(),
  state_province: Joi.string().trim().max(100).allow(null, '').optional(),
  country: Joi.string().trim().max(100).allow(null, '').optional(),
  source: Joi.string().trim().valid(...LEAD_SOURCES).allow(null, '').optional(),
  campaign_name: Joi.string().trim().max(200).allow(null, '').optional(),
  score: Joi.number().integer().min(0).max(100).optional(),
  budget: Joi.number().positive().allow(null).optional(),
  timeline: Joi.string().trim().max(100).allow(null, '').optional(),
  interest_notes: Joi.string().allow(null, '').optional(),
  tags: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
  status: Joi.string().valid('contacted', 'qualified').optional(),
}).min(1);

export const assignLeadSchema = Joi.object({
  organization_id: Joi.string().uuid({ version: 'uuidv4' }).required(),
  user_id: Joi.string().uuid({ version: 'uuidv4' }).allow(null).optional(),
});

export const bulkAssignSchema = Joi.object({
  assignments: Joi.array()
    .items(
      Joi.object({
        lead_id: Joi.string().uuid({ version: 'uuidv4' }).required(),
        organization_id: Joi.string().uuid({ version: 'uuidv4' }).required(),
        user_id: Joi.string().uuid({ version: 'uuidv4' }).allow(null).optional(),
      }),
    )
    .min(1)
    .max(LEAD_BULK_ASSIGN_MAX)
    .required(),
});

export const acceptSchema = Joi.object({}).unknown(true);

export const returnSchema = Joi.object({
  return_reason: Joi.string().trim().min(1).max(1000).required(),
});

export const convertSchema = Joi.object({
  deal_name: Joi.string().trim().max(300).allow(null, '').optional(),
  estimated_value: Joi.number().positive().allow(null).optional(),
  expected_close_date: Joi.date().iso().greater('now').allow(null).optional(),
});

export const disqualifySchema = Joi.object({
  disqualify_reason: Joi.string().trim().min(1).max(1000).required(),
});

// --- Query schemas ---

export const listLeadsQuerySchema = Joi.object({
  status: Joi.string().optional(),
  score_min: Joi.number().integer().min(0).max(100).optional(),
  score_max: Joi.number().integer().min(0).max(100).optional(),
  source: Joi.string().optional(),
  assigned_org_id: Joi.string().uuid().optional(),
  assigned_user_id: Joi.string().uuid().optional(),
  search: Joi.string().allow('').optional(),
  created_after: Joi.date().iso().optional(),
  created_before: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

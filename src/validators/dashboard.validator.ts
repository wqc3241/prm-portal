import Joi from 'joi';
import { MDF_ACTIVITY_TYPES } from '../config/constants';

// ─── Analytics query param schemas ───────────────────────────────────────────

export const pipelineAnalyticsSchema = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional()
    .messages({ 'date.min': 'end_date must be after start_date' }),
  org_id: Joi.string().uuid().optional(),
  product_id: Joi.string().uuid().optional(),
  group_by: Joi.string().valid('status', 'organization', 'product', 'month').default('status'),
});

export const partnerPerformanceSchema = Joi.object({
  org_id: Joi.string().uuid().optional(),
  tier_id: Joi.string().uuid().optional(),
  sort_by: Joi.string().valid('revenue', 'deal_count', 'win_rate', 'lead_conversion', 'health_score').default('revenue'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  limit: Joi.number().integer().min(1).max(100).default(25),
  offset: Joi.number().integer().min(0).default(0),
});

export const leadConversionSchema = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional()
    .messages({ 'date.min': 'end_date must be after start_date' }),
  org_id: Joi.string().uuid().optional(),
  source: Joi.string().optional(),
});

export const mdfRoiSchema = Joi.object({
  fiscal_year: Joi.number().integer().min(2020).max(2035).optional(),
  fiscal_quarter: Joi.number().integer().min(1).max(4).optional(),
  org_id: Joi.string().uuid().optional(),
  activity_type: Joi.string().valid(...MDF_ACTIVITY_TYPES).optional(),
});

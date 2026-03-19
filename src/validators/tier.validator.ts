import Joi from 'joi';

export const createTierSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  rank: Joi.number().integer().min(1).required(),
  color_hex: Joi.string().trim().max(7).pattern(/^#[0-9A-Fa-f]{6}$/).allow(null, '').optional(),
  min_annual_revenue: Joi.number().min(0).default(0),
  min_deals_closed: Joi.number().integer().min(0).default(0),
  min_certified_reps: Joi.number().integer().min(0).default(0),
  min_csat_score: Joi.number().min(0).max(5).precision(2).default(0),
  default_discount_pct: Joi.number().min(0).max(100).precision(2).default(0),
  max_discount_pct: Joi.number().min(0).max(100).precision(2).default(0),
  mdf_budget_pct: Joi.number().min(0).max(100).precision(2).default(0),
  lead_priority: Joi.number().integer().min(0).default(0),
  dedicated_channel_mgr: Joi.boolean().default(false),
  description: Joi.string().allow(null, '').optional(),
}).custom((value, helpers) => {
  if (value.max_discount_pct < value.default_discount_pct) {
    return helpers.error('any.custom', {
      message: 'max_discount_pct must be >= default_discount_pct',
    });
  }
  return value;
});

export const updateTierSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  rank: Joi.number().integer().min(1).optional(),
  color_hex: Joi.string().trim().max(7).pattern(/^#[0-9A-Fa-f]{6}$/).allow(null, '').optional(),
  min_annual_revenue: Joi.number().min(0).optional(),
  min_deals_closed: Joi.number().integer().min(0).optional(),
  min_certified_reps: Joi.number().integer().min(0).optional(),
  min_csat_score: Joi.number().min(0).max(5).precision(2).optional(),
  default_discount_pct: Joi.number().min(0).max(100).precision(2).optional(),
  max_discount_pct: Joi.number().min(0).max(100).precision(2).optional(),
  mdf_budget_pct: Joi.number().min(0).max(100).precision(2).optional(),
  lead_priority: Joi.number().integer().min(0).optional(),
  dedicated_channel_mgr: Joi.boolean().optional(),
  description: Joi.string().allow(null, '').optional(),
}).min(1);

export const tierIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

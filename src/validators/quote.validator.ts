import Joi from 'joi';
import { QUOTE_STATUSES, DISCOUNT_TYPES } from '../config/constants';

// --- Param schemas ---

export const quoteIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const lineIdParamsSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
  lineId: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

// --- Body schemas ---

export const createQuoteSchema = Joi.object({
  deal_id: Joi.string().uuid().allow(null).optional(),
  customer_name: Joi.string().trim().min(1).max(255).when('deal_id', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  customer_email: Joi.string().trim().email().max(255).allow(null, '').optional(),
  valid_from: Joi.date().iso().allow(null).optional(),
  valid_until: Joi.date().iso().allow(null).optional(),
  payment_terms: Joi.string().trim().max(100).allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
  terms_and_conditions: Joi.string().allow(null, '').optional(),
  tax_amount: Joi.number().min(0).allow(null).optional(),
});

export const updateQuoteSchema = Joi.object({
  customer_name: Joi.string().trim().min(1).max(255).optional(),
  customer_email: Joi.string().trim().email().max(255).allow(null, '').optional(),
  valid_from: Joi.date().iso().optional(),
  valid_until: Joi.date().iso().optional(),
  payment_terms: Joi.string().trim().max(100).allow(null, '').optional(),
  notes: Joi.string().allow(null, '').optional(),
  terms_and_conditions: Joi.string().allow(null, '').optional(),
  tax_amount: Joi.number().min(0).allow(null).optional(),
}).min(1);

export const addLineSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  discount_type: Joi.string().valid(...DISCOUNT_TYPES).default('percentage'),
  discount_value: Joi.number().min(0).default(0).when('discount_type', {
    is: 'percentage',
    then: Joi.number().max(100).messages({
      'number.max': 'Percentage discount cannot exceed 100%',
    }),
  }),
  sort_order: Joi.number().integer().min(0).allow(null).optional(),
  notes: Joi.string().allow(null, '').optional(),
});

export const updateLineSchema = Joi.object({
  quantity: Joi.number().integer().min(1).optional(),
  discount_type: Joi.string().valid(...DISCOUNT_TYPES).optional(),
  discount_value: Joi.number().min(0).optional().when('discount_type', {
    is: 'percentage',
    then: Joi.number().max(100).messages({
      'number.max': 'Percentage discount cannot exceed 100%',
    }),
  }),
  sort_order: Joi.number().integer().min(0).allow(null).optional(),
  notes: Joi.string().allow(null, '').optional(),
}).min(1);

export const submitQuoteSchema = Joi.object({}).unknown(true);

export const approveQuoteSchema = Joi.object({
  comments: Joi.string().trim().allow(null, '').optional(),
});

export const rejectQuoteSchema = Joi.object({
  rejection_reason: Joi.string().trim().min(1).required(),
});

export const sendQuoteSchema = Joi.object({}).unknown(true);
export const acceptQuoteSchema = Joi.object({}).unknown(true);
export const cloneQuoteSchema = Joi.object({}).unknown(true);
export const recalculateQuoteSchema = Joi.object({}).unknown(true);

// --- Query schemas ---

export const listQuotesQuerySchema = Joi.object({
  status: Joi.string().optional(),
  deal_id: Joi.string().uuid().optional(),
  customer_name: Joi.string().allow('').optional(),
  min_amount: Joi.number().min(0).optional(),
  max_amount: Joi.number().min(0).optional(),
  created_after: Joi.date().iso().optional(),
  created_before: Joi.date().iso().optional(),
  created_by: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

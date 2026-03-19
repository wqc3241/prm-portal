import Joi from 'joi';
import { MDF_ACTIVITY_TYPES } from '../config/constants';

// --- Param schemas ---

export const allocationIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const requestIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

// --- Allocation body schemas ---

export const createAllocationSchema = Joi.object({
  organization_id: Joi.string().uuid().required(),
  fiscal_year: Joi.number().integer().min(new Date().getFullYear() - 1).required(),
  fiscal_quarter: Joi.number().integer().min(1).max(4).required(),
  allocated_amount: Joi.number().positive().required(),
  notes: Joi.string().allow(null, '').optional(),
});

export const updateAllocationSchema = Joi.object({
  allocated_amount: Joi.number().positive().optional(),
  notes: Joi.string().allow(null, '').optional(),
}).min(1);

export const autoAllocateSchema = Joi.object({
  fiscal_year: Joi.number().integer().min(new Date().getFullYear() - 1).required(),
  fiscal_quarter: Joi.number().integer().min(1).max(4).required(),
});

// --- Request body schemas ---

export const createRequestSchema = Joi.object({
  allocation_id: Joi.string().uuid().required(),
  activity_type: Joi.string().valid(...MDF_ACTIVITY_TYPES).required(),
  activity_name: Joi.string().trim().min(2).max(300).required(),
  description: Joi.string().allow(null, '').optional(),
  start_date: Joi.date().iso().required(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
  requested_amount: Joi.number().positive().required(),
});

export const updateRequestSchema = Joi.object({
  activity_type: Joi.string().valid(...MDF_ACTIVITY_TYPES).optional(),
  activity_name: Joi.string().trim().min(2).max(300).optional(),
  description: Joi.string().allow(null, '').optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().optional(),
  requested_amount: Joi.number().positive().optional(),
}).min(1);

export const submitRequestSchema = Joi.object({}).unknown(true);

export const approveRequestSchema = Joi.object({
  approved_amount: Joi.number().positive().optional(),
  comments: Joi.string().trim().allow(null, '').optional(),
});

export const rejectRequestSchema = Joi.object({
  rejection_reason: Joi.string().trim().min(1).required(),
});

export const completeActivitySchema = Joi.object({}).unknown(true);

export const submitClaimSchema = Joi.object({
  claim_amount: Joi.number().positive().required(),
  claim_notes: Joi.string().allow(null, '').optional(),
  proof_of_execution: Joi.array().items(Joi.string().uri()).min(1).required(),
});

export const approveClaimSchema = Joi.object({
  reimbursement_amount: Joi.number().positive().optional(),
  comments: Joi.string().trim().allow(null, '').optional(),
});

export const rejectClaimSchema = Joi.object({
  rejection_reason: Joi.string().trim().min(1).required(),
});

export const markReimbursedSchema = Joi.object({
  comments: Joi.string().trim().allow(null, '').optional(),
});

// --- Query schemas ---

export const listAllocationsQuerySchema = Joi.object({
  organization_id: Joi.string().uuid().optional(),
  fiscal_year: Joi.number().integer().optional(),
  fiscal_quarter: Joi.number().integer().min(1).max(4).optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

export const listRequestsQuerySchema = Joi.object({
  status: Joi.string().optional(),
  organization_id: Joi.string().uuid().optional(),
  allocation_id: Joi.string().uuid().optional(),
  activity_type: Joi.string().valid(...MDF_ACTIVITY_TYPES).optional(),
  submitted_by: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

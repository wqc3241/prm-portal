import Joi from 'joi';
import { COURSE_TYPES } from '../config/constants';

// --- Param schemas ---

export const courseIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const orgIdParamSchema = Joi.object({
  orgId: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const certIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

// --- Course body schemas ---

export const createCourseSchema = Joi.object({
  name: Joi.string().trim().min(2).max(300).required(),
  description: Joi.string().allow(null, '').optional(),
  course_type: Joi.string().valid(...COURSE_TYPES).required(),
  duration_hours: Joi.number().positive().allow(null).optional(),
  passing_score: Joi.number().integer().min(1).max(100).required(),
  certification_valid_months: Joi.number().integer().min(1).max(120).required(),
  is_required: Joi.boolean().optional(),
  required_for_tier_id: Joi.string().uuid().allow(null).optional(),
  content_url: Joi.string().uri().allow(null, '').optional(),
});

export const updateCourseSchema = Joi.object({
  name: Joi.string().trim().min(2).max(300).optional(),
  description: Joi.string().allow(null, '').optional(),
  course_type: Joi.string().valid(...COURSE_TYPES).optional(),
  duration_hours: Joi.number().positive().allow(null).optional(),
  passing_score: Joi.number().integer().min(1).max(100).optional(),
  certification_valid_months: Joi.number().integer().min(1).max(120).optional(),
  is_required: Joi.boolean().optional(),
  required_for_tier_id: Joi.string().uuid().allow(null).optional(),
  content_url: Joi.string().uri().allow(null, '').optional(),
  is_active: Joi.boolean().optional(),
}).min(1);

// --- Enrollment schemas ---

export const enrollSchema = Joi.object({
  user_id: Joi.string().uuid().optional(),
});

export const completeSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  score: Joi.number().integer().min(0).max(100).required(),
});

// --- Certification update schema (admin only) ---

export const updateCertificationSchema = Joi.object({
  status: Joi.string().valid('enrolled', 'in_progress', 'passed', 'failed', 'expired').optional(),
  score: Joi.number().integer().min(0).max(100).allow(null).optional(),
  certified_at: Joi.date().iso().allow(null).optional(),
  expires_at: Joi.date().iso().allow(null).optional(),
  certificate_url: Joi.string().uri().allow(null, '').optional(),
}).min(1);

// --- Query schemas ---

export const listCoursesQuerySchema = Joi.object({
  course_type: Joi.string().valid(...COURSE_TYPES).optional(),
  is_required: Joi.string().valid('true', 'false').optional(),
  required_for_tier_id: Joi.string().uuid().optional(),
  search: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

export const listCertificationsQuerySchema = Joi.object({
  status: Joi.string().optional(),
  user_id: Joi.string().uuid().optional(),
  course_id: Joi.string().uuid().optional(),
  organization_id: Joi.string().uuid().optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

export const expiringCertsQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
  organization_id: Joi.string().uuid().optional(),
}).unknown(false);

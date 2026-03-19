import Joi from 'joi';

// --- Query schemas ---

export const listActivityQuerySchema = Joi.object({
  entity_type: Joi.string().optional(),
  entity_id: Joi.string().uuid().optional(),
  actor_id: Joi.string().uuid().optional(),
  action: Joi.string().optional(),
  organization_id: Joi.string().uuid().optional(),
  since: Joi.date().iso().optional(),
  until: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

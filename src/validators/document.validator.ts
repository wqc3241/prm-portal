import Joi from 'joi';

// --- Param schemas ---

export const documentIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const folderIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

// --- Folder body schemas ---

export const createFolderSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  parent_id: Joi.string().uuid().allow(null).optional(),
  visible_to_tiers: Joi.array().items(Joi.string().uuid()).allow(null).optional(),
  internal_only: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional(),
});

export const updateFolderSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  parent_id: Joi.string().uuid().allow(null).optional(),
  visible_to_tiers: Joi.array().items(Joi.string().uuid()).allow(null).optional(),
  internal_only: Joi.boolean().optional(),
  sort_order: Joi.number().integer().min(0).optional(),
}).min(1);

// --- Document body schemas ---

export const uploadDocumentSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).required(),
  description: Joi.string().allow(null, '').optional(),
  file_url: Joi.string().required(),
  file_type: Joi.string().allow(null, '').optional(),
  file_size_bytes: Joi.number().integer().min(0).allow(null).optional(),
  folder_id: Joi.string().uuid().allow(null).optional(),
  visible_to_tiers: Joi.array().items(Joi.string().uuid()).allow(null).optional(),
  internal_only: Joi.boolean().optional(),
  is_featured: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().trim().max(100)).allow(null).optional(),
  notify_partners: Joi.boolean().optional(),
});

export const updateDocumentSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).optional(),
  description: Joi.string().allow(null, '').optional(),
  folder_id: Joi.string().uuid().allow(null).optional(),
  visible_to_tiers: Joi.array().items(Joi.string().uuid()).allow(null).optional(),
  internal_only: Joi.boolean().optional(),
  is_featured: Joi.boolean().optional(),
  tags: Joi.array().items(Joi.string().trim().max(100)).allow(null).optional(),
  version: Joi.number().integer().min(1).optional(),
}).min(1);

// --- Query schemas ---

export const listDocumentsQuerySchema = Joi.object({
  folder_id: Joi.string().uuid().optional(),
  file_type: Joi.string().optional(),
  tags: Joi.string().optional(),
  search: Joi.string().allow('').optional(),
  is_featured: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

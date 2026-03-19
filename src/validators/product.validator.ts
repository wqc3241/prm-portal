import Joi from 'joi';

export const createProductSchema = Joi.object({
  sku: Joi.string().trim().max(100).required(),
  name: Joi.string().trim().max(300).required(),
  description: Joi.string().allow(null, '').optional(),
  category_id: Joi.string().uuid().allow(null).optional(),
  list_price: Joi.number().positive().required()
    .messages({ 'number.positive': '"list_price" must be greater than 0' }),
  cost: Joi.number().min(0).allow(null).optional(),
  currency: Joi.string().length(3).default('USD'),
  is_active: Joi.boolean().default(true),
  available_to_partners: Joi.boolean().default(true),
  product_type: Joi.string().max(50).allow(null, '').optional(),
  billing_cycle: Joi.string().max(20).allow(null, '').optional(),
  image_url: Joi.string().max(500).allow(null, '').optional(),
  spec_sheet_url: Joi.string().max(500).allow(null, '').optional(),
});

export const updateProductSchema = Joi.object({
  sku: Joi.string().trim().max(100).optional(),
  name: Joi.string().trim().max(300).optional(),
  description: Joi.string().allow(null, '').optional(),
  category_id: Joi.string().uuid().allow(null).optional(),
  list_price: Joi.number().positive().optional(),
  cost: Joi.number().min(0).allow(null).optional(),
  currency: Joi.string().length(3).optional(),
  is_active: Joi.boolean().optional(),
  available_to_partners: Joi.boolean().optional(),
  product_type: Joi.string().max(50).allow(null, '').optional(),
  billing_cycle: Joi.string().max(20).allow(null, '').optional(),
  image_url: Joi.string().max(500).allow(null, '').optional(),
  spec_sheet_url: Joi.string().max(500).allow(null, '').optional(),
}).min(1);

export const productIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const tierPricingParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
  tierId: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const tierPricingSchema = Joi.object({
  discount_pct: Joi.number().min(0).max(100).precision(2).optional(),
  special_price: Joi.number().min(0).precision(2).optional(),
}).or('discount_pct', 'special_price');

export const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  parent_id: Joi.string().uuid().allow(null).optional(),
  sort_order: Joi.number().integer().min(0).default(0),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  parent_id: Joi.string().uuid().allow(null).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
}).min(1);

export const categoryIdParamSchema = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const listProductsQuerySchema = Joi.object({
  category_id: Joi.string().uuid().optional(),
  product_type: Joi.string().optional(),
  is_active: Joi.string().valid('true', 'false').optional(),
  search: Joi.string().allow('').optional(),
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
}).unknown(false);

import Joi from 'joi';

export const registerSchema = Joi.object({
  company_name: Joi.string().trim().min(2).max(255).required()
    .messages({ 'string.empty': '"company_name" cannot be empty' }),
  email: Joi.string().trim().lowercase().email().max(255).required(),
  password: Joi.string().min(8).max(128).required()
    .messages({ 'string.min': '"password" must be at least 8 characters' }),
  first_name: Joi.string().trim().min(1).max(100).required(),
  last_name: Joi.string().trim().min(1).max(100).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).max(128).required()
    .messages({ 'string.min': '"password" must be at least 8 characters' }),
});

export const updateProfileSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(100).optional(),
  last_name: Joi.string().trim().min(1).max(100).optional(),
  title: Joi.string().trim().max(200).allow(null, '').optional(),
  phone: Joi.string().trim().max(50).allow(null, '').optional(),
  avatar_url: Joi.string().trim().max(500).uri().allow(null, '').optional(),
  timezone: Joi.string().trim().max(50).optional(),
  notification_prefs: Joi.object({
    email: Joi.boolean().optional(),
    in_app: Joi.boolean().optional(),
  }).optional(),
}).min(1);

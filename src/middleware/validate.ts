import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: Joi.ObjectSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = req[part];

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        code: 'VALIDATION_ERROR',
        message: detail.message,
        field: detail.path.join('.'),
      }));

      _res.status(422).json({
        success: false,
        data: null,
        meta: null,
        errors,
      });
      return;
    }

    // Replace the request part with the validated (and stripped) value
    (req as any)[part] = value;
    next();
  };
}

// Common validation helpers
export const uuidParam = Joi.object({
  id: Joi.string().uuid({ version: 'uuidv4' }).required(),
});

export const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  per_page: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().optional(),
  search: Joi.string().allow('').optional(),
}).unknown(true);

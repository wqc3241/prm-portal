import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // AppError (expected operational errors)
  if (err instanceof AppError) {
    // Support multiple field-level errors (e.g., DEAL_INCOMPLETE with missing fields)
    const errors = (err as any).errors || [
      {
        code: err.code,
        message: err.message,
        field: err.field,
      },
    ];
    res.status(err.statusCode).json({
      success: false,
      data: null,
      meta: null,
      errors,
    });
    return;
  }

  // PostgreSQL unique constraint violation
  if ((err as any).code === '23505') {
    const detail = (err as any).detail || '';
    res.status(409).json({
      success: false,
      data: null,
      meta: null,
      errors: [
        {
          code: 'DUPLICATE_ENTRY',
          message: `A record with this value already exists. ${detail}`,
          field: null,
        },
      ],
    });
    return;
  }

  // PostgreSQL foreign key violation
  if ((err as any).code === '23503') {
    res.status(422).json({
      success: false,
      data: null,
      meta: null,
      errors: [
        {
          code: 'FK_VIOLATION',
          message: 'Referenced record does not exist.',
          field: null,
        },
      ],
    });
    return;
  }

  // JSON parse errors
  if ((err as any).type === 'entity.parse.failed' || (err as any).status === 400) {
    res.status(400).json({
      success: false,
      data: null,
      meta: null,
      errors: [
        {
          code: 'BAD_REQUEST',
          message: 'Invalid JSON in request body.',
          field: null,
        },
      ],
    });
    return;
  }

  // Unknown errors
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    success: false,
    data: null,
    meta: null,
    errors: [
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        field: null,
      },
    ],
  });
}

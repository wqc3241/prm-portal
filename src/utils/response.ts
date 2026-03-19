import { Response } from 'express';
import { PaginationMeta } from './pagination';

export function sendSuccess(
  res: Response,
  data: any,
  statusCode: number = 200,
  meta?: PaginationMeta | null,
) {
  res.status(statusCode).json({
    success: true,
    data,
    meta: meta || null,
    errors: null,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  errors: Array<{ code: string; message: string; field: string | null }>,
) {
  res.status(statusCode).json({
    success: false,
    data: null,
    meta: null,
    errors,
  });
}

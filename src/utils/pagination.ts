import { Request } from 'express';
import { PAGINATION } from '../config/constants';

export interface PaginationParams {
  page: number;
  perPage: number;
  offset: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export function parsePagination(req: Request): PaginationParams {
  let page = parseInt(req.query.page as string, 10);
  let perPage = parseInt(req.query.per_page as string, 10);

  if (isNaN(page) || page < 1) page = PAGINATION.defaultPage;
  if (isNaN(perPage) || perPage < 1) perPage = PAGINATION.defaultPerPage;
  if (perPage > PAGINATION.maxPerPage) perPage = PAGINATION.maxPerPage;

  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
    limit: perPage,
  };
}

export function buildPaginationMeta(
  total: number,
  pagination: PaginationParams,
): PaginationMeta {
  return {
    page: pagination.page,
    per_page: pagination.perPage,
    total,
    total_pages: Math.ceil(total / pagination.perPage),
  };
}

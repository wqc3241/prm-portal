import { Knex } from 'knex';
import { Request } from 'express';

export interface FilterConfig {
  [queryParam: string]: {
    column: string;
    operator?: 'eq' | 'in' | 'gte' | 'lte' | 'like' | 'ilike';
  };
}

export function applyFilters(
  query: Knex.QueryBuilder,
  req: Request,
  config: FilterConfig,
): Knex.QueryBuilder {
  for (const [param, { column, operator }] of Object.entries(config)) {
    const value = req.query[param];
    if (value === undefined || value === '') continue;

    const op = operator || 'eq';

    switch (op) {
      case 'eq':
        query = query.where(column, value as string);
        break;
      case 'in': {
        const values = (value as string).split(',');
        query = query.whereIn(column, values);
        break;
      }
      case 'gte':
        query = query.where(column, '>=', value as string);
        break;
      case 'lte':
        query = query.where(column, '<=', value as string);
        break;
      case 'like':
        query = query.where(column, 'like', `%${value}%`);
        break;
      case 'ilike':
        query = query.where(column, 'ilike', `%${value}%`);
        break;
    }
  }

  return query;
}

export function applySearch(
  query: Knex.QueryBuilder,
  searchTerm: string | undefined,
  columns: string[],
): Knex.QueryBuilder {
  if (!searchTerm || searchTerm.trim() === '') return query;
  const term = `%${searchTerm.trim()}%`;
  query = query.where(function (this: Knex.QueryBuilder) {
    columns.forEach((col, idx) => {
      if (idx === 0) {
        this.where(col, 'ilike', term);
      } else {
        this.orWhere(col, 'ilike', term);
      }
    });
  });
  return query;
}

export function applySorting(
  query: Knex.QueryBuilder,
  sortParam: string | undefined,
  allowedColumns: string[],
  defaultSort: string = 'created_at',
  defaultDirection: 'asc' | 'desc' = 'desc',
): Knex.QueryBuilder {
  if (!sortParam) {
    return query.orderBy(defaultSort, defaultDirection);
  }

  const parts = sortParam.split(':');
  const column = parts[0];
  const direction = (parts[1] === 'asc' || parts[1] === 'desc') ? parts[1] : 'asc';

  if (allowedColumns.includes(column)) {
    return query.orderBy(column, direction);
  }

  return query.orderBy(defaultSort, defaultDirection);
}

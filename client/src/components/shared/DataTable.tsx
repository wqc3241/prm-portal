import { useState, useCallback, type ReactNode } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid';
import { cn } from '../../utils/cn';
import { TableSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';
import type { PaginationMeta } from '../../types';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  meta?: PaginationMeta | null;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  meta,
  onPageChange,
  onSort,
  emptyTitle = 'No results found',
  emptyDescription,
  emptyAction,
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback(
    (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortKey === key && sortDir === 'asc') {
        direction = 'desc';
      }
      setSortKey(key);
      setSortDir(direction);
      onSort?.(key, direction);
    },
    [sortKey, sortDir, onSort]
  );

  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <TableSkeleton rows={5} cols={columns.length} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-900',
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <ChevronUpIcon className="h-3 w-3" />
                      ) : (
                        <ChevronDownIcon className="h-3 w-3" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-gray-50'
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-sm text-gray-700 whitespace-nowrap',
                      col.className
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <Pagination meta={meta} onPageChange={onPageChange} />
      )}
    </div>
  );
}

function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange?: (page: number) => void;
}) {
  const { page, per_page, total, total_pages } = meta;
  const start = (page - 1) * per_page + 1;
  const end = Math.min(page * per_page, total);

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{start}</span> to{' '}
            <span className="font-medium">{end}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </p>
        </div>
        <div>
          <nav
            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
            aria-label="Pagination"
          >
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            {generatePageNumbers(page, total_pages).map((p, idx) =>
              p === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p as number)}
                  className={cn(
                    'relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-20',
                    page === p
                      ? 'z-10 bg-panw-blue text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue'
                      : 'text-gray-900 hover:bg-gray-50'
                  )}
                  aria-current={page === p ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= total_pages}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>

      {/* Mobile pagination */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700 self-center">
          {page} / {total_pages}
        </span>
        <button
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= total_pages}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function generatePageNumbers(
  current: number,
  total: number
): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  if (current <= 3) {
    pages.push(1, 2, 3, 4, '...', total);
  } else if (current >= total - 2) {
    pages.push(1, '...', total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }

  return pages;
}

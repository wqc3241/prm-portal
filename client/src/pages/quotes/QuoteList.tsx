import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useQuotes } from '../../hooks/useQuotes';
import {
  PageHeader,
  SearchBar,
  StatusBadge,
  DataTable,
  type Column,
} from '../../components/shared';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { PlusIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import type { Quote, QuoteStatus, QuoteQueryParams } from '../../types';

const STATUS_TABS: { label: string; value: QuoteStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Sent', value: 'sent_to_customer' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Expired', value: 'expired' },
];

export function QuoteList() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');

  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showValueFilter, setShowValueFilter] = useState(false);

  const params = useMemo<QuoteQueryParams>(() => {
    const p: QuoteQueryParams = {
      page,
      per_page: 25,
      sort: `${sortKey}:${sortDir}`,
    };
    if (statusFilter !== 'all') p.status = statusFilter;
    if (search) p.search = search;
    if (minAmount) p.min_amount = Number(minAmount);
    if (maxAmount) p.max_amount = Number(maxAmount);
    return p;
  }, [page, sortKey, sortDir, statusFilter, search, minAmount, maxAmount]);

  const { data: quotesResponse, isLoading } = useQuotes(params);
  const quotes = quotesResponse?.data ?? [];
  const meta = quotesResponse?.meta;

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(direction);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((status: QuoteStatus | 'all') => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const columns = useMemo<Column<Quote>[]>(() => {
    const cols: Column<Quote>[] = [
      {
        key: 'quote_number',
        header: 'Quote #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">
            {row.quote_number}
          </span>
        ),
      },
      {
        key: 'customer_name',
        header: 'Customer',
        sortable: true,
        render: (row) => (
          <span className="font-medium text-gray-900">{row.customer_name}</span>
        ),
      },
    ];

    if (isInternal) {
      cols.push({
        key: 'organization_name',
        header: 'Partner',
        sortable: true,
        render: (row) => (
          <span className="text-gray-600">{row.organization_name ?? '-'}</span>
        ),
      });
    }

    cols.push(
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            {row.requires_approval && row.status === 'draft' && (
              <span className="text-[10px] font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
                Needs Approval
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'total_amount',
        header: 'Total',
        sortable: true,
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900 font-mono">
            {formatCurrency(row.total_amount)}
          </span>
        ),
      },
      {
        key: 'valid_until',
        header: 'Valid Until',
        sortable: true,
        render: (row) => {
          const isExpiringSoon =
            row.status !== 'accepted' &&
            row.status !== 'expired' &&
            new Date(row.valid_until) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          return (
            <span
              className={cn(
                'text-sm',
                isExpiringSoon ? 'text-red-600 font-medium' : 'text-gray-500'
              )}
            >
              {formatDate(row.valid_until)}
            </span>
          );
        },
      },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      }
    );

    return cols;
  }, [isInternal]);

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Configure, price, and manage customer quotes"
        breadcrumbs={[{ label: 'Quotes' }]}
        actions={
          hasRole('partner_admin', 'partner_rep') ? (
            <button
              onClick={() => navigate('/quotes/new')}
              className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              New Quote
            </button>
          ) : undefined
        }
      />

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 pb-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-panw-blue text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and filters row */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <SearchBar
          placeholder="Search by quote number, customer name..."
          onSearch={handleSearch}
          className="w-full sm:max-w-md"
        />

        <button
          onClick={() => setShowValueFilter((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 transition-colors',
            showValueFilter
              ? 'bg-navy-50 text-panw-navy ring-navy-300'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          <CurrencyDollarIcon className="h-4 w-4" />
          Amount Filter
        </button>

        {showValueFilter && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minAmount}
              onChange={(e) => {
                setMinAmount(e.target.value);
                setPage(1);
              }}
              className="w-28 rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="number"
              placeholder="Max"
              value={maxAmount}
              onChange={(e) => {
                setMaxAmount(e.target.value);
                setPage(1);
              }}
              className="w-28 rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            />
          </div>
        )}
      </div>

      {/* Data Table */}
      <DataTable<Quote>
        columns={columns}
        data={quotes}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        onSort={handleSort}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/quotes/${row.id}`)}
        emptyTitle="No quotes found"
        emptyDescription={
          search || statusFilter !== 'all'
            ? 'Try adjusting your filters or search query.'
            : 'Get started by creating your first quote.'
        }
        emptyAction={
          hasRole('partner_admin', 'partner_rep')
            ? { label: 'Create Quote', onClick: () => navigate('/quotes/new') }
            : undefined
        }
      />
    </div>
  );
}

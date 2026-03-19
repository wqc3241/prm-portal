import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dealsApi } from '../../api/deals';
import { useAuth } from '../../hooks/useAuth';
import {
  PageHeader,
  SearchBar,
  StatusBadge,
  DataTable,
  type Column,
} from '../../components/shared';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { PlusIcon } from '@heroicons/react/24/solid';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import type { Deal, DealStatus, DealQueryParams } from '../../types';

const STATUS_TABS: { label: string; value: DealStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Expired', value: 'expired' },
];

export function DealList() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');

  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [showValueFilter, setShowValueFilter] = useState(false);

  const params = useMemo<DealQueryParams>(() => {
    const p: DealQueryParams = {
      page,
      per_page: 25,
      sort: `${sortKey}:${sortDir}`,
    };
    if (statusFilter !== 'all') p.status = statusFilter;
    if (search) p.search = search;
    if (minValue) p.min_value = Number(minValue);
    if (maxValue) p.max_value = Number(maxValue);
    return p;
  }, [page, sortKey, sortDir, statusFilter, search, minValue, maxValue]);

  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals', params],
    queryFn: async () => {
      const { data } = await dealsApi.list(params);
      return data;
    },
  });

  const deals = dealsData?.data ?? [];
  const meta = dealsData?.meta;

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(direction);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((status: DealStatus | 'all') => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const columns = useMemo<Column<Deal>[]>(() => {
    const cols: Column<Deal>[] = [
      {
        key: 'deal_number',
        header: 'Deal #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">
            {row.deal_number}
          </span>
        ),
      },
      {
        key: 'customer_company_name',
        header: 'Customer',
        sortable: true,
        render: (row) => (
          <span className="font-medium text-gray-900">
            {row.customer_company_name}
          </span>
        ),
      },
      {
        key: 'deal_name',
        header: 'Deal Name',
        render: (row) => (
          <span className="text-gray-700 max-w-[200px] truncate block">
            {row.deal_name}
          </span>
        ),
      },
      {
        key: 'estimated_value',
        header: 'Value',
        sortable: true,
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row.estimated_value)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'expected_close_date',
        header: 'Expected Close',
        sortable: true,
        render: (row) => (
          <span className="text-gray-500">
            {formatDate(row.expected_close_date)}
          </span>
        ),
      },
    ];

    if (isInternal) {
      cols.splice(2, 0, {
        key: 'organization_name',
        header: 'Partner',
        sortable: true,
        render: (row) => (
          <span className="text-gray-600">{row.organization_name ?? '-'}</span>
        ),
      });
    }

    cols.push({
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    });

    return cols;
  }, [isInternal]);

  return (
    <div>
      <PageHeader
        title="Deal Registration"
        subtitle="Manage your deal pipeline and registrations"
        breadcrumbs={[{ label: 'Deals' }]}
        actions={
          hasRole('partner_admin', 'partner_rep') ? (
            <button
              onClick={() => navigate('/deals/new')}
              className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Register Deal
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
          placeholder="Search by deal name, customer, or deal number..."
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
          Value Filter
        </button>

        {showValueFilter && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minValue}
              onChange={(e) => {
                setMinValue(e.target.value);
                setPage(1);
              }}
              className="w-28 rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="number"
              placeholder="Max"
              value={maxValue}
              onChange={(e) => {
                setMaxValue(e.target.value);
                setPage(1);
              }}
              className="w-28 rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            />
          </div>
        )}
      </div>

      {/* Data Table */}
      <DataTable<Deal>
        columns={columns}
        data={deals}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        onSort={handleSort}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/deals/${row.id}`)}
        emptyTitle="No deals found"
        emptyDescription={
          search || statusFilter !== 'all'
            ? 'Try adjusting your filters or search query.'
            : 'Get started by registering your first deal.'
        }
        emptyAction={
          hasRole('partner_admin', 'partner_rep')
            ? { label: 'Register Deal', onClick: () => navigate('/deals/new') }
            : undefined
        }
      />
    </div>
  );
}
